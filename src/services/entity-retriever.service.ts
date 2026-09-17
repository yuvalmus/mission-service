import { EntityType } from 'constants/entity.constants';
import { AnyEntity } from 'models/entity-union.models';
import { EntityRepository } from 'repositories/entity.repository';
import { AppLogger } from 'utils/logger.util';

export interface EntityRetrieverService {
  findEntity(id: string): Promise<AnyEntity | null>;
  findEntityOfType<T extends AnyEntity>(entityType: EntityType, id: string): Promise<T | null>;
}

export interface EntityRetrieverServiceDeps {
  entityRepository: EntityRepository;
  logger: AppLogger;
}

export const createEntityRetrieverService = ({
  entityRepository,
  logger,
}: EntityRetrieverServiceDeps): EntityRetrieverService => {
  const findEntity = (id: string): Promise<AnyEntity | null> => entityRepository.findById(id);

  return {
    findEntity,

    findEntityOfType: async <T extends AnyEntity>(entityType: EntityType, id: string): Promise<T | null> => {
      logger.debug({ entityType, id }, 'Attempting to get entity');
      const entity = await findEntity(id);
      if (!entity || entity.entityType !== entityType) return null;
      return entity as T;
    },
  };
};
