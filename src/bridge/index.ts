import { Client } from 'pg';
import { connect } from 'nats';
import { loadEnv } from 'config/env.config';
import { NATS_CONNECTION } from 'constants/nats.constants';
import { createPostgresDatabase } from 'database/postgres.database';
import { createPostgresSyncRepository } from 'repositories/postgres/sync.repository';
import { createBridgeService } from 'bridge/bridge.service';
import { setupStreams } from 'bridge/nats.streams';
import { createLogger } from 'utils/logger.util';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;
const BRIDGE_SERVICE_SUFFIX = '-bridge';

/**
 * The Bridge runs as its own process, next to the mission service rather than inside it.
 *
 * The application never publishes to NATS directly. If it did, it could commit a change and then
 * die before announcing it — the write would be durable but invisible, and the peers' maps would
 * quietly disagree with the database. Instead the trigger raises the notification inside the same
 * transaction as the write, and this process carries it outward. If it crashes, nothing is lost:
 * the database still holds every change, and the Bridge replays from the stream's last sequence
 * when it comes back.
 */
const bootstrap = async (): Promise<void> => {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL, `${env.SERVICE_NAME}${BRIDGE_SERVICE_SUFFIX}`);

  const nats = await connect({
    servers: env.NATS_URL,
    name: `${env.NODE_NAME}${BRIDGE_SERVICE_SUFFIX}`,
    reconnect: true,
    maxReconnectAttempts: NATS_CONNECTION.MAX_RECONNECT_ATTEMPTS,
    reconnectTimeWait: NATS_CONNECTION.RECONNECT_TIME_WAIT_MS,
  });
  logger.info({ url: env.NATS_URL }, 'Connected to NATS');

  await setupStreams(nats, env, logger);

  // A dedicated client, not a pooled one: LISTEN belongs to a single session for its whole life.
  const pgClient = new Client({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
    application_name: `${env.NODE_NAME}${BRIDGE_SERVICE_SUFFIX}`,
  });
  await pgClient.connect();
  logger.info({ host: env.POSTGRES_HOST, database: env.POSTGRES_DB }, 'Connected to Postgres');

  const database = createPostgresDatabase(env, logger);
  const bridge = createBridgeService({
    pgClient,
    nats,
    syncRepository: createPostgresSyncRepository({ database }),
    env,
    logger,
  });

  await bridge.start();

  SHUTDOWN_SIGNALS.forEach((signal) => {
    process.on(signal, () => {
      logger.info({ signal }, 'Bridge shutting down');
      void bridge.stop().finally(() => process.exit(0));
    });
  });

  pgClient.on('error', (error) => {
    logger.error({ err: error }, 'Postgres listener connection failed — exiting so the supervisor restarts us');
    process.exit(1);
  });
};

bootstrap().catch((error) => {
  process.stderr.write(`Failed to start the bridge: ${error}\n`);
  process.exit(1);
});
