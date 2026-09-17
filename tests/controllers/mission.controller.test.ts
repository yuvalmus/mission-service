import { Request } from 'express';
import { createMissionController, MissionController } from '@controllers/mission.controller';
import { MissionService } from '@services/mission.service';
import { MergeMissionDto, MissionIdParams, SearchNameParams } from '@dtos/mission.dtos';
import { HTTP_STATUS } from '@constants/http.constants';
import { BadRequestError } from '@errors/app.errors';
import { createHttpContext } from '../fixtures/express.fixtures';
import {
  MISSION_ID,
  MISSION_NAME,
  OTHER_MISSION_ID,
  buildCreateMissionDto,
  buildMission,
  buildMissionBase,
  buildUpdateMissionDto,
  createMissionServiceMock,
} from '../fixtures/mission.fixtures';
import { buildCircle } from '../fixtures/entity.fixtures';

describe('mission.controller', () => {
  const missionService: jest.Mocked<MissionService> = createMissionServiceMock();
  const controller: MissionController = createMissionController(missionService);

  describe('getMission', () => {
    it('returns 200 with the mission dto including grouped entities', async () => {
      missionService.findMissionWithEntities.mockResolvedValue({
        mission: buildMission(),
        entities: [buildCircle()],
      });
      const { req, res } = createHttpContext<Request<MissionIdParams>>({ params: { id: MISSION_ID } });

      await controller.getMission(req, res);

      expect(missionService.findMissionWithEntities).toHaveBeenCalledWith(MISSION_ID);
      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toMatchObject({ id: MISSION_ID, name: MISSION_NAME, versionNumber: 1 });
      expect(res._getJSONData().entities.circles).toHaveLength(1);
    });

    it('returns 404 when the mission does not exist', async () => {
      missionService.findMissionWithEntities.mockResolvedValue(null);
      const { req, res } = createHttpContext<Request<MissionIdParams>>({ params: { id: MISSION_ID } });

      await controller.getMission(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it('propagates service errors to the async error pipeline', async () => {
      missionService.findMissionWithEntities.mockRejectedValue(new Error('boom'));
      const { req, res } = createHttpContext<Request<MissionIdParams>>({ params: { id: MISSION_ID } });

      await expect(controller.getMission(req, res)).rejects.toThrow('boom');
    });
  });

  describe('getAllBasic', () => {
    it('returns 200 with all missions mapped to basic dtos', async () => {
      missionService.retrieveAll.mockResolvedValue([buildMissionBase()]);
      const { req, res } = createHttpContext();

      await controller.getAllBasic(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toHaveLength(1);
      expect(res._getJSONData()[0]).not.toHaveProperty('versionNumber');
    });
  });

  describe('getMissionsFromIds', () => {
    it('returns 200 with full mission dtos for the requested ids', async () => {
      missionService.retrieveAllInList.mockResolvedValue([{ mission: buildMission(), entities: [] }]);
      const { req, res } = createHttpContext({ body: [MISSION_ID, OTHER_MISSION_ID] });

      await controller.getMissionsFromIds(req, res);

      expect(missionService.retrieveAllInList).toHaveBeenCalledWith([MISSION_ID, OTHER_MISSION_ID]);
      expect(res._getJSONData()[0]).toHaveProperty('versionNumber');
      expect(res._getJSONData()[0]).toHaveProperty('entities');
    });
  });

  describe('createMission', () => {
    it('returns 200 with the created mission dto', async () => {
      missionService.createMission.mockResolvedValue(buildMission());
      const { req, res } = createHttpContext({ body: buildCreateMissionDto() });

      await controller.createMission(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toMatchObject({ name: MISSION_NAME });
    });

    it('rejects when the service throws a domain error', async () => {
      missionService.createMission.mockRejectedValue(new BadRequestError('duplicate'));
      const { req, res } = createHttpContext({ body: buildCreateMissionDto() });

      await expect(controller.createMission(req, res)).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  describe('updateMission', () => {
    it('returns 200 with the updated mission dto including entities', async () => {
      missionService.updateMission.mockResolvedValue(buildMission({ versionNumber: 2 }));
      missionService.findMissionWithEntities.mockResolvedValue({ mission: buildMission(), entities: [] });
      const { req, res } = createHttpContext({ body: buildUpdateMissionDto() });

      await controller.updateMission(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toMatchObject({ versionNumber: 2 });
    });
  });

  describe('deleteMission', () => {
    it('returns 200 when the mission was deleted', async () => {
      missionService.deleteMission.mockResolvedValue(true);
      const { req, res } = createHttpContext<Request<MissionIdParams>>({ params: { id: MISSION_ID } });

      await controller.deleteMission(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
    });

    it('returns 404 when nothing was deleted', async () => {
      missionService.deleteMission.mockResolvedValue(false);
      const { req, res } = createHttpContext<Request<MissionIdParams>>({ params: { id: MISSION_ID } });

      await controller.deleteMission(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    });
  });

  describe('cloneMission', () => {
    it('returns 200 with the cloned mission dto', async () => {
      const cloned = buildMission({ id: OTHER_MISSION_ID, name: `${MISSION_NAME}(1)` });
      missionService.cloneMission.mockResolvedValue({ mission: cloned, entities: [] });
      const { req, res } = createHttpContext<Request<MissionIdParams>>({ params: { id: MISSION_ID } });

      await controller.cloneMission(req, res);

      expect(missionService.cloneMission).toHaveBeenCalledWith(MISSION_ID);
      expect(res._getJSONData()).toMatchObject({ id: OTHER_MISSION_ID, name: `${MISSION_NAME}(1)` });
    });
  });

  describe('mergeMission', () => {
    const mergeBody: MergeMissionDto = {
      currentId: MISSION_ID,
      mergedId: OTHER_MISSION_ID,
      missionLayers: ['Navigation', 'not-a-layer'],
    };

    it('parses layers (unknown layers default to Navigation) and returns the merged mission', async () => {
      missionService.mergeMission.mockResolvedValue({ mission: buildMission(), entities: [] });
      const { req, res } = createHttpContext({ body: mergeBody });

      await controller.mergeMission(req, res);

      expect(missionService.mergeMission).toHaveBeenCalledWith(MISSION_ID, OTHER_MISSION_ID, [
        'Navigation',
        'Navigation',
      ]);
      expect(res.statusCode).toBe(HTTP_STATUS.OK);
    });

    it('returns 404 when the current mission does not exist', async () => {
      missionService.mergeMission.mockResolvedValue(null);
      const { req, res } = createHttpContext({ body: mergeBody });

      await controller.mergeMission(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    });
  });

  describe('importMissions', () => {
    it('returns 200 with the imported missions', async () => {
      missionService.importMissions.mockResolvedValue([{ mission: buildMission(), entities: [] }]);
      const { req, res } = createHttpContext({ body: [] });

      await controller.importMissions(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toHaveLength(1);
    });
  });

  describe('searchByName', () => {
    it('returns 200 with matching missions', async () => {
      missionService.searchMissionsByName.mockResolvedValue([buildMissionBase()]);
      const { req, res } = createHttpContext<Request<SearchNameParams>>({ params: { name: 'Alpha' } });

      await controller.searchByName(req, res);

      expect(missionService.searchMissionsByName).toHaveBeenCalledWith('Alpha');
      expect(res._getJSONData()).toHaveLength(1);
    });
  });
});
