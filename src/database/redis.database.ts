import { Redis } from 'ioredis';
import { Env } from 'config/env.config';
import { DatabaseClient, UnitOfWork } from 'database/database.types';

export interface RedisDatabase {
  client: DatabaseClient;
  unitOfWork: UnitOfWork;
  redis: Redis;
}

const PING_RESPONSE = 'PONG';

export const createRedisDatabase = (env: Env): RedisDatabase => {
  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  const client: DatabaseClient = {
    connect: async () => {
      await redis.connect();
    },
    disconnect: async () => {
      await redis.quit();
    },
    ping: async () => {
      try {
        return (await redis.ping()) === PING_RESPONSE;
      } catch {
        return false;
      }
    },
    isConnected: () => redis.status === 'ready',
  };

  const unitOfWork: UnitOfWork = {
    run: (work) => work({}),
  };

  return { client, unitOfWork, redis };
};
