import { z, registry as _registry } from 'config/openapi.config';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { SYNC_LIMITS } from 'constants/sync.constants';

export const SyncParentQuerySchema = z.object({
  parentId: z.string().uuid(),
});

export type SyncParentQuery = z.infer<typeof SyncParentQuerySchema>;

export const VectorClockSchema = z.record(z.string().min(1), z.number().int().nonnegative());

export const EntityDeltaQuerySchema = SyncParentQuerySchema.extend({
  /** The highest number the caller has seen from each station, as JSON. */
  clock: z
    .string()
    .default('{}')
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: ERROR_MESSAGES.SYNC_CLOCK_INVALID });
        return z.NEVER;
      }
    })
    .pipe(VectorClockSchema),
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
    /** Keep this and send it back as `clock` on the next call; never rebuild it from the entities held. */
    clock: VectorClockSchema,
    /** True when the page was capped — call again with `clock` to continue. */
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
    /** The clock this snapshot is current as of — use it to seed delta polling. */
    clock: VectorClockSchema,
    entities: z.array(EntityRenderItemDtoSchema),
  })
  .openapi('RenderLayerDto');

export type RenderLayerDto = z.infer<typeof RenderLayerDtoSchema>;

export const SyncStatusDtoSchema = z
  .object({
    parentId: z.string().uuid(),
    parentKind: z.string(),
    isDeleted: z.boolean(),
    clock: VectorClockSchema,
    entityCount: z.number().int(),
    node: z.string(),
  })
  .openapi('SyncStatusDto');

export type SyncStatusDto = z.infer<typeof SyncStatusDtoSchema>;
