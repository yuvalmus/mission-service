import { Router } from 'express';
import { DefaultNamesController } from 'controllers/default-names.controller';
import { ENTITY_DEFINITIONS } from 'mappers/entity.registry';
import { validate } from 'middlewares/validation.middleware';
import {
  ENTITY_NAME_PREFIXES,
  ENTITY_SEGMENTS,
  ENTITY_TYPES,
  ROUTE_WPT_NAME_PREFIX,
} from 'constants/entity.constants';
import { NamesParamsSchema } from 'dtos/entity.dtos';

const NAMES_PARAMS = '/:missionId/:amount?';
const MISSION_NAMES_ROUTE = '/mission';
const ROUTE_WPT_SEGMENT = 'route/wpt';

export const createNamesRoutes = (controller: DefaultNamesController): Router => {
  const router = Router();

  router.get(MISSION_NAMES_ROUTE, controller.nextMissionName);
  router.get(
    `/${ROUTE_WPT_SEGMENT}${NAMES_PARAMS}`,
    validate({ params: NamesParamsSchema }),
    controller.namesFor(ROUTE_WPT_NAME_PREFIX),
  );

  ENTITY_DEFINITIONS.forEach((definition) => {
    router.get(
      `/${definition.segment}${NAMES_PARAMS}`,
      validate({ params: NamesParamsSchema }),
      controller.namesFor(ENTITY_NAME_PREFIXES[definition.entityType]),
    );
  });

  router.get(
    `/${ENTITY_SEGMENTS[ENTITY_TYPES.ROUTE]}${NAMES_PARAMS}`,
    validate({ params: NamesParamsSchema }),
    controller.namesFor(ENTITY_NAME_PREFIXES[ENTITY_TYPES.ROUTE]),
  );

  return router;
};
