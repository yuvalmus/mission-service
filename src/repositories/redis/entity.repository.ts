import { Redis } from 'ioredis';
import { COLLECTIONS } from '@constants/app.constants';
import { EntitySchema, AnyEntity } from '@models/entity-union.models';
import { EntityRepository } from '@repositories/entity.repository';
import { AppLogger } from '@utils/logger.util';

export interface RedisEntityRepositoryDeps {
  redis: Redis;
  logger: AppLogger;
}

export const createRedisEntityRepository = ({ redis, logger }: RedisEntityRepositoryDeps): EntityRepository => {
  const parseEntity = (raw: string): AnyEntity | null => {
    const result = EntitySchema.safeParse(JSON.parse(raw));
    if (!result.success) {
      logger.warn({ issues: result.error.issues }, 'Skipping corrupted entity document');
      return null;
    }
    return result.data;
  };

  const readAll = async (): Promise<AnyEntity[]> => {
    const rows = await redis.hgetall(COLLECTIONS.ENTITIES);
    return Object.values(rows)
      .map(parseEntity)
      .filter((entity): entity is AnyEntity => entity !== null);
  };

  const write = async (entity: AnyEntity): Promise<AnyEntity> => {
    await redis.hset(COLLECTIONS.ENTITIES, entity.id, JSON.stringify(entity));
    return entity;
  };

  return {
    insert: write,
    update: write,

    findById: async (id) => {
      const raw = await redis.hget(COLLECTIONS.ENTITIES, id);
      return raw ? parseEntity(raw) : null;
    },

    findByParentId: async (parentId) => (await readAll()).filter((entity) => entity.parentId === parentId),

    findByType: async (entityType) => (await readAll()).filter((entity) => entity.entityType === entityType),

    findNamesByParentId: async (parentId) =>
      (await readAll()).filter((entity) => entity.parentId === parentId).map((entity) => entity.name),

    isNameTaken: async (parentId, entityId, name) =>
      (await readAll()).some(
        (entity) => entity.parentId === parentId && entity.name === name && entity.id !== entityId,
      ),

    deleteById: async (id) => (await redis.hdel(COLLECTIONS.ENTITIES, id)) > 0,

    deleteByParentId: async (parentId) => {
      const ids = (await readAll())
        .filter((entity) => entity.parentId === parentId)
        .map((entity) => entity.id);
      if (ids.length > 0) {
        await redis.hdel(COLLECTIONS.ENTITIES, ...ids);
      }
      return true;
    },
  };
};
