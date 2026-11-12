import 'express-async-errors';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { AppContainer } from './app.container';
import { STATIONS } from 'constants/app.constants';
import { createAppRoutes } from 'routes/app.routes';
import { createErrorMiddleware } from 'middlewares/error.middleware';
import { createRedisHealthMiddleware } from 'middlewares/redis.health.middleware';

export const createApp = (container: AppContainer): Express => {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));

  if (container.env.STATION !== STATIONS.GROUND) {
    app.use(createRedisHealthMiddleware(container.databaseClient, container.logger));
  }

  app.use(createAppRoutes(container));
  app.use(createErrorMiddleware(container.logger));

  return app;
};
