import { z, registry } from 'config/openapi.config';
import { HTTP_STATUS } from 'constants/http.constants';
import { SYNC_ROUTES } from 'constants/sync.constants';
import { EntityDeltaDtoSchema, RenderLayerDtoSchema, SyncStatusDtoSchema } from 'dtos/sync.dtos';

const TAGS = { SYNC: 'Sync' } as const;

const PATHS = {
  DELTA: `${SYNC_ROUTES.ROOT}${SYNC_ROUTES.ENTITY_DELTA}`,
  RENDER: `${SYNC_ROUTES.ROOT}${SYNC_ROUTES.RENDER_LAYER}`,
  STATUS: `${SYNC_ROUTES.ROOT}${SYNC_ROUTES.STATUS}`,
  HISTORY: `${SYNC_ROUTES.ROOT}/entities/{entityId}/history`,
  RESTORE: `${SYNC_ROUTES.ROOT}/entities/{entityId}/restore/{version}`,
  DUPLICATE: `${SYNC_ROUTES.ROOT}/entities/{entityId}/duplicate/{version}`,
} as const;

const parentIdParam = z.string().uuid().openapi({ description: 'Mission id or stake id' });

const EntityVersionDtoSchema = z
  .object({
    entityId: z.string().uuid(),
    version: z.number().int(),
    entityType: z.string(),
    geometry: z.unknown().nullable(),
    properties: z.record(z.string(), z.unknown()).nullable(),
    isDeleted: z.boolean(),
    updatedByNode: z.string().nullable(),
    createdAt: z.coerce.date(),
  })
  .openapi('EntityVersionDto');

registry.registerPath({
  method: 'get',
  path: PATHS.DELTA,
  tags: [TAGS.SYNC],
  summary: 'Entities changed since a given change sequence',
  description:
    'Returns only the entities whose change sequence is greater than `sinceSeq`. Keep `nextSeq` and ' +
    'pass it back on the following call to continue where you left off after a disconnection.',
  request: {
    query: z.object({
      parentId: parentIdParam,
      sinceSeq: z.coerce.number().int().nonnegative().optional(),
      limit: z.coerce.number().int().positive().optional(),
    }),
  },
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'One page of changes',
      content: { 'application/json': { schema: EntityDeltaDtoSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: PATHS.RENDER,
  tags: [TAGS.SYNC],
  summary: 'Full render snapshot for the map layer',
  description:
    'Geometry already serialised to GeoJSON and render defaults injected by the database, so the ' +
    'browser parses rather than computes. Use `changeSeq` to seed delta polling.',
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
  tags: [TAGS.SYNC],
  summary: 'Current change sequence and entity count for a parent',
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
  tags: [TAGS.SYNC],
  summary: 'Previous versions of an entity',
  description: 'Up to ten earlier versions, newest first, including states overwritten by a peer.',
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
  tags: [TAGS.SYNC],
  summary: 'Restore an entity to an earlier version',
  description: 'Applied as a normal update, so the replaced state is itself kept in the history.',
  request: { params: z.object({ entityId: z.string().uuid(), version: z.coerce.number().int() }) },
  responses: {
    [HTTP_STATUS.OK]: { description: 'Entity restored' },
    [HTTP_STATUS.NOT_FOUND]: { description: 'No such version' },
  },
});

registry.registerPath({
  method: 'post',
  path: PATHS.DUPLICATE,
  tags: [TAGS.SYNC],
  summary: 'Create a new entity from an earlier version',
  request: {
    params: z.object({ entityId: z.string().uuid(), version: z.coerce.number().int() }),
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
