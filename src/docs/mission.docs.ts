import { z, registry } from 'config/openapi.config';
import { ROUTES } from 'constants/app.constants';
import { HTTP_STATUS } from 'constants/http.constants';
import {
  BasicMissionDtoSchema,
  ErrorDetailsDtoSchema,
  MergeMissionDtoSchema,
  MissionDtoListSchema,
  MissionDtoSchema,
  MissionIdListDtoSchema,
  MissionIdParamsSchema,
  SearchNameParamsSchema,
  UpdateMissionDtoSchema
} from 'dtos/mission.dtos';
import { ZodTypeAny } from 'zod';

const TAGS = { MISSIONS: 'Missions' } as const;

const jsonContent = (schema: ZodTypeAny) => ({ 'application/json': { schema } });

const badRequestResponse = {
  [HTTP_STATUS.BAD_REQUEST]: {
    description: 'Validation or domain error',
    content: jsonContent(ErrorDetailsDtoSchema)
  }
} as const;

const notFoundResponse = {
  [HTTP_STATUS.NOT_FOUND]: { description: 'Mission not found' }
} as const;

registry.registerPath({
  method: 'get',
  path: `${ROUTES.MISSIONS}/as-basic`,
  tags: [TAGS.MISSIONS],
  summary: 'Get all missions in basic form',
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'All missions',
      content: jsonContent(z.array(BasicMissionDtoSchema))
    }
  }
});

registry.registerPath({
  method: 'get',
  path: `${ROUTES.MISSIONS}/{id}`,
  tags: [TAGS.MISSIONS],
  summary: 'Get a mission by id',
  request: { params: MissionIdParamsSchema },
  responses: {
    [HTTP_STATUS.OK]: { description: 'The mission', content: jsonContent(MissionDtoSchema) },
    ...notFoundResponse,
    ...badRequestResponse
  }
});

registry.registerPath({
  method: 'get',
  path: `${ROUTES.MISSIONS}/search/{name}`,
  tags: [TAGS.MISSIONS],
  summary: 'Search missions by name (case-insensitive substring)',
  request: { params: SearchNameParamsSchema },
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'Matching missions',
      content: jsonContent(z.array(BasicMissionDtoSchema))
    },
    ...badRequestResponse
  }
});

registry.registerPath({
  method: 'post',
  path: `${ROUTES.MISSIONS}/from-ids`,
  tags: [TAGS.MISSIONS],
  summary: 'Get full missions by a list of ids',
  request: { body: { content: jsonContent(MissionIdListDtoSchema) } },
  responses: {
    [HTTP_STATUS.OK]: { description: 'Missions', content: jsonContent(z.array(MissionDtoSchema)) },
    ...badRequestResponse
  }
});

registry.registerPath({
  method: 'post',
  path: `${ROUTES.MISSIONS}/from-ids/as-basic`,
  tags: [TAGS.MISSIONS],
  summary: 'Get missions by a list of ids (basic form)',
  request: { body: { content: jsonContent(MissionIdListDtoSchema) } },
  responses: {
    [HTTP_STATUS.OK]: { description: 'Missions', content: jsonContent(z.array(MissionDtoSchema)) },
    ...badRequestResponse
  }
});

registry.registerPath({
  method: 'post',
  path: `${ROUTES.MISSIONS}/clone/{id}`,
  tags: [TAGS.MISSIONS],
  summary: 'Clone a mission with all of its entities',
  request: { params: MissionIdParamsSchema },
  responses: {
    [HTTP_STATUS.OK]: { description: 'The cloned mission', content: jsonContent(MissionDtoSchema) },
    ...notFoundResponse,
    ...badRequestResponse
  }
});

registry.registerPath({
  method: 'post',
  path: ROUTES.MISSIONS,
  tags: [TAGS.MISSIONS],
  summary: 'Create a mission',
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'The created mission',
      content: jsonContent(MissionDtoSchema)
    },
    ...badRequestResponse
  }
});

registry.registerPath({
  method: 'put',
  path: ROUTES.MISSIONS,
  tags: [TAGS.MISSIONS],
  summary: 'Update a mission',
  request: { body: { content: jsonContent(UpdateMissionDtoSchema) } },
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'The updated mission',
      content: jsonContent(MissionDtoSchema)
    },
    ...badRequestResponse
  }
});

registry.registerPath({
  method: 'put',
  path: `${ROUTES.MISSIONS}/merge`,
  tags: [TAGS.MISSIONS],
  summary: 'Merge the selected layers of one mission into another',
  request: { body: { content: jsonContent(MergeMissionDtoSchema) } },
  responses: {
    [HTTP_STATUS.OK]: { description: 'The merged mission', content: jsonContent(MissionDtoSchema) },
    ...notFoundResponse,
    ...badRequestResponse
  }
});

registry.registerPath({
  method: 'post',
  path: `${ROUTES.MISSIONS}/list`,
  tags: [TAGS.MISSIONS],
  summary: 'Import a list of missions with their entities',
  request: { body: { content: jsonContent(MissionDtoListSchema) } },
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'The imported missions',
      content: jsonContent(MissionDtoListSchema)
    },
    ...badRequestResponse
  }
});

registry.registerPath({
  method: 'delete',
  path: `${ROUTES.MISSIONS}/{id}`,
  tags: [TAGS.MISSIONS],
  summary: 'Delete a mission with all of its entities',
  request: { params: MissionIdParamsSchema },
  responses: {
    [HTTP_STATUS.OK]: { description: 'Mission deleted' },
    ...notFoundResponse,
    ...badRequestResponse
  }
});
