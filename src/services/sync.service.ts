import { ERROR_MESSAGES } from 'constants/error.constants';
import { VectorClock } from 'constants/sync.constants';
import { NotFoundError } from 'errors/app.errors';
import { EntityDeltaDto, RenderLayerDto, SyncStatusDto } from 'dtos/sync.dtos';
import { raiseClock, toDeltaItem, toRenderItem, toStatus } from 'mappers/sync.mapper';
import { SyncRepository } from 'repositories/postgres/sync.repository';
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
