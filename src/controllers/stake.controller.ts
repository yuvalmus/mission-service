import { Request, Response } from 'express';
import { StakeService } from '@services/stake.service';
import { parseSquadron } from '@models/stake.models';
import { toStakeDto } from '@mappers/stake.mapper';
import { CreateStakeDto, SquadronParams } from '@dtos/stake.dtos';
import { BadRequestError } from '@errors/app.errors';
import { ERROR_MESSAGES } from '@constants/error.constants';
import { HTTP_STATUS } from '@constants/http.constants';

export interface StakeController {
  getStakeOfSquadron(req: Request<SquadronParams>, res: Response): Promise<void>;
  createStake(req: Request<unknown, unknown, CreateStakeDto>, res: Response): Promise<void>;
  deleteStakeEntities(req: Request<SquadronParams>, res: Response): Promise<void>;
}

const parseSquadronOrThrow = (squadronName: string) => {
  const squadron = parseSquadron(squadronName);
  if (!squadron) {
    throw new BadRequestError(ERROR_MESSAGES.INVALID_SQUADRON(squadronName));
  }
  return squadron;
};

export const createStakeController = (stakeService: StakeService): StakeController => ({
  getStakeOfSquadron: async (req, res) => {
    const squadron = parseSquadronOrThrow(req.params.squadronName);
    const { stake, entities } = await stakeService.findStakeOfSquadron(squadron);
    res.status(HTTP_STATUS.OK).json(toStakeDto(stake, entities));
  },

  createStake: async (req, res) => {
    const { stake, entities } = await stakeService.createStake(req.body);
    res.status(HTTP_STATUS.OK).json(toStakeDto(stake, entities));
  },

  deleteStakeEntities: async (req, res) => {
    const squadron = parseSquadronOrThrow(req.params.squadronName);
    const deleted = await stakeService.deleteStakeEntities(squadron);
    res.status(deleted ? HTTP_STATUS.OK : HTTP_STATUS.NOT_FOUND).send();
  },
});
