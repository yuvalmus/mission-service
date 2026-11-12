import { Router } from 'express';
import { EntityRetrieverController } from 'controllers/entity.retriever.controller';
import { ENTITY_DEFINITIONS } from 'mappers/entity.registry';
import { validate } from 'middlewares/validation.middleware';
import { ENTITY_TYPES } from 'constants/entity.constants';
import { EntityIdParamsSchema } from 'dtos/commonEntity.dtos';

const NAV_ROUTE_SEGMENT = 'nav-route';

export const createEntityRetrieverRoutes = (controller: EntityRetrieverController): Router => {
  const router = Router();

  Object.values(ENTITY_DEFINITIONS).forEach(definition => {
    router.get(
      `/${definition.entityTypeSegment}/:id`,
      validate({ params: EntityIdParamsSchema }),
      controller.getEntity(definition)
    );
  });

  router.get(
    `/${ENTITY_TYPES.ROUTE}/:id`,
    validate({ params: EntityIdParamsSchema }),
    controller.getRoute
  );
  router.get(
    `/${NAV_ROUTE_SEGMENT}/:id`,
    validate({ params: EntityIdParamsSchema }),
    controller.getNavigationRoute
  );

  return router;
};
