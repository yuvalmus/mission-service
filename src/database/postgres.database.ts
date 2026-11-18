import { Pool, PoolClient } from 'pg';
import { Env } from 'config/env.config';
import { DatabaseClient, TransactionContext, UnitOfWork } from 'database/database.types';
import { AppLogger } from 'utils/logger.util';

export interface PostgresDatabase {
  client: DatabaseClient;
  unitOfWork: UnitOfWork;
  pool: Pool;
  /** Runs `fn` on the caller's transaction when there is one, otherwise on a pooled client. */
  withContext: <T>(context: TransactionContext | undefined, fn: (client: PoolClient) => Promise<T>) => Promise<T>;
}

const TRANSACTION = {
  BEGIN: 'BEGIN',
  COMMIT: 'COMMIT',
  ROLLBACK: 'ROLLBACK',
} as const;

const PING_QUERY = 'SELECT 1';

const POOL_TIMEOUTS = {
  IDLE_MS: 10_000,
  CONNECTION_MS: 5_000,
} as const;

/**
 * A transaction context carries the `PoolClient` that owns the open transaction. Repositories
 * receive it through `TransactionContext.raw`, exactly as the Mongo layer carries a `ClientSession`.
 */
export const toPoolClient = (context?: TransactionContext): PoolClient | null =>
  (context?.raw as PoolClient | undefined) ?? null;

export const createPostgresDatabase = (env: Env, logger: AppLogger): PostgresDatabase => {
  const pool = new Pool({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
    max: env.POSTGRES_POOL_MAX,
    idleTimeoutMillis: POOL_TIMEOUTS.IDLE_MS,
    connectionTimeoutMillis: POOL_TIMEOUTS.CONNECTION_MS,
    application_name: `${env.NODE_NAME}-${env.SERVICE_NAME}`,
  });

  const connected = { value: false };

  pool.on('error', (error) => {
    logger.error({ err: error }, 'Unexpected idle Postgres client error');
  });

  const withClient = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  };

  const withContext = <T>(
    context: TransactionContext | undefined,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> => {
    const client = toPoolClient(context);
    return client ? fn(client) : withClient(fn);
  };

  const client: DatabaseClient = {
    connect: async () => {
      await withClient((pooled) => pooled.query(PING_QUERY));
      connected.value = true;
    },
    disconnect: async () => {
      connected.value = false;
      await pool.end();
    },
    ping: async () => {
      try {
        await withClient((pooled) => pooled.query(PING_QUERY));
        connected.value = true;
        return true;
      } catch {
        connected.value = false;
        return false;
      }
    },
    isConnected: () => connected.value,
  };

  /**
   * One explicit transaction per unit of work. Every BEFORE/AFTER trigger the schema installs —
   * version bump, history backup, `pg_notify` — runs inside this same transaction, so either the
   * row change and its change event both land, or neither does. Nothing reaches the WAL (and so
   * nothing reaches pglogical or NATS) before COMMIT.
   */
  const unitOfWork: UnitOfWork = {
    run: <T>(work: (context: TransactionContext) => Promise<T>): Promise<T> =>
      withClient(async (pooled) => {
        await pooled.query(TRANSACTION.BEGIN);
        try {
          const result = await work({ raw: pooled });
          await pooled.query(TRANSACTION.COMMIT);
          return result;
        } catch (error) {
          await pooled.query(TRANSACTION.ROLLBACK);
          throw error;
        }
      }),
  };

  return { client, unitOfWork, pool, withContext };
};
