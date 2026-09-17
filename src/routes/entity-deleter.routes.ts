import { Router } from 'express';
import { EntityDeleterController } from '@controllers/entity-deleter.controller';
import { ENTITY_DEFINITIONS } from '@mappers/entity.registry';
import { validate } from '@middlewares/validation.middleware';
import { ENTITY_SEGMENTS, ENTITY_TYPES } from '@constants/entity.constants';
import { DeleteEntityParamsSchema } from '@dtos/entity.dtos';

const DELETE_PARAMS = '/:mission/:id';

export const createEntityDeleterRoutes = (controller: EntityDeleterController): Router => {
  const router = Router();

  ENTITY_DEFINITIONS.forEach((definition) => {
    router.delete(
      `/${definition.segment}${DELETE_PARAMS}`,
      validate({ params: DeleteEntityParamsSchema }),
      controller.deleteFor(definition.entityType),
    );
  });

  router.delete(
    `/${ENTITY_SEGMENTS[ENTITY_TYPES.ROUTE]}${DELETE_PARAMS}`,
    validate({ params: DeleteEntityParamsSchema }),
    controller.deleteRoute,
  );

  return router;
};
