import { Redis } from 'ioredis';
import { COLLECTIONS } from 'constants/app.constants';
import { Stake, StakeSchema } from 'models/stake.models';
import { StakeRepository } from 'repositories/stake.repository.interface';

export interface RedisStakeDbOperationsDeps {
  redis: Redis;
}

export const createRedisStakeDbOperations = ({
  redis
}: RedisStakeDbOperationsDeps): StakeRepository => {
  const parseStake = (raw: string): Stake => StakeSchema.parse(JSON.parse(raw));

  const write = async (stake: Stake): Promise<Stake> => {
    await redis.hset(COLLECTIONS.STAKES, stake.id, JSON.stringify(stake));
    return stake;
  };

  return {
    insert: write,
    update: write,

    findById: async id => {
      const raw = await redis.hget(COLLECTIONS.STAKES, id);
      return raw ? parseStake(raw) : null;
    },

    findByPatrickName: async patrickName => {
      const rows = await redis.hgetall(COLLECTIONS.STAKES);
      return (
        Object.values(rows)
          .map(parseStake)
          .find(stake => stake.patrickName === patrickName) ?? null
      );
    },

    bumpVersion: async id => {
      const raw = await redis.hget(COLLECTIONS.STAKES, id);
      if (!raw) return false;
      const stake = parseStake(raw);
      await write({ ...stake, versionNumber: stake.versionNumber + 1 });
      return true;
    }
  };
};