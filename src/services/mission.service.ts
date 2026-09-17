import { randomUUID } from 'node:crypto';
import { Mission, MissionBase, MISSION_CONSTANTS } from 'models/mission.models';
import { AnyEntity } from 'models/entity-union.models';
import { Route } from 'models/route.models';
import { CreateMissionDto, MissionDto, UpdateMissionDto } from 'dtos/mission.dtos';
import { MissionRepository } from 'repositories/mission.repository';
import { EntityRepository } from 'repositories/entity.repository';
import { UnitOfWork } from 'database/database.types';
import { BadRequestError, NotFoundError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { NAME_GENERATION } from 'constants/app.constants';
import {
  ENTITY_NAME_PREFIXES,
  ENTITY_TYPES,
  MISSION_LAYER_ENTITY_CATEGORIES,
  MissionLayer,
} from 'constants/entity.constants';
import {
  MissionWithEntities,
  applyUpdateDto,
  createDtoToMission,
  isMissionUnchanged,
  missionFromDto,
} from 'mappers/mission.mapper';
import { cloneEntityToMission } from 'mappers/entity.mapper';
import { generateNames, parenthesesFormatter, plainFormatter } from 'utils/name-generator.util';
import { CommonActionsService } from 'services/common-actions.service';
import { RouteService } from 'services/route.service';
import { AppLogger } from 'utils/logger.util';

export interface MissionService {
  createMission(dto: CreateMissionDto): Promise<Mission>;
  findMission(id: string): Promise<Mission | null>;
  findMissionWithEntities(id: string): Promise<MissionWithEntities | null>;
  updateMission(dto: UpdateMissionDto): Promise<Mission>;
  deleteMission(id: string): Promise<boolean>;
  cloneMission(id: string): Promise<MissionWithEntities>;
  mergeMission(currentId: string, mergedId: string, layers: MissionLayer[]): Promise<MissionWithEntities | null>;
  importMissions(missionDtos: MissionDto[]): Promise<MissionWithEntities[]>;
  addEntities(entities: AnyEntity[], parentId: string): Promise<void>;
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

const entityMatchesLayer = (entity: AnyEntity, layer: MissionLayer): boolean =>
  MISSION_LAYER_ENTITY_CATEGORIES[layer]?.[entity.entityType]?.includes(entity.category) ?? false;

const entityMatchesAnyLayer = (entity: AnyEntity, layers: readonly MissionLayer[]): boolean =>
  layers.some((layer) => entityMatchesLayer(entity, layer));

export const createMissionService = ({
  missionRepository,
  entityRepository,
  routeService,
  commonActions,
  unitOfWork,
  logger,
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

  const findMissionWithEntities = async (id: string): Promise<MissionWithEntities | null> => {
    const mission = await missionRepository.findById(id);
    if (!mission) {
      logger.warn({ missionId: id }, 'Mission was not found');
      return null;
    }
    const entities = await entityRepository.findByParentId(id);
    return { mission, entities };
  };

  const addEntities = async (entities: AnyEntity[], parentId: string): Promise<void> => {
    const routes = entities.filter((entity): entity is Route => entity.entityType === ENTITY_TYPES.ROUTE);
    const nonRoutes = entities.filter((entity) => entity.entityType !== ENTITY_TYPES.ROUTE);

    await Promise.all(
      nonRoutes.map(async (entity) => {
        await entityRepository.insert({ ...entity, parentId });
        await commonActions.bumpParentVersion(parentId);
      }),
    );

    for (const route of routes) {
      const routeDto = await routeService.cloneRoute({ ...route, parentId });
      await routeService.addRoute(routeDto, parentId);
    }
  };

  const cloneMissionEntities = async (sourceEntities: AnyEntity[], targetMissionId: string): Promise<void> => {
    const clonedEntities = sourceEntities.map((entity) => cloneEntityToMission(entity, targetMissionId));
    await addEntities(clonedEntities, targetMissionId);
    logger.info({ missionId: targetMissionId }, 'Cloned mission entities successfully');
  };

  return {
    createMission: async (dto) => {
      const mission = createDtoToMission(dto);
      await validateMissionName(mission.id, mission.name);
      await missionRepository.create(mission);
      logger.info({ missionId: mission.id }, 'Mission created');
      return mission;
    },

    findMission: (id) => missionRepository.findById(id),

    findMissionWithEntities,

    updateMission: async (dto) => {
      const mission = await missionRepository.findById(dto.id);
      if (!mission) {
        throw new BadRequestError(ERROR_MESSAGES.MISSION_NOT_FOUND);
      }
      await validateMissionName(dto.id, dto.name);

      if (isMissionUnchanged(mission, dto)) {
        return mission;
      }

      return missionRepository.update(applyUpdateDto(mission, dto));
    },

    deleteMission: (id) =>
      unitOfWork.run(async (context) => {
        const mission = await missionRepository.findById(id);
        if (!mission) {
          throw new BadRequestError(ERROR_MESSAGES.MISSION_NOT_FOUND);
        }
        const entitiesDeleted = await entityRepository.deleteByParentId(id, context);
        const missionDeleted = await missionRepository.delete(id, context);
        logger.info({ missionId: id }, 'Mission deleted');
        return missionDeleted && entitiesDeleted;
      }),

    cloneMission: async (id) => {
      const source = await findMissionWithEntities(id);
      if (!source) {
        throw new NotFoundError(ERROR_MESSAGES.MISSION_NOT_FOUND);
      }

      const cloned: Mission = {
        ...source.mission,
        id: randomUUID(),
        name: await generateNextMissionName(source.mission.name),
        versionNumber: MISSION_CONSTANTS.BASE_VERSION_NUMBER,
      };
      await missionRepository.create(cloned);
      await cloneMissionEntities(source.entities, cloned.id);
      return (await findMissionWithEntities(cloned.id)) as MissionWithEntities;
    },

    mergeMission: async (currentId, mergedId, layers) => {
      const current = await findMissionWithEntities(currentId);
      const merged = await findMissionWithEntities(mergedId);

      if (current && merged) {
        const entitiesToDelete = current.entities.filter((entity) => entityMatchesAnyLayer(entity, layers));

        const remainingNames = current.entities.map((entity) => entity.name);
        entitiesToDelete.forEach((entity) => {
          const nameIndex = remainingNames.indexOf(entity.name);
          if (nameIndex >= 0) remainingNames.splice(nameIndex, 1);
        });

        const entitiesToAdd: AnyEntity[] = [];
        merged.entities
          .filter((entity) => entityMatchesAnyLayer(entity, layers))
          .forEach((entity) => {
            const name = remainingNames.includes(entity.name)
              ? (generateNames(remainingNames, ENTITY_NAME_PREFIXES[entity.entityType], 1)[0] as string)
              : entity.name;
            entitiesToAdd.push(cloneEntityToMission({ ...entity, name }, currentId));
            remainingNames.push(name);
          });

        await Promise.all(
          entitiesToDelete.map(async (entity) => {
            await entityRepository.deleteById(entity.id);
            await commonActions.bumpParentVersion(currentId);
          }),
        );
        await addEntities(entitiesToAdd, currentId);
      }

      return findMissionWithEntities(currentId);
    },

    importMissions: async (missionDtos) => {
      const uniqueIds = new Set(missionDtos.map((dto) => dto.id));
      const uniqueNames = new Set(missionDtos.map((dto) => dto.name));
      if (uniqueIds.size !== missionDtos.length || uniqueNames.size !== missionDtos.length) {
        throw new BadRequestError(ERROR_MESSAGES.DUPLICATE_MISSIONS_IN_LIST);
      }

      const existingNames = await missionRepository.findAllNames();
      const imported: MissionWithEntities[] = [];

      for (const dto of missionDtos) {
        const { mission, entities } = missionFromDto(dto);
        const name = existingNames.includes(dto.name)
          ? await generateNextMissionName(dto.name)
          : mission.name;
        imported.push({ mission: { ...mission, name }, entities });
      }

      for (const { mission, entities } of imported) {
        const cloned: Mission = { ...mission, id: randomUUID() };
        await missionRepository.create(cloned);

        const originalWpts = entities.filter((entity) => entity.entityType === ENTITY_TYPES.NAVIGATION_WAY_POINT);
        await Promise.all(
          originalWpts.map(async (wpt) => {
            await entityRepository.insert({ ...wpt, parentId: cloned.id });
            await commonActions.bumpParentVersion(cloned.id);
          }),
        );

        await cloneMissionEntities(
          entities.map((entity) => ({ ...entity, parentId: cloned.id })),
          cloned.id,
        );

        await Promise.all(
          originalWpts.map(async (wpt) => {
            await entityRepository.deleteById(wpt.id);
            await commonActions.bumpParentVersion(cloned.id);
          }),
        );
      }

      return imported;
    },

    addEntities,

    retrieveAll: () => missionRepository.findAllBasic(),

    retrieveAllInList: async (ids) => {
      const missions = await missionRepository.findByIds(ids);
      return Promise.all(
        missions.map(async (mission) => ({
          mission,
          entities: await entityRepository.findByParentId(mission.id),
        })),
      );
    },

    searchMissionsByName: (name) => missionRepository.searchByName(name),

    generateNextEntityNames: async (missionId, amount, prefix) => {
      const mission = await missionRepository.findById(missionId);
      if (!mission) {
        throw new NotFoundError(ERROR_MESSAGES.MISSION_NOT_FOUND);
      }
      const names = await entityRepository.findNamesByParentId(missionId);
      const result = generateNames(names, prefix, amount);
      logger.info({ amount, missionId }, 'Successfully generated next entity names');
      return result;
    },

    generateNextMissionName,
  };
};
