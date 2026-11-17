import { NatsConnection } from 'nats';
import { Env, MeshPeer } from 'config/env.config';
import { setupStreams } from 'bridge/nats.streams';

const buildLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
}) as never;

const twoPeers: MeshPeer[] = [
  { name: 'station-b', host: 'station-b-postgres', port: 5432 },
  { name: 'station-c', host: 'station-c-postgres', port: 5432 },
];

describe('nats.streams', () => {
  const jsm = { streams: { add: jest.fn(), update: jest.fn(), info: jest.fn(), getMessage: jest.fn() } };
  const nc = { jetstreamManager: () => Promise.resolve(jsm) } as unknown as NatsConnection;

  beforeEach(() => {
    jsm.streams.add.mockResolvedValue({});
  });

  it("mirrors every peer's stream through its JetStream domain", async () => {
    await setupStreams(nc, { NODE_NAME: 'station-a', MESH_PEERS: twoPeers } as Env, buildLogger());

    expect(jsm.streams.add.mock.calls.map(([config]) => config.name)).toEqual([
      'MESH_EVENTS',
      'MESH_EVENTS_MIRROR_STATION_B',
      'MESH_EVENTS_MIRROR_STATION_C',
    ]);
    expect(jsm.streams.add.mock.calls[1]?.[0].mirror.external.api).toBe('$JS.station-b.API');
    expect(jsm.streams.add.mock.calls[2]?.[0].mirror.external.api).toBe('$JS.station-c.API');
  });

  it('creates only the local stream for a single station', async () => {
    await setupStreams(nc, { NODE_NAME: 'station-a', MESH_PEERS: [] as MeshPeer[] } as Env, buildLogger());

    expect(jsm.streams.add.mock.calls.map(([config]) => config.name)).toEqual(['MESH_EVENTS']);
  });
});
