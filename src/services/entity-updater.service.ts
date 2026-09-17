import { ENTITY_TYPES, EntityType } from 'constants/entity.constants';
import { AnyEntity } from 'models/entity-union.models';
import { Route } from 'models/route.models';
import { BasicEntityDto, UpdateBasicEntitiesDto, UpdateBasicEntityDto } from 'dtos/entity.dtos';
import { EntityRepository } from 'repositories/entity.repository';
import { TransactionContext } from 'database/database.types';
import { BadRequestError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { getEntityDefinition } from 'mappers/entity.registry';
import { toBasicEntityDto, withUpdatedTimestamp } from 'mappers/entity.mapper';
import { CommonActionsService } from 'services/common-actions.service';
import { EntityRetrieverService } from 'services/entity-retriever.service';
import { RouteWptService } from 'services/route-wpt.service';
import { AppLogger } from 'utils/logger.util';

export interface UpdateEntityByTypeDto {
  id: string;
  parentId: string;
}

export interface EntityUpdaterService {
  updateEntity<T extends AnyEntity>(
    parentId: string,
    entity: T,
    context?: TransactionContext
  ): Promise<T>;
  updateByType(entityType: EntityType, dto: UpdateEntityByTypeDto): Promise<AnyEntity>;
  changeEntityVisibility(updateDto: UpdateBasicEntityDto): Promise<BasicEntityDto>;
  changeEntitiesVisibility(updateDto: UpdateBasicEntitiesDto): Promise<BasicEntityDto[]>;
}

export interface EntityUpdaterServiceDeps {
  entityRepository: EntityRepository;
  entityRetriever: EntityRetrieverService;
  commonActions: CommonActionsService;
  routeWptService: RouteWptService;
  logger: AppLogger;
}

export const createEntityUpdaterService = ({
  entityRepository,
  entityRetriever,
  commonActions,
  routeWptService,
  logger
}: EntityUpdaterServiceDeps): EntityUpdaterService => {
  const updateEntity = async <T extends AnyEntity>(
    parentId: string,
    entity: T,
    context?: TransactionContext
  ): Promise<T> => {
    if (!entity.name.trim()) {
      throw new BadRequestError(ERROR_MESSAGES.EMPTY_ENTITY_NAME(entity.entityType, entity.id));
    }
    await commonActions.validateParentExists(parentId);

    const isNameTaken = await entityRepository.isNameTaken(parentId, entity.id, entity.name);
    if (isNameTaken) {
      throw new BadRequestError(
        ERROR_MESSAGES.ENTITY_UPDATE_NAME_EXISTS(entity.entityType, entity.name, entity.parentId)
      );
    }

    await entityRepository.update(entity, context);
    await commonActions.bumpParentVersion(entity.parentId, context);
    return entity;
  };

  const changeRouteWptsVisibility = async (updateDto: UpdateBasicEntityDto): Promise<void> => {
    if (updateDto.entity) {
      const route = await entityRetriever.findEntityOfType<Route>(
        ENTITY_TYPES.ROUTE,
        updateDto.entity.general.id
      );
      if (!route) {
        throw new BadRequestError(
          ERROR_MESSAGES.CHANGE_VISIBILITY_MISSING_ENTITY(updateDto.entity.general.id)
        );
      }
      const wptDtos = await routeWptService.getRouteWptsAsBasicDtos(route);
      await changeEntitiesVisibility({ entities: wptDtos, isVisible: updateDto.isVisible });
    }
  };

  const changeEntityVisibility = async (
    updateDto: UpdateBasicEntityDto
  ): Promise<BasicEntityDto> => {
    const entityDto = updateDto.entity;
    logger.info({ name: entityDto?.general.name }, 'Attempting to change entity visibility');
    try {
      if (entityDto?.entityType === ENTITY_TYPES.ROUTE) {
        await changeRouteWptsVisibility(updateDto);
      }
      const entity = entityDto && (await entityRetriever.findEntity(entityDto.general.id));
      if (!entity) {
        throw new BadRequestError(
          ERROR_MESSAGES.CHANGE_VISIBILITY_MISSING_ENTITY(entityDto ? entityDto.general.id : '')
        );
      }
      const updated = withUpdatedTimestamp({
        ...entity,
        isVisible: updateDto.isVisible ?? entity.isVisible
      });
      await updateEntity(entity.parentId, updated);
      return toBasicEntityDto(updated);
    } catch (error) {
      throw new BadRequestError(
        `${ERROR_MESSAGES.CHANGE_VISIBILITY_ENTITY_FAILED(entityDto ? entityDto.general.name : '')}: ${(error as Error).message}`
      );
    }
  };

  const changeEntitiesVisibility = async (
    updateDto: UpdateBasicEntitiesDto
  ): Promise<BasicEntityDto[]> => {
    logger.info(
      { count: updateDto?.entities?.length },
      'Attempting to change visibility for entity list'
    );
    try {
      if (updateDto.entities)
        return await Promise.all(
          updateDto.entities.map(entity =>
            changeEntityVisibility({ entity, isVisible: updateDto.isVisible })
          )
        );
      throw BadRequestError;
    } catch (error) {
      throw new BadRequestError(
        `${ERROR_MESSAGES.CHANGE_VISIBILITY_LIST_FAILED}: ${(error as Error).message}`
      );
    }
  };

  return {
    updateEntity,

    updateByType: async (entityType, dto) => {
      logger.info(
        { entityType, id: dto.id, parentId: dto.parentId },
        'Attempting to update entity'
      );
      const definition = getEntityDefinition(entityType);
      const entity = await entityRetriever.findEntityOfType(entityType, dto.id);
      if (!entity) {
        throw new BadRequestError(
          ERROR_MESSAGES.ENTITY_UPDATE_NOT_FOUND(entityType, dto.id, dto.parentId)
        );
      }
      const updated = definition.applyUpdate(entity, dto);
      return updateEntity(dto.parentId, updated);
    },

    changeEntityVisibility,
    changeEntitiesVisibility
  };
};
