import { z, registry as _registry } from 'config/openapi.config';
import { SYNC_LIMITS } from 'constants/sync.constants';

export const SyncParentQuerySchema = z.object({
  parentId: z.string().uuid(),
});

export type SyncParentQuery = z.infer<typeof SyncParentQuerySchema>;

export const EntityDeltaQuerySchema = SyncParentQuerySchema.extend({
  /** The highest sequence the caller has already processed. */
  sinceSeq: z.coerce.number().int().nonnegative().default(SYNC_LIMITS.DEFAULT_SINCE_SEQ),
  limit: z.coerce.number().int().positive().max(SYNC_LIMITS.MAX_PAGE).default(SYNC_LIMITS.DEFAULT_PAGE),
});

export type EntityDeltaQuery = z.infer<typeof EntityDeltaQuerySchema>;

export const EntityDeltaItemDtoSchema = z
  .object({
    entityId: z.string().uuid(),
    parentId: z.string().uuid(),
    entityType: z.string(),
    name: z.string().nullable(),
    category: z.string().nullable(),
    geometry: z.unknown().nullable(),
    properties: z.record(z.string(), z.unknown()),
    version: z.number().int(),
    changeSeq: z.number().int(),
    schemaVersion: z.number().int(),
    isDeleted: z.boolean(),
    isHidden: z.boolean(),
    originNode: z.string(),
    lastUpdateTime: z.coerce.date(),
  })
  .openapi('EntityDeltaItemDto');

export type EntityDeltaItemDto = z.infer<typeof EntityDeltaItemDtoSchema>;

export const EntityDeltaDtoSchema = z
  .object({
    parentId: z.string().uuid(),
    sinceSeq: z.number().int(),
    /** Feed this back as `sinceSeq` on the next call. */
    nextSeq: z.number().int(),
    /** True when the page was capped — call again from `nextSeq` to continue. */
    hasMore: z.boolean(),
    entities: z.array(EntityDeltaItemDtoSchema),
  })
  .openapi('EntityDeltaDto');

export type EntityDeltaDto = z.infer<typeof EntityDeltaDtoSchema>;

export const EntityRenderItemDtoSchema = z
  .object({
    entityId: z.string().uuid(),
    parentId: z.string().uuid(),
    entityType: z.string(),
    name: z.string().nullable(),
    category: z.string().nullable(),
    geometry: z.unknown().nullable(),
    properties: z.record(z.string(), z.unknown()),
    version: z.number().int(),
    changeSeq: z.number().int(),
    schemaVersion: z.number().int(),
    originNode: z.string(),
  })
  .openapi('EntityRenderItemDto');

export type EntityRenderItemDto = z.infer<typeof EntityRenderItemDtoSchema>;

export const RenderLayerDtoSchema = z
  .object({
    parentId: z.string().uuid(),
    /** The sequence this snapshot is current as of — use it to seed delta polling. */
    changeSeq: z.number().int(),
    entities: z.array(EntityRenderItemDtoSchema),
  })
  .openapi('RenderLayerDto');

export type RenderLayerDto = z.infer<typeof RenderLayerDtoSchema>;

export const SyncStatusDtoSchema = z
  .object({
    parentId: z.string().uuid(),
    parentKind: z.string(),
    isDeleted: z.boolean(),
    lastChangeSeq: z.number().int(),
    entityCount: z.number().int(),
    node: z.string(),
  })
  .openapi('SyncStatusDto');

export type SyncStatusDto = z.infer<typeof SyncStatusDtoSchema>;
