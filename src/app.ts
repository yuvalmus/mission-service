import 'express-async-errors';
import express, { Express } from 'express';
import cors from 'cors';
import { AppContainer } from './app.container';
import { ROUTES, STATIONS } from '@constants/app.constants';
import { createMissionRoutes } from '@routes/mission.routes';
import { createHealthRoutes } from '@routes/health.routes';
import { createDocsRoutes } from '@routes/docs.routes';
import { createEntityCreatorRoutes } from '@routes/entity-creator.routes';
import { createEntityUpdaterRoutes } from '@routes/entity-updater.routes';
import { createEntityDeleterRoutes } from '@routes/entity-deleter.routes';
import { createEntityRetrieverRoutes } from '@routes/entity-retriever.routes';
import { createNamesRoutes } from '@routes/names.routes';
import { createStakeRoutes } from '@routes/stake.routes';
import { createErrorMiddleware } from '@middlewares/error.middleware';
import { createRedisHealthMiddleware } from '@middlewares/redis-health.middleware';

export const createApp = (container: AppContainer): Express => {
  const app = express();

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

  app.use(createHealthRoutes(container.healthController));
  app.use(ROUTES.MISSIONS, createMissionRoutes(container.missionController));

  const creatorRoutes = createEntityCreatorRoutes(container.entityCreatorController);
  app.use(ROUTES.CREATE, creatorRoutes);
  app.use(ROUTES.CREATE_STAKE, creatorRoutes);

  const updaterRoutes = createEntityUpdaterRoutes(container.entityUpdaterController);
  app.use(ROUTES.UPDATE, updaterRoutes);
  app.use(ROUTES.UPDATE_STAKE, updaterRoutes);

  const deleterRoutes = createEntityDeleterRoutes(container.entityDeleterController);
  app.use(ROUTES.DELETE, deleterRoutes);
  app.use(ROUTES.DELETE_STAKE, deleterRoutes);

  app.use(ROUTES.ENTITIES, createEntityRetrieverRoutes(container.entityRetrieverController));
  app.use(ROUTES.NAMES, createNamesRoutes(container.defaultNamesController));
  app.use(ROUTES.STAKES, createStakeRoutes(container.stakeController));
  app.use(ROUTES.DOCS, createDocsRoutes());

  app.use(createErrorMiddleware(container.logger));

  return app;
};
