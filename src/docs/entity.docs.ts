import { ZodTypeAny } from 'zod';
import { z, registry } from 'config/openapi.config';
import { ROUTES } from 'constants/app.constants';
import { HTTP_STATUS } from 'constants/http.constants';
import { ENTITY_DEFINITIONS } from 'mappers/entity.registry';
import { ENTITY_TYPES } from 'constants/entity.constants';
import {
  BasicEntityDtoSchema,
  UpdateBasicEntitiesDtoSchema,
  UpdateBasicEntityDtoSchema
} from 'dtos/commonEntity.dtos';
import {
  CreateOrUpdateRouteDtoSchema,
  RetrieveNavigationRouteDtoSchema,
  RetrieveRouteDtoSchema,
  RouteDtoSchema
} from 'dtos/route.dtos';
import { ErrorDetailsDtoSchema } from 'dtos/mission.dtos';

const TAGS = {
  ENTITIES: 'Entities',
  NAMES: 'Default names'
} as const;

const toName = (segment: string): string =>
  segment.replace(/([a-z0-9])([A-Z])/g, (_, first: string, second: string) => `${first}-${second}`)
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const jsonContent = (schema: ZodTypeAny) => ({ 'application/json': { schema } });

const badRequestResponse = {
  [HTTP_STATUS.BAD_REQUEST]: {
    description: 'Validation or domain error',
    content: jsonContent(ErrorDetailsDtoSchema)
  }
} as const;

const notFoundResponse = {
  [HTTP_STATUS.NOT_FOUND]: { description: 'Entity not found' }
} as const;

const registerEntityCrud = (
  segment: string,
  createSchema: ZodTypeAny,
  updateSchema: ZodTypeAny,
  dtoSchema: ZodTypeAny
): void => {
  const name = toName(segment);

  [ROUTES.CREATE, ROUTES.CREATE_STAKE].forEach(base => {
    registry.registerPath({
      method: 'post',
      path: `${base}/${segment}`,
      operationId:
        base === ROUTES.CREATE ? `create${name}` : `create${name}Stake`,
      tags: [TAGS.ENTITIES],
      summary: `Create a ${segment}`,
      request: { body: { content: jsonContent(createSchema) } },
      responses: {
        [HTTP_STATUS.CREATED]: {
          description: `The created ${segment}`,
          content: jsonContent(dtoSchema)
        },
        ...badRequestResponse
      }
    });
  });

  [ROUTES.UPDATE, ROUTES.UPDATE_STAKE].forEach(base => {
    registry.registerPath({
      method: 'put',
      path: `${base}/${segment}`,
      operationId:
        base === ROUTES.UPDATE ? `update${name}` : `update${name}Stake`,
      tags: [TAGS.ENTITIES],
      summary: `Update a ${segment}`,
      request: { body: { content: jsonContent(updateSchema) } },
      responses: {
        [HTTP_STATUS.OK]: {
          description: `The updated ${segment}`,
          content: jsonContent(dtoSchema)
        },
        ...badRequestResponse
      }
    });
  });

  [ROUTES.DELETE, ROUTES.DELETE_STAKE].forEach(base => {
    registry.registerPath({
      method: 'delete',
      path: `${base}/${segment}/{mission}/{id}`,
      operationId:
        base === ROUTES.DELETE ? `delete${name}` : `delete${name}Stake`,
      tags: [TAGS.ENTITIES],
      summary: `Delete a ${segment}`,
      responses: {
        [HTTP_STATUS.NO_CONTENT]: { description: `${segment} deleted` },
        ...notFoundResponse,
        ...badRequestResponse
      }
    });
  });

  registry.registerPath({
    method: 'get',
    path: `${ROUTES.ENTITIES}/${segment}/{id}`,
    operationId: `get${name}`,
    tags: [TAGS.ENTITIES],
    summary: `Get a ${segment} by id`,
    responses: {
      [HTTP_STATUS.OK]: { description: `The ${segment}`, content: jsonContent(dtoSchema) },
      ...notFoundResponse
    }
  });

  registry.registerPath({
    method: 'get',
    path: `${ROUTES.NAMES}/${segment}/{missionId}/{amount}`,
    operationId: `names${name}`,
    tags: [TAGS.NAMES],
    summary: `Generate default names for ${segment}`,
    responses: {
      [HTTP_STATUS.OK]: {
        description: 'Generated names',
        content: jsonContent(z.array(z.string()))
      },
      ...notFoundResponse
    }
  });
};

Object.values(ENTITY_DEFINITIONS).forEach(definition => {
  registerEntityCrud(
    definition.entityTypeSegment,
    definition.createSchema,
    definition.updateSchema,
    definition.dtoSchema
  );
});

registerEntityCrud(
  ENTITY_TYPES.ROUTE,
  CreateOrUpdateRouteDtoSchema,
  CreateOrUpdateRouteDtoSchema,
  RouteDtoSchema
);

registry.registerPath({
  method: 'get',
  path: `${ROUTES.ENTITIES}/${ENTITY_TYPES.ROUTE}/{id}`,
  operationId: 'getRoute',
  tags: [TAGS.ENTITIES],
  summary: 'Get a route with its wpt coordinates',
  responses: {
    [HTTP_STATUS.OK]: { description: 'The route', content: jsonContent(RetrieveRouteDtoSchema) },
    ...notFoundResponse
  }
});

registry.registerPath({
  method: 'get',
  path: `${ROUTES.ENTITIES}/nav-route/{id}`,
  operationId: 'getNavigationRoute',
  tags: [TAGS.ENTITIES],
  summary: 'Get a route in navigation form',
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'The navigation route',
      content: jsonContent(RetrieveNavigationRouteDtoSchema)
    },
    ...notFoundResponse
  }
});

[ROUTES.UPDATE, ROUTES.UPDATE_STAKE].forEach(base => {
  registry.registerPath({
    method: 'put',
    path: `${base}/changeEntityVisibility`,
    operationId:
      base === ROUTES.UPDATE ? 'changeEntityVisibility' : 'changeEntityVisibilityStake',
    tags: [TAGS.ENTITIES],
    summary: 'Change visibility of a single entity',
    request: { body: { content: jsonContent(UpdateBasicEntityDtoSchema) } },
    responses: {
      [HTTP_STATUS.OK]: {
        description: 'The updated entity',
        content: jsonContent(BasicEntityDtoSchema)
      },
      ...badRequestResponse
    }
  });

  registry.registerPath({
    method: 'put',
    path: `${base}/changeEntitiesVisibility`,
    operationId:
      base === ROUTES.UPDATE ? 'changeEntitiesVisibility' : 'changeEntitiesVisibilityStake',
    tags: [TAGS.ENTITIES],
    summary: 'Change visibility of a list of entities',
    request: { body: { content: jsonContent(UpdateBasicEntitiesDtoSchema) } },
    responses: {
      [HTTP_STATUS.OK]: {
        description: 'The updated entities',
        content: jsonContent(z.array(BasicEntityDtoSchema))
      },
      ...badRequestResponse
    }
  });
});

registry.registerPath({
  method: 'get',
  path: `${ROUTES.NAMES}/route/wpt/{missionId}/{amount}`,
  operationId: 'namesRouteWpt',
  tags: [TAGS.NAMES],
  summary: 'Generate default names for route wpts',
  responses: {
    [HTTP_STATUS.OK]: { description: 'Generated names', content: jsonContent(z.array(z.string())) },
    ...notFoundResponse
  }
});

registry.registerPath({
  method: 'get',
  path: `${ROUTES.NAMES}/mission`,
  operationId: 'nextMissionName',
  tags: [TAGS.NAMES],
  summary: 'Generate the next default mission name',
  responses: {
    [HTTP_STATUS.OK]: { description: 'Generated name', content: jsonContent(z.string()) }
  }
});
