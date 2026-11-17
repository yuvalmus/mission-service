import { ERROR_MESSAGES } from 'constants/error.constants';
import { UnitOfWork } from 'database/database.types';
import { NotFoundError } from 'errors/app.errors';
import { EntityVersionRow, HistoryRepository } from 'repositories/postgres/history.repository';
import { AppLogger } from 'utils/logger.util';

export interface EntityVersionDto {
  eventId: string;
  entityId: string;
  version: number;
  entityType: string;
  originNode: string;
  changeSeq: number;
  lastUpdateTime: Date;
  isDeleted: boolean;
  isCurrent: boolean;
  geometry: unknown | null;
  properties: Record<string, unknown> | null;
}

export interface EntityHistoryService {
  listVersions(entityId: string): Promise<EntityVersionDto[]>;
  restoreVersion(entityId: string, eventId: string): Promise<void>;
  duplicateFromVersion(entityId: string, eventId: string, name: string | null): Promise<string>;
}

export interface EntityHistoryServiceDeps {
  historyRepository: HistoryRepository;
  unitOfWork: UnitOfWork;
  nodeName: string;
  logger: AppLogger;
}

const toDto = (row: EntityVersionRow): EntityVersionDto => ({
  eventId: row.event_id,
  entityId: row.entity_id,
  version: Number(row.version),
  entityType: row.entity_type,
  originNode: row.origin_node,
  changeSeq: Number(row.mission_change_seq),
  lastUpdateTime: row.last_update_time,
  isDeleted: row.is_deleted,
  isCurrent: row.is_current,
  geometry: row.geometry ?? null,
  properties: row.properties,
});

/**
 * Version history for entities.
 *
 * Last-Write-Wins resolves a conflict by discarding one side. The history is what keeps that from
 * being a loss: the row that lost is preserved and can be inspected or reinstated, including the
 * common case where a peer coming back from a disconnection overwrote local work.
 */
export const createEntityHistoryService = ({
  historyRepository,
  unitOfWork,
  nodeName,
  logger,
}: EntityHistoryServiceDeps): EntityHistoryService => ({
  listVersions: async (entityId) => {
    const rows = await historyRepository.listVersions(entityId);
    return rows.map(toDto);
  },

  restoreVersion: (entityId, eventId) =>
    unitOfWork.run(async (context) => {
      const restored = await historyRepository.restoreVersion(entityId, eventId, nodeName, context);
      if (!restored) {
        throw new NotFoundError(ERROR_MESSAGES.ENTITY_BACKUP_NOT_FOUND(entityId, eventId));
      }
      logger.info({ entityId, eventId }, 'Restored entity to an earlier version');
    }),

  duplicateFromVersion: (entityId, eventId, name) =>
    unitOfWork.run(async (context) => {
      const createdId = await historyRepository.duplicateFromVersion(entityId, eventId, name, nodeName, context);
      if (!createdId) {
        throw new NotFoundError(ERROR_MESSAGES.ENTITY_BACKUP_NOT_FOUND(entityId, eventId));
      }
      logger.info({ entityId, eventId, createdId }, 'Created a new entity from an earlier version');
      return createdId;
    }),
});
