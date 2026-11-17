import { ERROR_MESSAGES } from 'constants/error.constants';
import { VectorClock } from 'constants/sync.constants';
import { NotFoundError } from 'errors/app.errors';
import {
  EntityDeltaDto,
  EntityDeltaItemDto,
  EntityRenderItemDto,
  RenderLayerDto,
  SyncStatusDto,
} from 'dtos/sync.dtos';
import {
  EntityDeltaRow,
  EntityRenderRow,
  SyncRepository,
  SyncStatusRow,
} from 'repositories/postgres/sync.repository';
import { AppLogger } from 'utils/logger.util';

export interface SyncService {
  getEntityDelta(parentId: string, clock: VectorClock, limit: number): Promise<EntityDeltaDto>;
  getRenderLayer(parentId: string): Promise<RenderLayerDto>;
  getStatus(parentId: string): Promise<SyncStatusDto>;
}

export interface SyncServiceDeps {
  syncRepository: SyncRepository;
  nodeName: string;
  logger: AppLogger;
}

/** BIGINT arrives as a string from node-postgres — sequences stay well inside Number range here. */
const toNumber = (value: string | number | null): number => (value === null ? 0 : Number(value));

const toClock = (raw: Record<string, string | number> | null): VectorClock =>
  Object.fromEntries(Object.entries(raw ?? {}).map(([node, seq]) => [node, toNumber(seq)]));

const raiseClock = (clock: VectorClock, entities: { originNode: string; changeSeq: number }[]): VectorClock =>
  entities.reduce<VectorClock>(
    (merged, entity) => ({
      ...merged,
      [entity.originNode]: Math.max(merged[entity.originNode] ?? 0, entity.changeSeq),
    }),
    { ...clock },
  );

const toDeltaItem = (row: EntityDeltaRow): EntityDeltaItemDto => ({
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

const toRenderItem = (row: EntityRenderRow): EntityRenderItemDto => ({
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

const toStatus = (row: SyncStatusRow, nodeName: string): SyncStatusDto => ({
  parentId: row.parent_id ?? '',
  parentKind: row.parent_kind ?? '',
  isDeleted: row.is_deleted,
  clock: toClock(row.clock),
  entityCount: toNumber(row.entity_count),
  node: nodeName,
});

export const createSyncService = ({ syncRepository, nodeName, logger }: SyncServiceDeps): SyncService => ({
  /**
   * One page of everything above the caller's clock. The returned clock is the cursor to resume
   * from: a client that was offline replays forward from wherever it stopped, which is also what a
   * Bridge reload pulse asks it to do.
   */
  getEntityDelta: async (parentId, clock, limit) => {
    const rows = await syncRepository.getEntityDeltaSince(parentId, clock, limit);
    const entities = rows.map(toDeltaItem);

    logger.info({ parentId, clock, returned: entities.length }, 'Served entity delta');

    return { parentId, clock: raiseClock(clock, entities), hasMore: rows.length === limit, entities };
  },

  getRenderLayer: async (parentId) => {
    const rows = await syncRepository.getRenderLayer(parentId);
    const entities = rows.map(toRenderItem);

    return { parentId, clock: raiseClock({}, entities), entities };
  },

  getStatus: async (parentId) => {
    const row = await syncRepository.getSyncStatus(parentId);
    if (!row) {
      throw new NotFoundError(ERROR_MESSAGES.ENTITY_PARENT_NOT_FOUND(parentId));
    }
    return toStatus(row, nodeName);
  },
});
