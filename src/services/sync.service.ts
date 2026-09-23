import { ERROR_MESSAGES } from 'constants/error.constants';
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
  getEntityDelta(parentId: string, sinceSeq: number, limit: number): Promise<EntityDeltaDto>;
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
  lastChangeSeq: toNumber(row.last_change_seq),
  entityCount: toNumber(row.entity_count),
  node: nodeName,
});

export const createSyncService = ({ syncRepository, nodeName, logger }: SyncServiceDeps): SyncService => ({
  /**
   * One page of everything that changed above `sinceSeq`. `nextSeq` is the cursor to resume from:
   * a client that was offline replays forward from wherever it stopped, which is also the path the
   * Bridge uses to refill the stream after a crash.
   */
  getEntityDelta: async (parentId, sinceSeq, limit) => {
    const rows = await syncRepository.getEntityDeltaSince(parentId, sinceSeq, limit);
    const entities = rows.map(toDeltaItem);
    const nextSeq = entities.reduce((highest, entity) => Math.max(highest, entity.changeSeq), sinceSeq);

    logger.debug({ parentId, sinceSeq, returned: entities.length }, 'Served entity delta');

    return { parentId, sinceSeq, nextSeq, hasMore: rows.length === limit, entities };
  },

  getRenderLayer: async (parentId) => {
    const rows = await syncRepository.getRenderLayer(parentId);
    const entities = rows.map(toRenderItem);
    const changeSeq = entities.reduce((highest, entity) => Math.max(highest, entity.changeSeq), 0);

    return { parentId, changeSeq, entities };
  },

  getStatus: async (parentId) => {
    const row = await syncRepository.getSyncStatus(parentId);
    if (!row) {
      throw new NotFoundError(ERROR_MESSAGES.ENTITY_PARENT_NOT_FOUND(parentId));
    }
    return toStatus(row, nodeName);
  },
});
