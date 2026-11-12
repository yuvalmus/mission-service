import { createStakeService } from 'services/stake.service';
import { Stake } from 'models/stake.models';
import { CreateStakeDto } from 'dtos/stake.dtos';
import { ERROR_MESSAGES } from 'constants/error.constants';
import {
  createEntityRepositoryMock,
  createLoggerMock,
  createMissionServiceMock,
  createStakeRepositoryMock,
  createUnitOfWorkMock
} from '../fixtures/mission.fixtures';
import { buildCircle } from '../fixtures/entity.fixtures';

const STAKE_ID = '5f607182-6666-4777-8888-9999aaaabbbb';

const buildStake = (overrides: Partial<Stake> = {}): Stake => ({
  id: STAKE_ID,
  patrickName: 'patrick100',
  versionNumber: 1,
  ...overrides
});

const buildEmptyCreateStakeDto = (patrickName: string): CreateStakeDto => ({
  patrickName,
  stakeEntities: {
    stakeWpts: [],
    stakeLandingZones: [],
    stakeCircles: [],
    stakeCorridors: [],
    stakePolygons: [],
    stakePolylines: [],
    stakeSectors: [],
    stakeRoute: []
  }
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
    logger
  });

  describe('findStakeOfPatrick', () => {
    it('returns the existing stake', async () => {
      stakeRepository.findByPatrickName.mockResolvedValue(buildStake());

      const result = await service.findStakeOfPatrick('patrick100');

      expect(result.id).toBe(STAKE_ID);
      expect(stakeRepository.insert).not.toHaveBeenCalled();
      expect(entityRepository.findByParentId).not.toHaveBeenCalled();
    });

    it('initializes an empty stake when the patrick has none', async () => {
      stakeRepository.findByPatrickName.mockResolvedValue(null);
      stakeRepository.insert.mockImplementation(async (stake: any) => stake);

      const result = await service.findStakeOfPatrick('patrick103');

      expect(stakeRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ patrickName: 'patrick103', versionNumber: 1 })
      );
      expect(result).toMatchObject({ patrickName: 'patrick103', versionNumber: 1 });
    });
  });

  describe('findStakeEntities', () => {
    it('returns the entities that belong to the stake', async () => {
      const circle = buildCircle();
      entityRepository.findByParentId.mockResolvedValue([circle]);

      await expect(service.findStakeEntities(STAKE_ID)).resolves.toEqual([circle]);
      expect(entityRepository.findByParentId).toHaveBeenCalledWith(STAKE_ID);
      expect(logger.info).toHaveBeenCalledWith(
        { stakeId: STAKE_ID, count: 1 },
        'Populated stake entities'
      );
    });

    it('returns an empty list when the stake has no entities', async () => {
      entityRepository.findByParentId.mockResolvedValue([]);

      await expect(service.findStakeEntities(STAKE_ID)).resolves.toEqual([]);
    });
  });

  describe('createStake', () => {
    it('creates the stake and adds its entities through the mission service', async () => {
      stakeRepository.insert.mockImplementation(async (stake: any) => stake);
      const dto = buildEmptyCreateStakeDto('Patrick120');

      const result = await service.createStake(dto);

      expect(result.patrickName).toBe('patrick120');
      expect(missionService.addEntities).toHaveBeenCalledWith([], result.id);
      expect(entityRepository.findByParentId).not.toHaveBeenCalled();
    });

    it('rejects an invalid patrick name', async () => {
      await expect(service.createStake(buildEmptyCreateStakeDto('Patrick999'))).rejects.toThrow(
        ERROR_MESSAGES.INVALID_PATRICK('Patrick999')
      );
    });
  });

  describe('deleteStakeEntities', () => {
    it('deletes all stake entities inside a unit of work and bumps the stake version', async () => {
      stakeRepository.findByPatrickName.mockResolvedValue(buildStake());
      entityRepository.findByParentId.mockResolvedValue([]);
      entityRepository.deleteByParentId.mockResolvedValue(true);
      stakeRepository.bumpVersion.mockResolvedValue(true);

      const result = await service.deleteStakeEntities('patrick100');

      expect(result).toBe(true);
      expect(entityRepository.deleteByParentId).toHaveBeenCalledWith(STAKE_ID, {});
      expect(stakeRepository.bumpVersion).toHaveBeenCalledWith(STAKE_ID, {});
    });
  });
});
