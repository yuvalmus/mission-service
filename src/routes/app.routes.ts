import { Router } from 'express';
import { AppContainer } from '../app.container';
import { ROUTES } from 'constants/app.constants';
import { createMissionRoutes } from 'routes/mission.routes';
import { createHealthRoutes } from 'routes/health.routes';
import { createDocsRoutes } from 'routes/docs.routes';
import { createEntityCreatorRoutes } from 'routes/entity.creator.routes';
import { createEntityUpdaterRoutes } from 'routes/entity.updater.routes';
import { createEntityDeleterRoutes } from 'routes/entity.deleter.routes';
import { createEntityRetrieverRoutes } from 'routes/entity.retriever.routes';
import { createNamesRoutes } from 'routes/entity.names.generator.routes';
import { createStakeRoutes } from 'routes/stake.routes';
import { createSyncRoutes } from './sync.routes';

export const createAppRoutes = (container: AppContainer): Router => {
  const router = Router();

  router.use(createHealthRoutes(container.healthController));
  router.use(ROUTES.MISSIONS, createMissionRoutes(container.missionController));

  const creatorRoutes = createEntityCreatorRoutes(container.entityCreatorController);
  router.use(ROUTES.CREATE, creatorRoutes);
  router.use(ROUTES.CREATE_STAKE, creatorRoutes);

  const updaterRoutes = createEntityUpdaterRoutes(container.entityUpdaterController);
  router.use(ROUTES.UPDATE, updaterRoutes);
  router.use(ROUTES.UPDATE_STAKE, updaterRoutes);

  const deleterRoutes = createEntityDeleterRoutes(container.entityDeleterController);
  router.use(ROUTES.DELETE, deleterRoutes);
  router.use(ROUTES.DELETE_STAKE, deleterRoutes);

  router.use(ROUTES.ENTITIES, createEntityRetrieverRoutes(container.entityRetrieverController));
  router.use(ROUTES.NAMES, createNamesRoutes(container.defaultNamesController));
  router.use(ROUTES.STAKES, createStakeRoutes(container.stakeController));

  if (container.syncController && container.entityHistoryController) {
    router.use(
      ROUTES.SYNC,
      createSyncRoutes(container.syncController, container.entityHistoryController),
    );
  }

  router.use(ROUTES.DOCS, createDocsRoutes());

  return router;
};
