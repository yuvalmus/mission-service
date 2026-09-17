import { MissionRepository } from '@repositories/mission.repository';
import { StakeRepository } from '@repositories/stake.repository';
import { TransactionContext } from '@database/database.types';
import { AppLogger } from '@utils/logger.util';

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
  logger,
}: CommonActionsServiceDeps): CommonActionsService => ({
  validateParentExists: async (parentId) => {
    const mission = await missionRepository.findById(parentId);
    if (mission) return;

    const stake = await stakeRepository.findById(parentId);
    if (!stake) {
      logger.warn({ parentId }, 'Parent mission or stake was not found');
    }
  },

  bumpParentVersion: async (parentId) => {
    const stake = await stakeRepository.findById(parentId);
    if (stake) {
      await stakeRepository.update({ ...stake, versionNumber: stake.versionNumber + 1 });
      return;
    }

    const mission = await missionRepository.findById(parentId);
    if (mission) {
      const now = new Date();
      await missionRepository.update({
        ...mission,
        versionNumber: mission.versionNumber + 1,
        timeInfo: mission.timeInfo
          ? { ...mission.timeInfo, lastUpdateTime: now }
          : { dateCreated: now, lastUpdateTime: now },
      });
    }
  },
});
