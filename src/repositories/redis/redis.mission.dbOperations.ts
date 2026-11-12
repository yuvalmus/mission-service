import { Redis } from 'ioredis';
import { COLLECTIONS } from 'constants/app.constants';
import { Mission, MissionBase, MissionSchema } from 'models/mission.models';
import { MissionRepository } from 'repositories/mission.repository.interface';
import { escapeRegex } from 'utils/regex.util';

const parseMission = (raw: string): Mission => MissionSchema.parse(JSON.parse(raw));

export interface RedisMissionDbOperationsDeps {
  redis: Redis;
}

export const createRedisMissionDbOperations = ({
  redis
}: RedisMissionDbOperationsDeps): MissionRepository => {
  const readAll = async (): Promise<Mission[]> => {
    const rows = await redis.hgetall(COLLECTIONS.MISSIONS);
    return Object.values(rows).map(parseMission);
  };

  const write = async (mission: Mission): Promise<Mission> => {
    await redis.hset(COLLECTIONS.MISSIONS, mission.id, JSON.stringify(mission));
    return mission;
  };

  return {
    create: write,
    update: write,

    findById: async id => {
      const raw = await redis.hget(COLLECTIONS.MISSIONS, id);
      return raw ? parseMission(raw) : null;
    },

    findByIds: async ids => {
      const missions = await readAll();
      const idSet = new Set(ids);
      return missions.filter(mission => idSet.has(mission.id));
    },

    findAllBasic: async (): Promise<MissionBase[]> => readAll(),

    findAllNames: async () => (await readAll()).map(mission => mission.name),

    findIdByName: async name =>
      (await readAll()).find(mission => mission.name === name)?.id ?? null,

    searchByName: async name => {
      const pattern = new RegExp(escapeRegex(name), 'i');
      return (await readAll()).filter(mission => pattern.test(mission.name));
    },

    delete: async id => (await redis.hdel(COLLECTIONS.MISSIONS, id)) > 0,

    bumpVersion: async id => {
      const raw = await redis.hget(COLLECTIONS.MISSIONS, id);
      if (!raw) return false;
      const mission = parseMission(raw);
      const now = new Date();
      await write({
        ...mission,
        versionNumber: mission.versionNumber + 1,
        timeInfo: mission.timeInfo
          ? { ...mission.timeInfo, lastUpdateTime: now }
          : { dateCreated: now, lastUpdateTime: now }
      });
      return true;
    }
  };
};