import { MissionRepository } from 'repositories/mission.repository.interface';
import { StakeRepository } from 'repositories/stake.repository.interface';
import { TransactionContext } from 'database/database.types';
import { AppLogger } from 'utils/logger.util';

export interface CommonActionsService {
  validateParentExists(parentId: string): Promise<void>;
  bumpParentVersion(parentId: string, context?: TransactionContext): Promise<void>;
}

export interface CommonActionsServiceDeps {
  missionRepository: MissionRepository;
  stakeRepository: StakeRepository;
  logger: AppLogger;
}

export const createCommonActionsService = ({
  missionRepository,
  stakeRepository,
  logger
}: CommonActionsServiceDeps): CommonActionsService => {
  const validateParentExists = async (parentId: string): Promise<void> => {
    const mission = await missionRepository.findById(parentId);
    if (mission) return;

    const stake = await stakeRepository.findById(parentId);
    if (!stake) {
      logger.warn({ parentId }, 'Parent mission or stake was not found');
    }
  };

  const bumpParentVersion = async (
    parentId: string,
    context?: TransactionContext
  ): Promise<void> => {
    const stake = await stakeRepository.findById(parentId);
    if (stake) {
      await stakeRepository.bumpVersion(parentId, context);
      return;
    }
    await missionRepository.bumpVersion(parentId, context);
  };

  return {
    validateParentExists,
    bumpParentVersion
  };
};
