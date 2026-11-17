import { Env, MeshPeer } from 'config/env.config';
import { createPglogicalMesh, describeReplicationError, PglogicalMesh } from 'database/postgres/pglogical.setup';
import { NODE_NAME } from '../fixtures/postgres.fixtures';

const buildLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
}) as never;

describe('describeReplicationError', () => {
  it('redacts a password carried in a DSN', () => {
    const error = new Error('could not connect: dsn was: host=station-b-postgres port=5432 user=mesh password=mesh_pass');

    const described = describeReplicationError(error);

    expect(described).not.toContain('mesh_pass');
    expect(described).toContain('password=***');
    expect(described).toContain('host=station-b-postgres');
  });

  it('redacts every password when the message repeats the DSN', () => {
    const described = describeReplicationError(new Error('password=first then password=second'));

    expect(described).toBe('password=*** then password=***');
  });

  it('describes a non-Error value without throwing', () => {
    expect(describeReplicationError('peer unreachable password=x')).toBe('peer unreachable password=***');
  });
});

describe('createPglogicalMesh', () => {
  const twoPeers: MeshPeer[] = [
    { name: 'station-b', host: 'station-b-postgres', port: 5432 },
    { name: 'station-c', host: 'pc3', port: 5432 },
  ];

  const unreachableHosts = new Set<string>();

  const answer = (sql: string, values: unknown[] = []) => {
    if (sql.includes('pglogical.create_subscription')) {
      const dsn = String(values[1]);
      if ([...unreachableHosts].some((host) => dsn.includes(`host=${host} `))) {
        return Promise.reject(new Error('could not connect to the provider'));
      }
    }
    if (sql.includes('FROM pglogical.node')) return Promise.resolve({ rowCount: 1, rows: [{}] });
    if (sql.includes('show_subscription_status')) return Promise.resolve({ rowCount: 1, rows: [{ status: 'replicating' }] });
    return Promise.resolve({ rowCount: 0, rows: [] });
  };

  const client = { query: jest.fn(), release: jest.fn() };
  const pool = { connect: jest.fn() };
  const meshes: PglogicalMesh[] = [];

  const mesh = (peers: MeshPeer[]): PglogicalMesh => {
    const created = createPglogicalMesh({
      pool: pool as never,
      env: { NODE_NAME, MESH_PEERS: peers, POSTGRES_HOST: 'localhost', POSTGRES_PORT: 5432 } as Env,
      logger: buildLogger(),
    });
    meshes.push(created);
    return created;
  };

  const callsTo = (fragment: string): unknown[][] =>
    client.query.mock.calls.filter(([sql]) => String(sql).includes(fragment)).map(([, values]) => values as unknown[]);

  const subscriptionNames = () => callsTo('pglogical.create_subscription').map((values) => values[0]);
  const addedTables = () => callsTo('pglogical.replication_set_add_table').map((values) => values[1]);

  beforeEach(() => {
    unreachableHosts.clear();
    client.query.mockImplementation(answer);
    pool.connect.mockResolvedValue(client);
  });

  afterEach(() => {
    meshes.splice(0).forEach((created) => created.stop());
  });

  it('subscribes to every peer', async () => {
    await mesh(twoPeers).connect();

    expect(subscriptionNames()).toEqual(['sub_node_a_to_station_b', 'sub_node_a_to_station_c']);
  });

  it('replicates the history table but never the change counter', async () => {
    await mesh(twoPeers).connect();

    expect(addedTables()).toEqual(expect.arrayContaining(['missions', 'infra', 'entities', 'route_backups']));
    expect(addedTables()).not.toContain('change_counters');
  });

  it('keeps subscribing to a reachable peer when another is down', async () => {
    unreachableHosts.add('pc3');

    await expect(mesh(twoPeers).connect()).resolves.toBeUndefined();

    expect(subscriptionNames()).toContain('sub_node_a_to_station_b');
  });

  it('gives every peer link timeouts so a cut link is noticed in seconds', async () => {
    await mesh(twoPeers).connect();

    const dsns = callsTo('pglogical.create_subscription').map((values) => String(values[1]));
    expect(dsns).toHaveLength(2);
    dsns.forEach((dsn) =>
      expect(dsn).toContain(
        'connect_timeout=10 keepalives=1 keepalives_idle=10 keepalives_interval=5 keepalives_count=3 tcp_user_timeout=15000',
      ),
    );
  });

  it('runs as a single station with no peers', async () => {
    await mesh([]).connect();

    expect(client.query).not.toHaveBeenCalled();
  });
});
