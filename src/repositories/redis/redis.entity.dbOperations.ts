import { Redis } from 'ioredis';
import { COLLECTIONS } from 'constants/app.constants';
import { EntitySchema, Entity } from 'models/entity.union.models';
import { EntityRepository } from 'repositories/entity.repository.interface';
import { AppLogger } from 'utils/logger.util';

export interface RedisEntityDbOperationsDeps {
  redis: Redis;
  logger: AppLogger;
}

export const createRedisEntityDbOperations = ({
  redis,
  logger
}: RedisEntityDbOperationsDeps): EntityRepository => {
  const parseEntity = (raw: string): Entity | null => {
    const result = EntitySchema.safeParse(JSON.parse(raw));
    if (!result.success) {
      logger.warn({ issues: result.error.issues }, 'Skipping corrupted entity document');
      return null;
    }
    return result.data;
  };

  const readAll = async (): Promise<Entity[]> => {
    const rows = await redis.hgetall(COLLECTIONS.ENTITIES);
    return Object.values(rows)
      .map(parseEntity)
      .filter((entity): entity is Entity => entity !== null);
  };

  const write = async (entity: Entity): Promise<Entity> => {
    await redis.hset(COLLECTIONS.ENTITIES, entity.id, JSON.stringify(entity));
    return entity;
  };

  return {
    insert: write,
    update: write,

    findById: async id => {
      const raw = await redis.hget(COLLECTIONS.ENTITIES, id);
      return raw ? parseEntity(raw) : null;
    },

    findByParentId: async parentId =>
      (await readAll()).filter(entity => entity.parentId === parentId),

    findByType: async entityType =>
      (await readAll()).filter(entity => entity.entityType === entityType),

    findNamesByParentId: async parentId =>
      (await readAll()).filter(entity => entity.parentId === parentId).map(entity => entity.name),

    isNameExists: async (parentId, entityId, name) =>
      (await readAll()).some(
        entity => entity.parentId === parentId && entity.name === name && entity.id !== entityId
      ),

    deleteById: async id => (await redis.hdel(COLLECTIONS.ENTITIES, id)) > 0,

    deleteByParentId: async parentId => {
      const ids = (await readAll())
        .filter(entity => entity.parentId === parentId)
        .map(entity => entity.id);
      if (ids.length > 0) {
        await redis.hdel(COLLECTIONS.ENTITIES, ...ids);
      }
      return true;
    }
  };
};