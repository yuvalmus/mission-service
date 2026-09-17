import { Router } from 'express';
import { EntityCreatorController } from '@controllers/entity-creator.controller';
import { ENTITY_DEFINITIONS } from '@mappers/entity.registry';
import { validate } from '@middlewares/validation.middleware';
import { ENTITY_SEGMENTS, ENTITY_TYPES } from '@constants/entity.constants';
import { CreateOrUpdateRouteDtoSchema } from '@dtos/route.dtos';

export const createEntityCreatorRoutes = (controller: EntityCreatorController): Router => {
  const router = Router();

  ENTITY_DEFINITIONS.forEach((definition) => {
    router.post(`/${definition.segment}`, validate({ body: definition.createSchema }), controller.createFor(definition));
  });

  router.post(
    `/${ENTITY_SEGMENTS[ENTITY_TYPES.ROUTE]}`,
    validate({ body: CreateOrUpdateRouteDtoSchema }),
    controller.createRoute,
  );

  return router;
};
