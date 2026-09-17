import { loadEnv } from '@config/env.config';
import { createContainer } from './app.container';
import { createApp } from './app';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

const bootstrap = async (): Promise<void> => {
  const env = loadEnv();
  const container = createContainer(env);
  const { logger, databaseClient } = container;

  await databaseClient.connect();
  logger.info({ station: env.STATION }, 'Database connected');

  const app = createApp(container);
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Mission service is listening');
  });

  SHUTDOWN_SIGNALS.forEach((signal) => {
    process.on(signal, () => {
      logger.info({ signal }, 'Shutting down');
      server.close(async () => {
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
