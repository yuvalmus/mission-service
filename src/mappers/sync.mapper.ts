import { VectorClock } from 'constants/sync.constants';
import { EntityDeltaItemDto, EntityRenderItemDto, SyncStatusDto } from 'dtos/sync.dtos';
import { EntityDeltaRow, EntityRenderRow, SyncStatusRow } from 'repositories/postgres/sync.repository';

/** BIGINT arrives as a string from node-postgres — sequences stay well inside Number range here. */
const toNumber = (value: string | number | null): number => (value === null ? 0 : Number(value));

const toClock = (raw: Record<string, string | number> | null): VectorClock =>
  Object.fromEntries(Object.entries(raw ?? {}).map(([node, seq]) => [node, toNumber(seq)]));

export const raiseClock = (clock: VectorClock, entities: { originNode: string; changeSeq: number }[]): VectorClock =>
  entities.reduce<VectorClock>(
    (merged, entity) => ({
      ...merged,
      [entity.originNode]: Math.max(merged[entity.originNode] ?? 0, entity.changeSeq),
    }),
    { ...clock },
  );

export const toDeltaItem = (row: EntityDeltaRow): EntityDeltaItemDto => ({
  entityId: row.entity_id,
  parentId: row.parent_id,
  entityType: row.entity_type,
  name: row.name,
  category: row.category,
  geometry: row.geometry ?? null,
  properties: row.properties,
  version: toNumber(row.version),
  changeSeq: toNumber(row.mission_change_seq),
  schemaVersion: row.schema_version,
  isDeleted: row.is_deleted,
  isHidden: row.is_hidden,
  originNode: row.origin_node,
  lastUpdateTime: row.last_update_time,
});

export const toRenderItem = (row: EntityRenderRow): EntityRenderItemDto => ({
  entityId: row.entity_id,
  parentId: row.parent_id,
  entityType: row.entity_type,
  name: row.name,
  category: row.category,
  geometry: row.geometry ?? null,
  properties: row.properties,
  version: toNumber(row.version),
  changeSeq: toNumber(row.mission_change_seq),
  schemaVersion: row.schema_version,
  originNode: row.origin_node,
});

export const toStatus = (row: SyncStatusRow, nodeName: string): SyncStatusDto => ({
  parentId: row.parent_id ?? '',
  parentKind: row.parent_kind ?? '',
  isDeleted: row.is_deleted,
  clock: toClock(row.clock),
  entityCount: toNumber(row.entity_count),
  node: nodeName,
});
