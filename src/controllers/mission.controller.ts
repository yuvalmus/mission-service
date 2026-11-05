import { Request, Response } from 'express';
import { MissionService } from 'services/mission.service';
import { toBasicMissionDto, toMissionDto } from 'mappers/mission.mapper';
import { HTTP_STATUS } from 'constants/http.constants';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { NotFoundError } from 'errors/app.errors';
import { MISSION_LAYERS, MissionLayer } from 'constants/entity.constants';
import {
  MergeMissionDto,
  MissionDtoList,
  MissionIdListDto,
  MissionIdParams,
  SearchNameParams,
  UpdateMissionDto
} from 'dtos/mission.dtos';

export interface MissionController {
  getMission(req: Request<MissionIdParams>, res: Response): Promise<void>;
  getAllBasicMissions(req: Request, res: Response): Promise<void>;
  getMissionsFromIds(
    req: Request<unknown, unknown, MissionIdListDto>,
    res: Response
  ): Promise<void>;
  getBasicMissionsFromIds(
    req: Request<unknown, unknown, MissionIdListDto>,
    res: Response
  ): Promise<void>;
  createMission(req: Request, res: Response): Promise<void>;
  updateMission(req: Request<unknown, unknown, UpdateMissionDto>, res: Response): Promise<void>;
  deleteMission(req: Request<MissionIdParams>, res: Response): Promise<void>;
  cloneMission(req: Request<MissionIdParams>, res: Response): Promise<void>;
  mergeMission(req: Request<unknown, unknown, MergeMissionDto>, res: Response): Promise<void>;
  createMissionList(req: Request<unknown, unknown, MissionDtoList>, res: Response): Promise<void>;
  searchByName(req: Request<SearchNameParams>, res: Response): Promise<void>;
}

const MISSION_LAYER_VALUES = new Set<string>(Object.values(MISSION_LAYERS));

const parseMissionLayer = (layer: string): MissionLayer =>
  MISSION_LAYER_VALUES.has(layer) ? (layer as MissionLayer) : MISSION_LAYERS.NAVIGATION;

export const createMissionController = (missionService: MissionService): MissionController => ({
  getMission: async (req, res) => {
    const result = await missionService.findMissionWithEntities(req.params.id);
    if (!result) {
      throw new NotFoundError(ERROR_MESSAGES.MISSION_NOT_FOUND);
    }
    res.status(HTTP_STATUS.OK).json(toMissionDto(result.mission, result.entities));
  },

  getAllBasicMissions: async (_req, res) => {
    const missions = await missionService.retrieveAll();
    res.status(HTTP_STATUS.OK).json(missions.map(toBasicMissionDto));
  },

  getMissionsFromIds: async (req, res) => {
    const missions = await missionService.retrieveAllInList(req.body);
    res
      .status(HTTP_STATUS.OK)
      .json(missions.map(({ mission, entities }) => toMissionDto(mission, entities)));
  },

  getBasicMissionsFromIds: async (req, res) => {
    const missions = await missionService.retrieveAllInList(req.body);
    res.status(HTTP_STATUS.OK).json(missions.map(({ mission }) => toBasicMissionDto(mission)));
  },

  createMission: async (req, res) => {
    const nextName = (await missionService.generateNextMissionName()).replace(/[""]/g, '');
    const emptyMission = {
      name: nextName,
      comment: undefined,
      createdBy: undefined,
      missionType: undefined,
      password: undefined,
      sonicProperties: undefined
    };
    const mission = await missionService.createMission(emptyMission);
    res.status(HTTP_STATUS.CREATED).json(toMissionDto(mission));
  },

  updateMission: async (req, res) => {
    const missionInfo = await missionService.updateMission(req.body);
    const missionWithEntities = await missionService.findMissionWithEntities(missionInfo.id);
    res.status(HTTP_STATUS.OK).json(toMissionDto(missionInfo, missionWithEntities?.entities ?? []));
  },

  deleteMission: async (req, res) => {
    const deleted = await missionService.deleteMission(req.params.id);
    if (!deleted) {
      throw new NotFoundError(ERROR_MESSAGES.MISSION_NOT_FOUND);
    }
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },

  cloneMission: async (req, res) => {
    const { mission, entities } = await missionService.cloneMission(req.params.id);
    res.status(HTTP_STATUS.CREATED).json(toMissionDto(mission, entities));
  },

  mergeMission: async (req, res) => {
    const layers = req.body.missionLayers.map(parseMissionLayer);
    const result = await missionService.mergeMission(req.body.currentId, req.body.mergedId, layers);
    if (!result) {
      throw new NotFoundError(ERROR_MESSAGES.MISSION_NOT_FOUND);
    }
    res.status(HTTP_STATUS.OK).json(toMissionDto(result.mission, result.entities));
  },

  createMissionList: async (req, res) => {
    const imported = await missionService.createMissionList(req.body);
    res
      .status(HTTP_STATUS.CREATED)
      .json(imported.map(({ mission, entities }) => toMissionDto(mission, entities)));
  },

  searchByName: async (req, res) => {
    const missions = await missionService.searchMissionsByName(req.params.name);
    res.status(HTTP_STATUS.OK).json(missions.map(toBasicMissionDto));
  }
});
