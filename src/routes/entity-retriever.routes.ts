import { Router } from 'express';
import { EntityRetrieverController } from 'controllers/entity-retriever.controller';
import { ENTITY_DEFINITIONS } from 'mappers/entity.registry';
import { validate } from 'middlewares/validation.middleware';
import { ENTITY_SEGMENTS, ENTITY_TYPES } from 'constants/entity.constants';
import { EntityIdParamsSchema } from 'dtos/entity.dtos';

const NAV_ROUTE_SEGMENT = 'nav-route';

export const createEntityRetrieverRoutes = (controller: EntityRetrieverController): Router => {
  const router = Router();

  ENTITY_DEFINITIONS.forEach((definition) => {
    router.get(`/${definition.segment}/:id`, validate({ params: EntityIdParamsSchema }), controller.getFor(definition));
  });

  router.get(
    `/${ENTITY_SEGMENTS[ENTITY_TYPES.ROUTE]}/:id`,
    validate({ params: EntityIdParamsSchema }),
    controller.getRoute,
  );
  router.get(`/${NAV_ROUTE_SEGMENT}/:id`, validate({ params: EntityIdParamsSchema }), controller.getNavigationRoute);

  return router;
};
