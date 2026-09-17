import { Router } from 'express';
import { EntityUpdaterController } from '@controllers/entity-updater.controller';
import { ENTITY_DEFINITIONS } from '@mappers/entity.registry';
import { validate } from '@middlewares/validation.middleware';
import { ENTITY_SEGMENTS, ENTITY_TYPES } from '@constants/entity.constants';
import { CreateOrUpdateRouteDtoSchema } from '@dtos/route.dtos';
import { UpdateBasicEntitiesDtoSchema, UpdateBasicEntityDtoSchema } from '@dtos/entity.dtos';

const VISIBILITY_ROUTES = {
  ENTITY: '/changeEntityVisibility',
  ENTITIES: '/changeEntitiesVisibility',
} as const;

const SEGMENT_WITHOUT_CATEGORY_VALIDATION = ENTITY_SEGMENTS[ENTITY_TYPES.SECTOR];

export const createEntityUpdaterRoutes = (controller: EntityUpdaterController): Router => {
  const router = Router();

  router.put(VISIBILITY_ROUTES.ENTITY, validate({ body: UpdateBasicEntityDtoSchema }), controller.changeEntityVisibility);
  router.put(
    VISIBILITY_ROUTES.ENTITIES,
    validate({ body: UpdateBasicEntitiesDtoSchema }),
    controller.changeEntitiesVisibility,
  );

  ENTITY_DEFINITIONS.forEach((definition) => {
    const validateCategory = definition.segment !== SEGMENT_WITHOUT_CATEGORY_VALIDATION;
    router.put(
      `/${definition.segment}`,
      validate({ body: definition.updateSchema }),
      controller.updateFor(definition, validateCategory),
    );
  });

  router.put(
    `/${ENTITY_SEGMENTS[ENTITY_TYPES.ROUTE]}`,
    validate({ body: CreateOrUpdateRouteDtoSchema }),
    controller.updateRoute,
  );

  return router;
};
