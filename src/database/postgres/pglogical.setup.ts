import { Pool, PoolClient } from 'pg';
import { Env, MeshPeer } from 'config/env.config';
import { PG_EXTENSIONS, PG_TABLES } from 'constants/postgres.constants';
import { AppLogger } from 'utils/logger.util';

export interface PglogicalMesh {
  connect(): Promise<void>;
  stop(): void;
}

export interface PglogicalSetupDeps {
  pool: Pool;
  env: Env;
  logger: AppLogger;
}

const REPLICATION_SET = 'mesh_replication';

/**
 * `change_counters` is deliberately absent. It numbers this station's own writes per parent; a
 * peer's counter replicated over it would hand out numbers the peer has already used.
 */
const REPLICATED_TABLES = [PG_TABLES.MISSIONS, PG_TABLES.INFRA, PG_TABLES.ENTITIES, PG_TABLES.ROUTE_BACKUPS] as const;

const RETRY_INTERVAL_MS = 15_000;

const SUBSCRIPTION_STATUS = {
  DOWN: 'down',
} as const;

/** pglogical node names are SQL identifiers, so a hostname-style name has to be normalised. */
const toIdentifier = (value: string): string => value.replace(/-/g, '_');

const buildDsn = (host: string, port: number, env: Env): string =>
  `host=${host} port=${port} dbname=${env.POSTGRES_DB} user=${env.POSTGRES_USER} password=${env.POSTGRES_PASSWORD}`;

const isAlreadyExists = (error: unknown): boolean =>
  error instanceof Error && /already|duplicate/i.test(error.message);

const PASSWORD_IN_DSN = /password=\S+/gi;
const REDACTED_PASSWORD = 'password=***';

/**
 * pglogical reports connection failures with the full DSN in the error detail, password included.
 * Only the redacted message is logged, never the raw error object.
 */
export const describeReplicationError = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replace(PASSWORD_IN_DSN, REDACTED_PASSWORD).trim();

export const createPglogicalMesh = ({ pool, env, logger }: PglogicalSetupDeps): PglogicalMesh => {
  const nodeName = toIdentifier(env.NODE_NAME);
  const timers = new Map<string, NodeJS.Timeout>();

  const toSubscriptionName = (peer: MeshPeer): string => `sub_${nodeName}_to_${toIdentifier(peer.name)}`;

  const withClient = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  };

  const ensureNode = async (client: PoolClient): Promise<void> => {
    const existing = await client.query('SELECT 1 FROM pglogical.node WHERE node_name = $1', [nodeName]);
    if (existing.rowCount) return;

    await client.query('SELECT pglogical.create_node(node_name := $1, dsn := $2)', [
      nodeName,
      buildDsn(env.POSTGRES_HOST, env.POSTGRES_PORT, env),
    ]);
    logger.info({ node: nodeName }, 'pglogical node created');
  };

  /**
   * Physical deletes are not replicated. The only DELETEs this service issues come from the
   * tombstone collector, which every station runs for itself on the same retention window — the
   * logical deletion (the tombstone, the masked parent) is an UPDATE and replicates normally.
   */
  const ensureReplicationSet = async (client: PoolClient): Promise<void> => {
    try {
      await client.query(
        `SELECT pglogical.create_replication_set(
           set_name := $1,
           replicate_insert := true,
           replicate_update := true,
           replicate_delete := false,
           replicate_truncate := true
         )`,
        [REPLICATION_SET],
      );
      logger.info({ set: REPLICATION_SET }, 'pglogical replication set created');
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      await client.query('SELECT pglogical.alter_replication_set(set_name := $1, replicate_delete := false)', [
        REPLICATION_SET,
      ]);
    }
  };

  /**
   * Each station publishes only the rows it wrote last.
   *
   * Without this filter the initial copy is not safe in a two-way mesh. When a station joins late
   * it copies the survivor's data; when the survivor then subscribes back, it would copy the
   * joiner's tables — which now hold the survivor's own rows — and die on duplicate keys. Filtering
   * on `origin_node` means a station can never be sent its own rows back, on the initial copy or
   * afterwards. `origin_node` is stamped by trigger on every local write, so an edit made here to a
   * row the peer created becomes this station's to publish.
   */
  const buildRowFilter = (): string => `origin_node = '${env.NODE_NAME.replace(/'/g, "''")}'`;

  const readRowFilter = async (client: PoolClient, table: string): Promise<string | null | undefined> => {
    const result = await client.query<{ filter: string | null }>(
      `SELECT pg_get_expr(t.set_row_filter, t.set_reloid) AS filter
       FROM pglogical.replication_set_table t
       JOIN pglogical.replication_set s ON s.set_id = t.set_id
       WHERE s.set_name = $1 AND t.set_reloid = $2::regclass`,
      [REPLICATION_SET, table],
    );
    return result.rowCount ? (result.rows[0]?.filter ?? null) : undefined;
  };

  const ensureTables = async (client: PoolClient): Promise<void> => {
    const rowFilter = buildRowFilter();

    for (const table of REPLICATED_TABLES) {
      const existing = await readRowFilter(client, table);
      if (existing !== undefined && existing !== null) continue;

      // Present without a filter means an earlier, unsafe configuration — replace it.
      if (existing === null) {
        await client.query('SELECT pglogical.replication_set_remove_table(set_name := $1, relation := $2)', [
          REPLICATION_SET,
          table,
        ]);
      }

      await client.query(
        `SELECT pglogical.replication_set_add_table(
           set_name := $1,
           relation := $2,
           synchronize_data := true,
           row_filter := $3
         )`,
        [REPLICATION_SET, table, rowFilter],
      );
      logger.info({ table, rowFilter }, 'Table added to the replication set');
    }
  };

  const readSubscriptionStatus = async (client: PoolClient, subscriptionName: string): Promise<string | undefined> => {
    const result = await client
      .query<{ status: string }>(
        `SELECT status FROM pglogical.show_subscription_status() WHERE subscription_name = $1`,
        [subscriptionName],
      )
      .catch(() => ({ rows: [] as Array<{ status: string }> }));
    return result.rows[0]?.status;
  };

  /**
   * Subscribing to the peer is expected to fail while the peer is down, and that is not an error
   * condition: a station must come up and serve reads and writes whether or not anyone else is
   * reachable. The attempt simply repeats until it succeeds.
   *
   * `forward_origins := '{}'` keeps a change from being echoed back to the station that made it.
   */
  const attemptSubscription = (peer: MeshPeer): Promise<boolean> =>
    withClient(async (client) => {
      const subscriptionName = toSubscriptionName(peer);
      const local = await client.query('SELECT 1 FROM pglogical.node WHERE node_name = $1', [nodeName]);
      if (!local.rowCount) return false;

      const existing = await client.query('SELECT 1 FROM pglogical.subscription WHERE sub_name = $1', [
        subscriptionName,
      ]);

      if (!existing.rowCount) {
        await client.query(
          `SELECT pglogical.create_subscription(
             subscription_name := $1,
             provider_dsn := $2,
             replication_sets := ARRAY[$3],
             synchronize_data := true,
             forward_origins := '{}',
             apply_delay := '0 seconds'::interval
           )`,
          [subscriptionName, buildDsn(peer.host, peer.port, env), REPLICATION_SET],
        );
        logger.info({ subscription: subscriptionName, peer: peer.name }, 'pglogical subscription created');
      }

      const status = await readSubscriptionStatus(client, subscriptionName);
      if (!status || status === SUBSCRIPTION_STATUS.DOWN) {
        logger.warn({ subscription: subscriptionName, status }, 'pglogical subscription is not healthy yet');
        return false;
      }

      return true;
    });

  const scheduleRetry = (peer: MeshPeer): void => {
    const handle = setTimeout(async () => {
      try {
        if (await attemptSubscription(peer)) {
          logger.info({ peer: peer.name }, 'pglogical subscription established');
          timers.delete(peer.name);
          return;
        }
      } catch (error) {
        logger.warn({ peer: peer.name, reason: describeReplicationError(error) }, 'pglogical subscription retry failed');
      }
      if (timers.has(peer.name)) scheduleRetry(peer);
    }, RETRY_INTERVAL_MS);

    handle.unref?.();
    timers.set(peer.name, handle);
  };

  const connectPeer = async (peer: MeshPeer): Promise<void> => {
    // create_subscription connects to the peer synchronously, so an unreachable peer surfaces as
    // a thrown error rather than an unhealthy status. Both mean the same thing here: keep going.
    const established = await attemptSubscription(peer).catch((error: unknown) => {
      logger.warn({ peer: peer.name, reason: describeReplicationError(error) }, 'First subscription attempt failed');
      return false;
    });

    if (established) {
      logger.info({ peer: peer.name }, 'pglogical subscription verified');
      return;
    }

    logger.info(
      { peer: peer.name, retrySeconds: RETRY_INTERVAL_MS / 1000 },
      'Peer unreachable — will keep retrying in background',
    );
    scheduleRetry(peer);
  };

  return {
    connect: async () => {
      if (!env.MESH_PEERS.length) {
        logger.info('No peer configured — running as a single station');
        return;
      }

      await withClient(async (client) => {
        await client.query(`CREATE EXTENSION IF NOT EXISTS ${PG_EXTENSIONS.PGLOGICAL}`);
        await ensureNode(client);
        await ensureReplicationSet(client);
        await ensureTables(client);
      });

      await Promise.all(env.MESH_PEERS.map(connectPeer));
    },

    stop: () => {
      timers.forEach((handle) => clearTimeout(handle));
      timers.clear();
    },
  };
};
