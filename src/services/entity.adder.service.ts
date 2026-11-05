import { Entity } from 'models/entity.union.models';
import { EntityRepository } from 'repositories/entity.repository.interface';
import { TransactionContext } from 'database/database.types';
import { BadRequestError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { CommonActionsService } from 'services/common.actions.service';
import { AppLogger } from 'utils/logger.util';

export interface EntityAdderService {
  addEntity<T extends Entity>(
    entity: T,
    parentId: string,
    context?: TransactionContext
  ): Promise<T>;
}

export interface EntityAdderServiceDeps {
  entityRepository: EntityRepository;
  commonActions: CommonActionsService;
  logger: AppLogger;
}

export const createEntityAdderService = ({
  entityRepository,
  commonActions,
  logger
}: EntityAdderServiceDeps): EntityAdderService => {
  const addEntity = async <T extends Entity>(
    entity: T,
    parentId: string,
    context?: TransactionContext
  ): Promise<T> => {
    logger.info({ entityType: entity.entityType, parentId }, 'Attempting to add an entity');

    if (!entity.name.trim()) {
      throw new BadRequestError(ERROR_MESSAGES.EMPTY_ENTITY_NAME(entity.entityType, entity.id));
    }
    await commonActions.validateParentExists(parentId);

    const isNameExists = await entityRepository.isNameExists(parentId, entity.id, entity.name);
    if (isNameExists) {
      throw new BadRequestError(
        ERROR_MESSAGES.ENTITY_NAME_EXISTS(entity.entityType, entity.name, parentId)
      );
    }

    await entityRepository.insert(entity, context);
    await commonActions.bumpParentVersion(parentId, context);
    return entity;
  };

  return {
    addEntity
  };
};
