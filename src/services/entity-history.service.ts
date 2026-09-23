import { ERROR_MESSAGES } from 'constants/error.constants';
import { UnitOfWork } from 'database/database.types';
import { NotFoundError } from 'errors/app.errors';
import { EntityBackupRow, HistoryRepository } from 'repositories/postgres/history.repository';
import { AppLogger } from 'utils/logger.util';

export interface EntityVersionDto {
  entityId: string;
  version: number;
  entityType: string;
  geometry: unknown | null;
  properties: Record<string, unknown> | null;
  isDeleted: boolean;
  updatedByNode: string | null;
  createdAt: Date;
}

export interface EntityHistoryService {
  listVersions(entityId: string): Promise<EntityVersionDto[]>;
  restoreVersion(entityId: string, version: number): Promise<void>;
  duplicateFromVersion(entityId: string, version: number, name: string | null): Promise<string>;
}

export interface EntityHistoryServiceDeps {
  historyRepository: HistoryRepository;
  unitOfWork: UnitOfWork;
  nodeName: string;
  backupLimit: number;
  logger: AppLogger;
}

const toDto = (row: EntityBackupRow): EntityVersionDto => ({
  entityId: row.route_id,
  version: Number(row.version),
  entityType: row.entity_type,
  geometry: row.geometry ?? null,
  properties: row.properties,
  isDeleted: row.is_deleted,
  updatedByNode: row.updated_by_node,
  createdAt: row.created_at,
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
  backupLimit,
  logger,
}: EntityHistoryServiceDeps): EntityHistoryService => ({
  listVersions: async (entityId) => {
    const rows = await historyRepository.listVersions(entityId, backupLimit);
    return rows.map(toDto);
  },

  restoreVersion: (entityId, version) =>
    unitOfWork.run(async (context) => {
      const restored = await historyRepository.restoreVersion(entityId, version, nodeName, context);
      if (!restored) {
        throw new NotFoundError(ERROR_MESSAGES.ENTITY_BACKUP_NOT_FOUND(entityId, version));
      }
      logger.info({ entityId, version }, 'Restored entity to an earlier version');
    }),

  duplicateFromVersion: (entityId, version, name) =>
    unitOfWork.run(async (context) => {
      const createdId = await historyRepository.duplicateFromVersion(entityId, version, name, nodeName, context);
      if (!createdId) {
        throw new NotFoundError(ERROR_MESSAGES.ENTITY_BACKUP_NOT_FOUND(entityId, version));
      }
      logger.info({ entityId, version, createdId }, 'Created a new entity from an earlier version');
      return createdId;
    }),
});
