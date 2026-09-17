import { Request, Response } from 'express';
import { StakeService } from 'services/stake.service';
import { parsePatrick, Patrick } from 'models/stake.models';
import { toStakeDto } from 'mappers/stake.mapper';
import { CreateStakeDto, PatrickParams } from 'dtos/stake.dtos';
import { BadRequestError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { HTTP_STATUS } from 'constants/http.constants';

export interface StakeController {
  getStakeOfPatrick(req: Request<PatrickParams>, res: Response): Promise<void>;
  createStake(req: Request<unknown, unknown, CreateStakeDto>, res: Response): Promise<void>;
  deleteStakeEntities(req: Request<PatrickParams>, res: Response): Promise<void>;
}

const parsePatrickOrThrow = (patrickName: string) => {
  const patrick = parsePatrick(patrickName);
  if (!patrick) {
    throw new BadRequestError(ERROR_MESSAGES.INVALID_PATRICK(patrickName));
  }
  return patrick;
};

export const createStakeController = (stakeService: StakeService): StakeController => ({
  getStakeOfPatrick: async (req, res) => {
    const patrick = parsePatrickOrThrow(req.params.patrickName);
    const { stake, entities } = await stakeService.findStakeOfPatrick(patrick as Patrick);
    res.status(HTTP_STATUS.OK).json(toStakeDto(stake, entities));
  },

  createStake: async (req, res) => {
    const { stake, entities } = await stakeService.createStake(req.body);
    res.status(HTTP_STATUS.OK).json(toStakeDto(stake, entities));
  },

  deleteStakeEntities: async (req, res) => {
    const patrick = parsePatrickOrThrow(req.params.patrickName);
    const deleted = await stakeService.deleteStakeEntities(patrick);
    res.status(deleted ? HTTP_STATUS.OK : HTTP_STATUS.NOT_FOUND).send();
  }
});
