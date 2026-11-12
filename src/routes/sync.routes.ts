import { Router } from 'express';
import { z } from 'zod';
import { SYNC_ROUTES } from 'constants/sync.constants';
import { SyncController } from 'controllers/sync.controller';
import { EntityHistoryController } from 'controllers/entity-history.controller';
import { EntityDeltaQuerySchema, SyncParentQuerySchema } from 'dtos/sync.dtos';
import { validate } from 'middlewares/validation.middleware';

const EntityVersionParamsSchema = z.object({
  entityId: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

const EntityParamsSchema = z.object({
  entityId: z.string().uuid(),
});

export const createSyncRoutes = (
  syncController: SyncController,
  historyController: EntityHistoryController,
): Router => {
  const router = Router();

  router.get(SYNC_ROUTES.ENTITY_DELTA, validate({ query: EntityDeltaQuerySchema }), syncController.getEntityDelta);
  router.get(SYNC_ROUTES.RENDER_LAYER, validate({ query: SyncParentQuerySchema }), syncController.getRenderLayer);
  router.get(SYNC_ROUTES.STATUS, validate({ query: SyncParentQuerySchema }), syncController.getStatus);

  router.get(SYNC_ROUTES.HISTORY, validate({ params: EntityParamsSchema }), historyController.listVersions);
  router.post(
    SYNC_ROUTES.RESTORE,
    validate({ params: EntityVersionParamsSchema }),
    historyController.restoreVersion,
  );
  router.post(
    SYNC_ROUTES.DUPLICATE,
    validate({ params: EntityVersionParamsSchema }),
    historyController.duplicateFromVersion,
  );

  return router;
};
