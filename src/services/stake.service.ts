import { randomUUID } from 'node:crypto';
import { Squadron, STAKE_CONSTANTS, Stake, parseSquadron } from '@models/stake.models';
import { AnyEntity } from '@models/entity-union.models';
import { CreateStakeDto } from '@dtos/stake.dtos';
import { StakeRepository } from '@repositories/stake.repository';
import { EntityRepository } from '@repositories/entity.repository';
import { UnitOfWork } from '@database/database.types';
import { BadRequestError } from '@errors/app.errors';
import { ERROR_MESSAGES } from '@constants/error.constants';
import { stakeEntitiesFromCreateDto } from '@mappers/stake.mapper';
import { MissionService } from '@services/mission.service';
import { AppLogger } from '@utils/logger.util';

export interface StakeWithEntities {
  stake: Stake;
  entities: AnyEntity[];
}

export interface StakeService {
  findStakeOfSquadron(squadronName: Squadron): Promise<StakeWithEntities>;
  createStake(dto: CreateStakeDto): Promise<StakeWithEntities>;
  deleteStakeEntities(squadronName: Squadron): Promise<boolean>;
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
  logger,
}: StakeServiceDeps): StakeService => {
  const initStakeForSquadron = async (squadronName: Squadron): Promise<Stake> => {
    logger.info({ squadronName }, 'Stake does not exist, creating a new stake for squadron');
    const stake: Stake = {
      id: randomUUID(),
      squadronName,
      versionNumber: STAKE_CONSTANTS.BASE_VERSION_NUMBER,
    };
    return stakeRepository.insert(stake);
  };

  const findStakeOfSquadron = async (squadronName: Squadron): Promise<StakeWithEntities> => {
    const existing = await stakeRepository.findBySquadronName(squadronName);
    const stake = existing ?? (await initStakeForSquadron(squadronName));
    const entities = await entityRepository.findByParentId(stake.id);
    logger.info({ squadronName, count: entities.length }, 'Populated stake entities');
    return { stake, entities };
  };

  return {
    findStakeOfSquadron,

    createStake: async (dto) => {
      const squadronName = parseSquadron(dto.squadronName);
      if (!squadronName) {
        throw new BadRequestError(ERROR_MESSAGES.INVALID_SQUADRON(dto.squadronName));
      }

      const stake: Stake = {
        id: randomUUID(),
        squadronName,
        versionNumber: STAKE_CONSTANTS.BASE_VERSION_NUMBER,
      };
      await stakeRepository.insert(stake);

      const entities = stakeEntitiesFromCreateDto(dto, stake.id);
      await missionService.addEntities(entities, stake.id);

      const persisted = await entityRepository.findByParentId(stake.id);
      return { stake, entities: persisted };
    },

    deleteStakeEntities: (squadronName) =>
      unitOfWork.run(async (context) => {
        const { stake } = await findStakeOfSquadron(squadronName);
        const result = await entityRepository.deleteByParentId(stake.id, context);
        await stakeRepository.update({ ...stake, versionNumber: stake.versionNumber + 1 });
        logger.info({ squadronName }, 'Deleted stake entities');
        return result;
      }),
  };
};
