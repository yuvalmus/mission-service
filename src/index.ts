import { loadEnv } from 'config/env.config';
import { createSchema } from 'database/postgres/schema.bootstrap';
import { describeReplicationError } from 'database/postgres/pglogical.setup';
import { createContainer } from './app.container';
import { createApp } from './app';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

const bootstrap = async (): Promise<void> => {
  const env = loadEnv();
  const container = createContainer(env);
  const { logger, databaseClient, postgres, tombstoneCollector, pglogicalMesh } = container;

  await databaseClient.connect();
  logger.info({ station: env.STATION }, 'Database connected');

  if (postgres) {
    await createSchema({ pool: postgres.pool, env, logger });
    tombstoneCollector?.start();

    // Never awaited as a precondition for serving traffic: a station has to come up and keep
    // working whether or not its peer is reachable. Replication catches up on its own.
    void pglogicalMesh?.connect().catch((error) => {
      logger.warn({ reason: describeReplicationError(error) }, 'pglogical bootstrap failed');
    });
  }

  const app = createApp(container);
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Mission service is listening');
  });

  SHUTDOWN_SIGNALS.forEach((signal) => {
    process.on(signal, () => {
      logger.info({ signal }, 'Shutting down');
      server.close(async () => {
        tombstoneCollector?.stop();
        pglogicalMesh?.stop();
        await databaseClient.disconnect();
        process.exit(0);
      });
    });
  });
};

bootstrap().catch((error) => {
  process.stderr.write(`Failed to start mission service: ${error}\n`);
  process.exit(1);
});
