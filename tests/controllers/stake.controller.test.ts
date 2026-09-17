import { Request } from 'express';
import { createStakeController } from 'controllers/stake.controller';
import { StakeService } from 'services/stake.service';
import { PatrickParams } from 'dtos/stake.dtos';
import { HTTP_STATUS } from 'constants/http.constants';
import { BadRequestError } from 'errors/app.errors';
import { createHttpContext } from '../fixtures/express.fixtures';
import { buildCircle, buildWpt } from '../fixtures/entity.fixtures';

const STAKE_ID = '5f607182-6666-4777-8888-9999aaaabbbb';

describe('stake.controller', () => {
  const stakeService: jest.Mocked<StakeService> = {
    findStakeOfPatrick: jest.fn(),
    createStake: jest.fn(),
    deleteStakeEntities: jest.fn(),
  };
  const controller = createStakeController(stakeService);

  describe('getStakeOfPatrick', () => {
    it('returns 200 with the stake dto grouped by entity type', async () => {
      stakeService.findStakeOfPatrick.mockResolvedValue({
        stake: { id: STAKE_ID, patrickName: 'patrick100', versionNumber: 3 },
        entities: [buildCircle(), buildWpt()],
      });
      const { req, res } = createHttpContext<Request<PatrickParams>>({
        params: { patrickName: 'patrick100' },
      });

      await controller.getStakeOfPatrick(req, res);

      expect(stakeService.findStakeOfPatrick).toHaveBeenCalledWith('Patrick100');
      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toMatchObject({ patrickId: STAKE_ID, versionNumber: 3 });
      expect(res._getJSONData().stakeEntities.stakeCircles).toHaveLength(1);
      expect(res._getJSONData().stakeEntities.stakeWpts).toHaveLength(1);
    });

    it('rejects an unknown patrick name', async () => {
      const { req, res } = createHttpContext<Request<PatrickParams>>({
        params: { patrickName: 'Patrick999' },
      });

      await expect(controller.getStakeOfPatrick(req, res)).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  describe('deleteStakeEntities', () => {
    it('returns 200 when the entities were deleted', async () => {
      stakeService.deleteStakeEntities.mockResolvedValue(true);
      const { req, res } = createHttpContext<Request<PatrickParams>>({
        params: { patrickName: 'Patrick100' },
      });

      await controller.deleteStakeEntities(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
    });
  });
});
