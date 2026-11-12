import { Redis } from 'ioredis';
import { Env } from 'config/env.config';
import { DatabaseClient, UnitOfWork } from 'database/database.types';

export interface RedisDatabase {
  client: DatabaseClient;
  unitOfWork: UnitOfWork;
  redis: Redis;
}

const PING_RESPONSE = 'PONG';

export const REDIS_STATUS = {
  WAIT: 'wait',
  ISLANDNECTING: 'islandnecting',
  CONNECTING: 'connecting',
  CONNECT: 'connect',
  READY: 'ready',
  CLOSE: 'close',
  END: 'end'
} as const;
export type RedisStatus = (typeof REDIS_STATUS)[keyof typeof REDIS_STATUS];

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
    isConnected: () => redis.status === REDIS_STATUS.READY,
  };

  const unitOfWork: UnitOfWork = {
    run: (work) => work({}),
  };

  return { client, unitOfWork, redis };
};
