import { randomUUID } from 'node:crypto';
import { Patrick, STAKE_CONSTANTS, Stake, parsePatrick } from 'models/stake.models';
import { Entity } from 'models/entity.union.models';
import { CreateStakeDto } from 'dtos/stake.dtos';
import { StakeRepository } from 'repositories/stake.repository.interface';
import { EntityRepository } from 'repositories/entity.repository.interface';
import { UnitOfWork } from 'database/database.types';
import { BadRequestError } from 'errors/app.errors';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { createStakeEntitiesFromDto } from 'mappers/stake.mapper';
import { MissionService } from 'services/mission.service';
import { AppLogger } from 'utils/logger.util';

export interface PatrickStake {
  stake: Stake;
  entities: Entity[];
}

export interface StakeService {
  findStakeOfPatrick(patrickName: Patrick): Promise<PatrickStake>;
  createStake(dto: CreateStakeDto): Promise<PatrickStake>;
  deleteStakeEntities(patrickName: Patrick): Promise<boolean>;
}

export interface StakeServiceDeps {
  stakeRepository: StakeRepository;
  entityRepository: EntityRepository;
  missionService: MissionService;
  unitOfWork: UnitOfWork;
  logger: AppLogger;
}

export const createStakeService = ({
  stakeRepository,
  entityRepository,
  missionService,
  unitOfWork,
  logger
}: StakeServiceDeps): StakeService => {
  const initStakeForPatrick = async (patrickName: Patrick): Promise<Stake> => {
    logger.info({ patrickName }, 'Stake does not exist, creating a new stake for patrick');
    const stake: Stake = {
      id: randomUUID(),
      patrickName,
      versionNumber: STAKE_CONSTANTS.BASE_VERSION_NUMBER
    };
    return stakeRepository.insert(stake);
  };

  const findStakeOfPatrick = async (patrickName: Patrick): Promise<PatrickStake> => {
    const existing = await stakeRepository.findByPatrickName(
      patrickName.toLowerCase() as Patrick
    );
    const stake = existing ?? (await initStakeForPatrick(patrickName.toLowerCase() as Patrick));
    const entities = await entityRepository.findByParentId(stake.id);
    logger.info({ patrickName, count: entities.length }, 'Populated stake entities');
    return { stake, entities };
  };

  const createStake = async (dto: CreateStakeDto): Promise<PatrickStake> => {
    const patrickName = parsePatrick(dto.patrickName);
    if (!patrickName) {
      throw new BadRequestError(ERROR_MESSAGES.INVALID_PATRICK(dto.patrickName));
    }

    const stake: Stake = {
      id: randomUUID(),
      patrickName,
      versionNumber: STAKE_CONSTANTS.BASE_VERSION_NUMBER
    };
    await stakeRepository.insert(stake);

    const entities = createStakeEntitiesFromDto(dto, stake.id);
    await missionService.addEntities(entities, stake.id);

    const persisted = await entityRepository.findByParentId(stake.id);
    return { stake, entities: persisted };
  };

  const deleteStakeEntities = (patrickName: Patrick): Promise<boolean> =>
    unitOfWork.run(async context => {
      const { stake } = await findStakeOfPatrick(patrickName);
const result = await entityRepository.deleteByParentId(stake.id, context);
      await stakeRepository.bumpVersion(stake.id, context);
      logger.info({ patrickName }, 'Deleted stake entities');
      return result;
    });

  return {
    findStakeOfPatrick,
    createStake,
    deleteStakeEntities
  };
};
