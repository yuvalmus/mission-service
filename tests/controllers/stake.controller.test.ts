import { Request } from 'express';
import { createStakeController } from '@controllers/stake.controller';
import { StakeService } from '@services/stake.service';
import { SquadronParams } from '@dtos/stake.dtos';
import { HTTP_STATUS } from '@constants/http.constants';
import { BadRequestError } from '@errors/app.errors';
import { createHttpContext } from '../fixtures/express.fixtures';
import { buildCircle, buildWpt } from '../fixtures/entity.fixtures';

const STAKE_ID = '5f607182-6666-4777-8888-9999aaaabbbb';

describe('stake.controller', () => {
  const stakeService: jest.Mocked<StakeService> = {
    findStakeOfSquadron: jest.fn(),
    createStake: jest.fn(),
    deleteStakeEntities: jest.fn(),
  };
  const controller = createStakeController(stakeService);

  describe('getStakeOfSquadron', () => {
    it('returns 200 with the stake dto grouped by entity type', async () => {
      stakeService.findStakeOfSquadron.mockResolvedValue({
        stake: { id: STAKE_ID, squadronName: 'Squadron100', versionNumber: 3 },
        entities: [buildCircle(), buildWpt()],
      });
      const { req, res } = createHttpContext<Request<SquadronParams>>({
        params: { squadronName: 'squadron100' },
      });

      await controller.getStakeOfSquadron(req, res);

      expect(stakeService.findStakeOfSquadron).toHaveBeenCalledWith('Squadron100');
      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toMatchObject({ squadronId: STAKE_ID, versionNumber: 3 });
      expect(res._getJSONData().stakeEntities.stakeCircles).toHaveLength(1);
      expect(res._getJSONData().stakeEntities.stakeWpts).toHaveLength(1);
    });

    it('rejects an unknown squadron name', async () => {
      const { req, res } = createHttpContext<Request<SquadronParams>>({
        params: { squadronName: 'Squadron999' },
      });

      await expect(controller.getStakeOfSquadron(req, res)).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  describe('deleteStakeEntities', () => {
    it('returns 200 when the entities were deleted', async () => {
      stakeService.deleteStakeEntities.mockResolvedValue(true);
      const { req, res } = createHttpContext<Request<SquadronParams>>({
        params: { squadronName: 'Squadron100' },
      });

      await controller.deleteStakeEntities(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
    });
  });
});
