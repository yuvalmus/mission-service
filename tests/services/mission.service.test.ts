import { createMissionService, MissionService } from 'services/mission.service';
import { BadRequestError, NotFoundError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { NAME_GENERATION } from 'constants/app.constants';
import {
  MISSION_ID,
  MISSION_NAME,
  OTHER_MISSION_ID,
  buildCreateMissionDto,
  buildMission,
  buildMissionBase,
  buildUpdateMissionDto,
  createCommonActionsMock,
  createEntityRepositoryMock,
  createLoggerMock,
  createMissionRepositoryMock,
  createRouteServiceMock,
  createUnitOfWorkMock,
} from '../fixtures/mission.fixtures';
import { buildCircle, buildRoute, buildWpt } from '../fixtures/entity.fixtures';

describe('mission.service', () => {
  const missionRepository = createMissionRepositoryMock();
  const entityRepository = createEntityRepositoryMock();
  const routeService = createRouteServiceMock();
  const commonActions = createCommonActionsMock();
  const unitOfWork = createUnitOfWorkMock();
  const logger = createLoggerMock();

  const service: MissionService = createMissionService({
    missionRepository,
    entityRepository,
    routeService,
    commonActions,
    unitOfWork,
    logger,
  });

  describe('createMission', () => {
    it('creates a mission with a generated id, base version and creation timestamps', async () => {
      missionRepository.findIdByName.mockResolvedValue(null);
      missionRepository.create.mockImplementation(async (mission) => mission);

      const created = await service.createMission(buildCreateMissionDto());

      expect(created.id).toEqual(expect.any(String));
      expect(created.versionNumber).toBe(1);
      expect(created.timeInfo?.dateCreated).toBeInstanceOf(Date);
    });

    it('rejects a name that already belongs to another mission', async () => {
      missionRepository.findIdByName.mockResolvedValue(OTHER_MISSION_ID);

      await expect(service.createMission(buildCreateMissionDto())).rejects.toThrow(
        ERROR_MESSAGES.MISSION_NAME_EXISTS(MISSION_NAME),
      );
      expect(missionRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an empty mission name', async () => {
      await expect(service.createMission(buildCreateMissionDto({ name: '   ' }))).rejects.toThrow(
        ERROR_MESSAGES.EMPTY_MISSION_NAME,
      );
    });
  });

  describe('updateMission', () => {
    it('short-circuits without persisting when nothing changed', async () => {
      missionRepository.findById.mockResolvedValue(buildMission());
      missionRepository.findIdByName.mockResolvedValue(MISSION_ID);

      const result = await service.updateMission(buildUpdateMissionDto());

      expect(result).toEqual(buildMission());
      expect(missionRepository.update).not.toHaveBeenCalled();
    });

    it('applies changes, bumps the version and refreshes lastUpdateTime', async () => {
      missionRepository.findById.mockResolvedValue(buildMission());
      missionRepository.findIdByName.mockResolvedValue(null);
      missionRepository.update.mockImplementation(async (mission) => mission);

      const result = await service.updateMission(buildUpdateMissionDto({ comment: 'changed' }));

      expect(result.comment).toBe('changed');
      expect(result.versionNumber).toBe(2);
      expect(result.timeInfo?.lastUpdateTime.getTime()).toBeGreaterThan(
        buildMission().timeInfo!.lastUpdateTime.getTime(),
      );
    });

    it('throws when the mission does not exist', async () => {
      missionRepository.findById.mockResolvedValue(null);

      await expect(service.updateMission(buildUpdateMissionDto())).rejects.toThrow(
        ERROR_MESSAGES.MISSION_NOT_FOUND,
      );
    });
  });

  describe('deleteMission', () => {
    it('deletes the mission and its entities inside a unit of work', async () => {
      missionRepository.findById.mockResolvedValue(buildMission());
      entityRepository.deleteByParentId.mockResolvedValue(true);
      missionRepository.delete.mockResolvedValue(true);

      const result = await service.deleteMission(MISSION_ID);

      expect(result).toBe(true);
      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(entityRepository.deleteByParentId).toHaveBeenCalledWith(MISSION_ID, {});
    });

    it('throws when the mission does not exist', async () => {
      missionRepository.findById.mockResolvedValue(null);

      await expect(service.deleteMission(MISSION_ID)).rejects.toThrow(ERROR_MESSAGES.MISSION_NOT_FOUND);
      expect(missionRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('cloneMission', () => {
    it('creates a copy with generated name, clones entities with new ids and bumps versions per entity', async () => {
      const sourceCircle = buildCircle();
      missionRepository.findById.mockImplementation(async (id) =>
        id === MISSION_ID ? buildMission() : buildMission({ id, name: `${MISSION_NAME}(1)` }),
      );
      entityRepository.findByParentId.mockResolvedValue([sourceCircle]);
      missionRepository.findAllNames.mockResolvedValue([MISSION_NAME]);
      missionRepository.create.mockImplementation(async (mission) => mission);
      entityRepository.insert.mockImplementation(async (entity) => entity);

      const { mission: cloned } = await service.cloneMission(MISSION_ID);

      expect(cloned.id).not.toBe(MISSION_ID);
      expect(cloned.name).toBe(`${MISSION_NAME}(1)`);
      expect(entityRepository.insert).toHaveBeenCalledTimes(1);
      const insertedCircle = entityRepository.insert.mock.calls[0]![0];
      expect(insertedCircle.id).not.toBe(sourceCircle.id);
      expect(commonActions.bumpParentVersion).toHaveBeenCalled();
    });

    it('clones routes through the route service for wpt remapping', async () => {
      const route = buildRoute();
      missionRepository.findById.mockResolvedValue(buildMission());
      entityRepository.findByParentId.mockResolvedValue([route]);
      missionRepository.findAllNames.mockResolvedValue([]);
      missionRepository.create.mockImplementation(async (mission) => mission);
      routeService.cloneRoute.mockResolvedValue({} as never);
      routeService.addRoute.mockResolvedValue(route);

      await service.cloneMission(MISSION_ID);

      expect(routeService.cloneRoute).toHaveBeenCalledTimes(1);
      expect(routeService.addRoute).toHaveBeenCalledTimes(1);
      expect(entityRepository.insert).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the source mission does not exist', async () => {
      missionRepository.findById.mockResolvedValue(null);

      await expect(service.cloneMission(MISSION_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('mergeMission', () => {
    it('replaces matching-layer entities of the current mission with clones from the merged mission', async () => {
      const currentWpt = buildWpt({ name: 'NV1' });
      const mergedWpt = buildWpt({ id: OTHER_MISSION_ID, name: 'NV2', parentId: OTHER_MISSION_ID });
      const currentMission = buildMission();
      const mergedMission = buildMission({ id: OTHER_MISSION_ID, name: 'Other' });

      missionRepository.findById.mockImplementation(async (id) =>
        id === MISSION_ID ? currentMission : mergedMission,
      );
      entityRepository.findByParentId.mockImplementation(async (parentId) =>
        parentId === MISSION_ID ? [currentWpt] : [mergedWpt],
      );
      entityRepository.deleteById.mockResolvedValue(true);
      entityRepository.insert.mockImplementation(async (entity) => entity);

      await service.mergeMission(MISSION_ID, OTHER_MISSION_ID, ['navigation']);

      expect(entityRepository.deleteById).toHaveBeenCalledWith(currentWpt.id);
      expect(entityRepository.insert).toHaveBeenCalledTimes(1);
      const inserted = entityRepository.insert.mock.calls[0]![0];
      expect(inserted.parentId).toBe(MISSION_ID);
      expect(inserted.id).not.toBe(mergedWpt.id);
    });

    it('renames merged entities whose names collide with entities that stay in the mission', async () => {
      // The surviving wpt (category User) is outside the UserItems layer, so the incoming
      // General circle with the same name must be renamed with the circle prefix.
      const survivingWpt = buildWpt({ name: 'C001' });
      const mergedCircle = buildCircle({ id: OTHER_MISSION_ID, name: 'C001', parentId: OTHER_MISSION_ID });

      missionRepository.findById.mockResolvedValue(buildMission());
      entityRepository.findByParentId.mockImplementation(async (parentId) =>
        parentId === MISSION_ID ? [survivingWpt] : [mergedCircle],
      );
      entityRepository.insert.mockImplementation(async (entity) => entity);

      await service.mergeMission(MISSION_ID, OTHER_MISSION_ID, ['userItems']);

      const inserted = entityRepository.insert.mock.calls[0]![0];
      expect(inserted.name).toBe('C002');
    });

    it('returns null (no merge) when one of the missions is missing', async () => {
      missionRepository.findById.mockResolvedValue(null);

      const result = await service.mergeMission(MISSION_ID, OTHER_MISSION_ID, ['navigation']);

      expect(result).toBeNull();
      expect(entityRepository.insert).not.toHaveBeenCalled();
    });
  });

  describe('importMissions', () => {
    it('rejects lists with duplicate mission ids or names', async () => {
      const dto = { id: MISSION_ID, name: MISSION_NAME } as never;

      await expect(service.importMissions([dto, dto])).rejects.toThrow(
        ERROR_MESSAGES.DUPLICATE_MISSIONS_IN_LIST,
      );
    });
  });

  describe('generateNextEntityNames', () => {
    it('generates padded names against the existing entity names of the mission', async () => {
      missionRepository.findById.mockResolvedValue(buildMission());
      entityRepository.findNamesByParentId.mockResolvedValue(['C001']);

      await expect(service.generateNextEntityNames(MISSION_ID, 2, 'C')).resolves.toEqual(['C002', 'C003']);
    });

    it('throws NotFoundError for an unknown mission', async () => {
      missionRepository.findById.mockResolvedValue(null);

      await expect(service.generateNextEntityNames(MISSION_ID, 1, 'C')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('generateNextMissionName', () => {
    it('generates the default Hebrew mission name when no clone source is given', async () => {
      missionRepository.findAllNames.mockResolvedValue([`${NAME_GENERATION.MISSION_PREFIX}1`]);

      await expect(service.generateNextMissionName()).resolves.toBe(`${NAME_GENERATION.MISSION_PREFIX}2`);
    });
  });

  describe('retrieval delegates', () => {
    it('retrieveAll returns basic missions from the repository', async () => {
      missionRepository.findAllBasic.mockResolvedValue([buildMissionBase()]);

      await expect(service.retrieveAll()).resolves.toEqual([buildMissionBase()]);
    });

    it('retrieveAllInList populates entities per mission', async () => {
      missionRepository.findByIds.mockResolvedValue([buildMission()]);
      entityRepository.findByParentId.mockResolvedValue([buildCircle()]);

      const results = await service.retrieveAllInList([MISSION_ID]);

      expect(results[0]!.entities).toHaveLength(1);
    });

    it('searchMissionsByName forwards the search term', async () => {
      missionRepository.searchByName.mockResolvedValue([]);

      await expect(service.searchMissionsByName('Alpha')).resolves.toEqual([]);
    });
  });
});
