import { z, registry } from 'config/openapi.config';
import { HTTP_STATUS } from 'constants/http.constants';
import { SYNC_ROUTES } from 'constants/sync.constants';
import {
  EntityDeltaDtoSchema,
  EntityVersionDtoSchema,
  RenderLayerDtoSchema,
  SyncStatusDtoSchema,
} from 'dtos/sync.dtos';

const TAGS = { SYNC: 'Sync' } as const;

const PATHS = {
  DELTA: `${SYNC_ROUTES.ROOT}${SYNC_ROUTES.ENTITY_DELTA}`,
  RENDER: `${SYNC_ROUTES.ROOT}${SYNC_ROUTES.RENDER_LAYER}`,
  STATUS: `${SYNC_ROUTES.ROOT}${SYNC_ROUTES.STATUS}`,
  HISTORY: `${SYNC_ROUTES.ROOT}/entities/{entityId}/history`,
  RESTORE: `${SYNC_ROUTES.ROOT}/entities/{entityId}/restore/{eventId}`,
  DUPLICATE: `${SYNC_ROUTES.ROOT}/entities/{entityId}/duplicate/{eventId}`,
} as const;

const parentIdParam = z.string().uuid().openapi({ description: 'Mission id or stake id' });

registry.registerPath({
  method: 'get',
  path: PATHS.DELTA,
  operationId: 'getEntityDelta',
  tags: [TAGS.SYNC],
  summary: 'Entities changed since a per-station clock',
  description:
    'Returns only the entities whose number from their origin station is greater than the one in ' +
    '`clock`. Keep the returned `clock` and pass it back on the following call to continue where you ' +
    'left off after a disconnection. Never rebuild it from the entities you hold.',
  request: {
    query: z.object({
      parentId: parentIdParam,
      clock: z.string().optional().openapi({
        description: 'JSON object of station name to the last number seen from it',
        example: '{"station-a":10,"station-b":4}',
      }),
      limit: z.coerce.number().int().positive().optional(),
    }),
  },
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'One page of changes',
      content: { 'application/json': { schema: EntityDeltaDtoSchema } },
    },
    [HTTP_STATUS.NOT_MODIFIED]: { description: 'Nothing changed since the clock' },
    [HTTP_STATUS.BAD_REQUEST]: { description: 'Malformed clock' },
  },
});

registry.registerPath({
  method: 'get',
  path: PATHS.RENDER,
  operationId: 'getRenderLayer',
  tags: [TAGS.SYNC],
  summary: 'Full render snapshot for the map layer',
  description:
    'Geometry already serialised to GeoJSON and render defaults injected by the database, so the ' +
    'browser parses rather than computes. Use `clock` to seed delta polling.',
  request: { query: z.object({ parentId: parentIdParam }) },
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'Current entities of the parent',
      content: { 'application/json': { schema: RenderLayerDtoSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: PATHS.STATUS,
  operationId: 'getSyncStatus',
  tags: [TAGS.SYNC],
  summary: 'Current per-station clock and entity count for a parent',
  request: { query: z.object({ parentId: parentIdParam }) },
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'Sync status on this station',
      content: { 'application/json': { schema: SyncStatusDtoSchema } },
    },
    [HTTP_STATUS.NOT_FOUND]: { description: 'No such mission or stake' },
  },
});

registry.registerPath({
  method: 'get',
  path: PATHS.HISTORY,
  operationId: 'listEntityVersions',
  tags: [TAGS.SYNC],
  summary: 'Previous versions of an entity',
  description:
    'Every kept version, newest first, from every station — including the losing side of a conflict. ' +
    '`isCurrent` marks the live one.',
  request: { params: z.object({ entityId: z.string().uuid() }) },
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'Stored versions',
      content: { 'application/json': { schema: z.array(EntityVersionDtoSchema) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: PATHS.RESTORE,
  operationId: 'restoreEntityVersion',
  tags: [TAGS.SYNC],
  summary: 'Restore an entity to an earlier version',
  description: 'Applied as a normal update, so the restore is itself a new version in the history.',
  request: { params: z.object({ entityId: z.string().uuid(), eventId: z.string().uuid() }) },
  responses: {
    [HTTP_STATUS.OK]: { description: 'Entity restored' },
    [HTTP_STATUS.NOT_FOUND]: { description: 'No such version' },
  },
});

registry.registerPath({
  method: 'post',
  path: PATHS.DUPLICATE,
  operationId: 'duplicateEntityVersion',
  tags: [TAGS.SYNC],
  summary: 'Create a new entity from an earlier version',
  request: {
    params: z.object({ entityId: z.string().uuid(), eventId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ name: z.string().optional() }).openapi('DuplicateFromVersionDto'),
        },
      },
    },
  },
  responses: {
    [HTTP_STATUS.CREATED]: { description: 'New entity created' },
    [HTTP_STATUS.NOT_FOUND]: { description: 'No such version' },
  },
});
