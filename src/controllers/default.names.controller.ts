import { Request, RequestHandler, Response } from 'express';
import { MissionService } from 'services/mission.service';
import { NamesParams } from 'dtos/commonEntity.dtos';
import { HTTP_STATUS } from 'constants/http.constants';

export interface DefaultNamesController {
  getNextEntityName(prefix: string): RequestHandler;
  getNextMissionName(req: Request, res: Response): Promise<void>;
}

export const createDefaultNamesController = (
  missionService: MissionService
): DefaultNamesController => ({
  getNextEntityName: prefix => async (req, res) => {
    const { missionId, amount } = req.params as unknown as NamesParams;
    const names = await missionService.generateNextEntityNames(missionId, amount, prefix);
    res.status(HTTP_STATUS.OK).json(names);
  },

  getNextMissionName: async (_req, res) => {
    const name = await missionService.generateNextMissionName();
    res.status(HTTP_STATUS.OK).json(name);
  }
});
