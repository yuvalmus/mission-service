import { randomUUID } from 'node:crypto';
import { Mission, MissionBase, MISSION_CONSTANTS } from 'models/mission.models';
import { Entity } from 'models/entity.union.models';
import { Route } from 'models/route.models';
import { CreateMissionDto, MissionDto, UpdateMissionDto } from 'dtos/mission.dtos';
import { MissionRepository } from 'repositories/mission.repository.interface';
import { EntityRepository } from 'repositories/entity.repository.interface';
import { TransactionContext, UnitOfWork } from 'database/database.types';
import { BadRequestError, NotFoundError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { NAME_GENERATION } from 'constants/app.constants';
import {
  ENTITY_NAME_PREFIXES,
  ENTITY_TYPES,
  MISSION_LAYER_ENTITY_CATEGORIES,
  MissionLayer
} from 'constants/entity.constants';
import {
  MissionWithEntities,
  applyUpdateDto,
  createDtoToMission,
  isMissionUnchanged,
  missionEntitiesFromDto,
  missionFromDto
} from 'mappers/mission.mapper';
import { cloneEntityToMission } from 'mappers/common.entity.mapper';
import { generateNames, parenthesesFormatter, plainFormatter } from 'utils/name.generator.util';
import { CommonActionsService } from 'services/common.actions.service';
import { RouteService } from 'services/route.service';
import { AppLogger } from 'utils/logger.util';

export interface MissionService {
  createMission(incomingMission: CreateMissionDto): Promise<Mission>;
  findMission(id: string): Promise<Mission | null>;
  findMissionEntities(id: string): Promise<Entity[]>;
  updateMission(incomingMission: UpdateMissionDto): Promise<Mission>;
  deleteMission(id: string): Promise<boolean>;
  cloneMission(id: string): Promise<Mission>;
  mergeMission(
    currentId: string,
    mergedId: string,
    layers: MissionLayer[]
  ): Promise<Mission | null>;
  createMissionList(missionDtos: MissionDto[]): Promise<MissionWithEntities[]>;
  addEntities(entities: Entity[], parentId: string, context?: TransactionContext): Promise<void>;
  retrieveAll(): Promise<MissionBase[]>;
  retrieveAllInList(ids: readonly string[]): Promise<MissionWithEntities[]>;
  searchMissionsByName(name: string): Promise<MissionBase[]>;
  generateNextEntityNames(missionId: string, amount: number, prefix: string): Promise<string[]>;
  generateNextMissionName(clonedMissionName?: string): Promise<string>;
}

export interface MissionServiceDeps {
  missionRepository: MissionRepository;
  entityRepository: EntityRepository;
  routeService: RouteService;
  commonActions: CommonActionsService;
  unitOfWork: UnitOfWork;
  logger: AppLogger;
}

const entityMatchesLayer = (entity: Entity, layer: MissionLayer): boolean =>
  MISSION_LAYER_ENTITY_CATEGORIES[layer]?.[entity.entityType]?.includes(entity.category) ?? false;

const entityMatchesAnyLayer = (entity: Entity, layers: readonly MissionLayer[]): boolean =>
  layers.some(layer => entityMatchesLayer(entity, layer));

export const createMissionService = ({
  missionRepository,
  entityRepository,
  routeService,
  commonActions,
  unitOfWork,
  logger
}: MissionServiceDeps): MissionService => {
  const validateMissionName = async (missionId: string, name: string): Promise<void> => {
    if (!name.trim()) {
      throw new BadRequestError(ERROR_MESSAGES.EMPTY_MISSION_NAME);
    }

    const existingId = await missionRepository.findIdByName(name);
    if (existingId && existingId !== missionId) {
      throw new BadRequestError(ERROR_MESSAGES.MISSION_NAME_EXISTS(name));
    }
  };

  const generateNextMissionName = async (clonedMissionName?: string): Promise<string> => {
    const missionNames = await missionRepository.findAllNames();
    const prefix = clonedMissionName ?? NAME_GENERATION.MISSION_PREFIX;
    const format = clonedMissionName ? parenthesesFormatter : plainFormatter;
    const [name] = generateNames(missionNames, prefix, 1, format);
    return name as string;
  };

  const findMissionEntities = async (id: string): Promise<Entity[]> => {
    const entities = await entityRepository.findByParentId(id);
    if (entities.length === 0) {
      logger.warn({ missionId: id }, 'Mission has no entities');
    }
    return entities;
  };

  const addEntities = async (
    entities: Entity[],
    parentId: string,
    transactionContext?: TransactionContext
  ): Promise<void> => {
    const routes = entities.filter(
      (entity): entity is Route => entity.entityType === ENTITY_TYPES.ROUTE
    );
    const nonRoutes = entities.filter(entity => entity.entityType !== ENTITY_TYPES.ROUTE);

    await Promise.all(
      nonRoutes.map(async entity => {
        await entityRepository.insert({ ...entity, parentId }, transactionContext);
        await commonActions.bumpParentVersion(parentId, transactionContext);
      })
    );

    for (const route of routes) {
      const routeDto = await routeService.cloneRoute({ ...route, parentId });
      await routeService.addRoute(routeDto, parentId, transactionContext);
    }
  };
  const getSplitMission = async (incomingMissions: MissionDto[]) => {
    const uniqueIds = new Set(incomingMissions.map(missionDto => missionDto.id));
    const uniqueNames = new Set(incomingMissions.map(missionDto => missionDto.name));
    if (
      uniqueIds.size !== incomingMissions.length ||
      uniqueNames.size !== incomingMissions.length
    ) {
      throw new BadRequestError(ERROR_MESSAGES.DUPLICATE_MISSIONS_IN_LIST);
    }

    const existingNames = await missionRepository.findAllNames();
    const splitMission: MissionWithEntities[] = [];

    for (const fullMission of incomingMissions) {
      const missionInfo = missionFromDto(fullMission);
      const entities = missionEntitiesFromDto(fullMission);
      const name = existingNames.includes(fullMission.name)
        ? await generateNextMissionName(fullMission.name)
        : missionInfo.name;
      splitMission.push({ mission: { ...missionInfo, name }, entities });
    }
    return splitMission;
  };
  const cloneMissionEntities = async (
    sourceEntities: Entity[],
    targetMissionId: string,
    transactionContext?: TransactionContext
  ): Promise<void> => {
    const clonedEntities = sourceEntities.map(entity =>
      cloneEntityToMission(entity, targetMissionId)
    );
    await addEntities(clonedEntities, targetMissionId, transactionContext);
    logger.info({ missionId: targetMissionId }, 'Cloned mission entities successfully');
  };

  const createMission = async (incomingMission: CreateMissionDto): Promise<Mission> => {
    const mission = createDtoToMission(incomingMission);
    await validateMissionName(mission.id, mission.name);
    await missionRepository.create(mission);
    logger.info({ missionId: mission.id }, 'Mission created');
    return mission;
  };

  const findMission = async (id: string): Promise<Mission | null> => {
    const mission = await missionRepository.findById(id);
    if (!mission) {
      logger.warn({ missionId: id }, 'Mission was not found');
    }
    return mission;
  };

  const updateMission = async (incomingMission: UpdateMissionDto): Promise<Mission> => {
    const mission = await missionRepository.findById(incomingMission.id);
    if (!mission) {
      throw new BadRequestError(ERROR_MESSAGES.MISSION_NOT_FOUND);
    }
    await validateMissionName(incomingMission.id, incomingMission.name);

    if (isMissionUnchanged(mission, incomingMission)) {
      logger.info({ missionId: mission.id }, 'Mission update skipped, nothing changed');
      return mission;
    }

    const updated = await missionRepository.update(applyUpdateDto(mission, incomingMission));
    logger.info({ missionId: mission.id }, 'Mission updated');
    return updated;
  };

  const deleteMission = (id: string): Promise<boolean> =>
    unitOfWork.run(async transactionContext => {
      const mission = await missionRepository.findById(id);
      if (!mission) {
        throw new BadRequestError(ERROR_MESSAGES.MISSION_NOT_FOUND);
      }
      const entitiesDeleted = await entityRepository.deleteByParentId(id, transactionContext);
      const missionDeleted = await missionRepository.delete(id, transactionContext);
      logger.info({ missionId: id }, 'Mission deleted');
      return missionDeleted && entitiesDeleted;
    });

  const cloneMission = async (id: string): Promise<Mission> => {
    logger.info({ missionId: id }, 'Attempting to clone a mission');
    const sourceMission = await findMission(id);
    if (!sourceMission) {
      throw new NotFoundError(ERROR_MESSAGES.MISSION_NOT_FOUND);
    }
    const sourceEntities = await findMissionEntities(id);

    const cloned: Mission = {
      ...sourceMission,
      id: randomUUID(),
      name: await generateNextMissionName(sourceMission.name),
      versionNumber: MISSION_CONSTANTS.BASE_VERSION_NUMBER
    };
    await missionRepository.create(cloned);
    await cloneMissionEntities(sourceEntities, cloned.id);
    logger.info({ sourceMissionId: id, clonedMissionId: cloned.id }, 'Mission cloned');

    return (await findMission(cloned.id)) as Mission;
  };

  const mergeMission = async (
    currentId: string,
    mergedId: string,
    layers: MissionLayer[]
  ): Promise<Mission | null> => {
    logger.info({ currentId, mergedId, layers }, 'Attempting to merge missions');
    const targetMission = await findMission(currentId);
    const sourceMission = await findMission(mergedId);

    if (targetMission && sourceMission) {
      const targetEntities = await findMissionEntities(currentId);
      const sourceEntities = await findMissionEntities(mergedId);

      const entitiesToDelete = targetEntities.filter(entity =>
        entityMatchesAnyLayer(entity, layers)
      );

      const remainingNames = targetEntities.map(entity => entity.name);
      entitiesToDelete.forEach(entity => {
        const nameIndex = remainingNames.indexOf(entity.name);
        if (nameIndex >= 0) remainingNames.splice(nameIndex, 1);
      });

      const entitiesToAdd: Entity[] = [];
      sourceEntities
        .filter(entity => entityMatchesAnyLayer(entity, layers))
        .forEach(entity => {
          const name = remainingNames.includes(entity.name)
            ? (generateNames(
                remainingNames,
                ENTITY_NAME_PREFIXES[entity.entityType],
                1
              )[0] as string)
            : entity.name;
          entitiesToAdd.push(cloneEntityToMission({ ...entity, name }, currentId));
          remainingNames.push(name);
        });

      await Promise.all(
        entitiesToDelete.map(async entity => {
          await entityRepository.deleteById(entity.id);
          await commonActions.bumpParentVersion(currentId);
        })
      );
      await addEntities(entitiesToAdd, currentId);
      logger.info(
        { currentId, mergedId, deleted: entitiesToDelete.length, added: entitiesToAdd.length },
        'Missions merged'
      );
    }

    return findMission(currentId);
  };

  const createMissionList = async (
    incomingMissions: MissionDto[]
  ): Promise<MissionWithEntities[]> => {
    logger.info({ count: incomingMissions.length }, 'Attempting to create a mission list');
    const splitMission = await getSplitMission(incomingMissions);

    const created = await unitOfWork.run(async transactionContext => {
      for (const { mission, entities } of splitMission) {
        const cloned: Mission = { ...mission, id: randomUUID() };
        await missionRepository.create(cloned, transactionContext);

        const originalWpts = entities.filter(
          entity => entity.entityType === ENTITY_TYPES.NAVIGATION_WAY_POINT
        );
        await Promise.all(
          originalWpts.map(async wpt => {
            await entityRepository.insert({ ...wpt, parentId: cloned.id }, transactionContext);
            await commonActions.bumpParentVersion(cloned.id, transactionContext);
          })
        );

        await cloneMissionEntities(
          entities.map(entity => ({ ...entity, parentId: cloned.id })),
          cloned.id,
          transactionContext
        );

        await Promise.all(
          originalWpts.map(async wpt => {
            await entityRepository.deleteById(wpt.id, transactionContext);
            await commonActions.bumpParentVersion(cloned.id, transactionContext);
          })
        );
      }

      return splitMission;
    });
    logger.info({ count: created.length }, 'Mission list created');
    return created;
  };

  const retrieveAll =(): Promise<MissionBase[]> => missionRepository.findAllBasic();

  const retrieveAllInList = async (
    ids: readonly string[]
  ): Promise<MissionWithEntities[]> => {
    const missions = await missionRepository.findByIds(ids);
    const foundIds = new Set(missions.map(mission => mission.id));
    const missingIds = ids.filter(id => !foundIds.has(id));
    if (missingIds.length > 0) {
      logger.warn({ missingIds }, 'Some of the requested missions were not found');
    }
    return Promise.all(
      missions.map(async mission => ({
        mission,
        entities: await entityRepository.findByParentId(mission.id)
      }))
    );
  };

  const searchMissionsByName = (name: string): Promise<MissionBase[]> =>
    missionRepository.searchByName(name);

  const generateNextEntityNames = async (
    missionId: string,
    amount: number,
    prefix: string
  ): Promise<string[]> => {
    const mission = await missionRepository.findById(missionId);
    if (!mission) {
      throw new NotFoundError(ERROR_MESSAGES.MISSION_NOT_FOUND);
    }
    const names = await entityRepository.findNamesByParentId(missionId);
    const result = generateNames(names, prefix, amount);
    logger.info({ amount, missionId }, 'Successfully generated next entity names');
    return result;
  };

  return {
    createMission,
    findMission,
    findMissionEntities,
    updateMission,
    deleteMission,
    cloneMission,
    mergeMission,
    createMissionList,
    addEntities,
    retrieveAll,
    retrieveAllInList,
    searchMissionsByName,
    generateNextEntityNames,
    generateNextMissionName
  };
};
