import { EntityType } from 'constants/entity.constants';
import { Entity } from 'models/entity.union.models';
import { EntityRepository } from 'repositories/entity.repository.interface';
import { AppLogger } from 'utils/logger.util';

export interface EntityRetrieverService {
  findEntity(id: string): Promise<Entity | null>;
  findEntityOfType<T extends Entity>(entityType: EntityType, id: string): Promise<T | null>;
}

export interface EntityRetrieverServiceDeps {
  entityRepository: EntityRepository;
  logger: AppLogger;
}

export const createEntityRetrieverService = ({
  entityRepository,
  logger
}: EntityRetrieverServiceDeps): EntityRetrieverService => {
  const findEntity = (id: string): Promise<Entity | null> => entityRepository.findById(id);

  const findEntityOfType = async <T extends Entity>(
    entityType: EntityType,
    id: string
  ): Promise<T | null> => {
    logger.info({ entityType, id }, 'Attempting to get entity');
    const entity = await findEntity(id);
    if (!entity || entity.entityType !== entityType) return null;
    return entity as T;
  };

  return {
    findEntity,
    findEntityOfType
  };
};
