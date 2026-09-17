import { createStakeService } from '@services/stake.service';
import { Stake } from '@models/stake.models';
import { CreateStakeDto } from '@dtos/stake.dtos';
import { ERROR_MESSAGES } from '@constants/error.constants';
import {
  createEntityRepositoryMock,
  createLoggerMock,
  createMissionServiceMock,
  createStakeRepositoryMock,
  createUnitOfWorkMock,
} from '../fixtures/mission.fixtures';
import { buildCircle } from '../fixtures/entity.fixtures';

const STAKE_ID = '5f607182-6666-4777-8888-9999aaaabbbb';

const buildStake = (overrides: Partial<Stake> = {}): Stake => ({
  id: STAKE_ID,
  squadronName: 'Squadron100',
  versionNumber: 1,
  ...overrides,
});

const buildEmptyCreateStakeDto = (squadronName: string): CreateStakeDto => ({
  squadronName,
  stakeEntities: {
    stakeWpts: [],
    stakeLandingZones: [],
    stakeCircles: [],
    stakeCorridors: [],
    stakePolygons: [],
    stakePolylines: [],
    stakeSectors: [],
    stakeRoute: [],
  },
});

describe('stake.service', () => {
  const stakeRepository = createStakeRepositoryMock();
  const entityRepository = createEntityRepositoryMock();
  const missionService = createMissionServiceMock();
  const unitOfWork = createUnitOfWorkMock();
  const logger = createLoggerMock();

  const service = createStakeService({
    stakeRepository,
    entityRepository,
    missionService,
    unitOfWork,
    logger,
  });

  describe('findStakeOfSquadron', () => {
    it('returns the existing stake with its entities', async () => {
      stakeRepository.findBySquadronName.mockResolvedValue(buildStake());
      entityRepository.findByParentId.mockResolvedValue([buildCircle()]);

      const result = await service.findStakeOfSquadron('Squadron100');

      expect(result.stake.id).toBe(STAKE_ID);
      expect(result.entities).toHaveLength(1);
      expect(stakeRepository.insert).not.toHaveBeenCalled();
    });

    it('initializes an empty stake when the squadron has none', async () => {
      stakeRepository.findBySquadronName.mockResolvedValue(null);
      stakeRepository.insert.mockImplementation(async (stake) => stake);
      entityRepository.findByParentId.mockResolvedValue([]);

      const result = await service.findStakeOfSquadron('Squadron103');

      expect(stakeRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ squadronName: 'Squadron103', versionNumber: 1 }),
      );
      expect(result.entities).toEqual([]);
    });
  });

  describe('createStake', () => {
    it('creates the stake and adds its entities through the mission service', async () => {
      stakeRepository.insert.mockImplementation(async (stake) => stake);
      entityRepository.findByParentId.mockResolvedValue([buildCircle()]);
      const dto = buildEmptyCreateStakeDto('Squadron120');

      const result = await service.createStake(dto);

      expect(result.stake.squadronName).toBe('Squadron120');
      expect(missionService.addEntities).toHaveBeenCalledWith([], result.stake.id);
    });

    it('rejects an invalid squadron name', async () => {
      await expect(service.createStake(buildEmptyCreateStakeDto('Squadron999'))).rejects.toThrow(
        ERROR_MESSAGES.INVALID_SQUADRON('Squadron999'),
      );
    });
  });

  describe('deleteStakeEntities', () => {
    it('deletes all stake entities inside a unit of work and bumps the stake version', async () => {
      stakeRepository.findBySquadronName.mockResolvedValue(buildStake());
      entityRepository.findByParentId.mockResolvedValue([]);
      entityRepository.deleteByParentId.mockResolvedValue(true);
      stakeRepository.update.mockImplementation(async (stake) => stake);

      const result = await service.deleteStakeEntities('Squadron100');

      expect(result).toBe(true);
      expect(entityRepository.deleteByParentId).toHaveBeenCalledWith(STAKE_ID, {});
      expect(stakeRepository.update).toHaveBeenCalledWith(expect.objectContaining({ versionNumber: 2 }));
    });
  });
});
