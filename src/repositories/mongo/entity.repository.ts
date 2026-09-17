import { ClientSession, Model } from 'mongoose';
import { EntityType } from '@constants/entity.constants';
import { AnyEntity } from '@models/entity-union.models';
import { EntityRepository } from '@repositories/entity.repository';
import { EntityDocument } from '@repositories/mongo/mission.schema';
import { TransactionContext } from '@database/database.types';

const toSession = (context?: TransactionContext): ClientSession | null =>
  (context?.raw as ClientSession | undefined) ?? null;

const toDocument = (entity: AnyEntity): EntityDocument => {
  const { id, ...rest } = entity;
  return { _id: id, ...rest };
};

const toDomain = (doc: EntityDocument): AnyEntity => {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest } as unknown as AnyEntity;
};

export interface MongoEntityRepositoryDeps {
  entityModel: Model<EntityDocument>;
}

export const createMongoEntityRepository = ({ entityModel }: MongoEntityRepositoryDeps): EntityRepository => ({
  insert: async (entity, context) => {
    await entityModel.create([toDocument(entity)], { session: toSession(context) ?? undefined });
    return entity;
  },

  findById: async (id) => {
    const doc = await entityModel.findById(id).lean<EntityDocument | null>();
    return doc ? toDomain(doc) : null;
  },

  findByParentId: async (parentId) => {
    const docs = await entityModel.find({ parentId }).lean<EntityDocument[]>();
    return docs.map(toDomain);
  },

  findByType: async (entityType: EntityType) => {
    const docs = await entityModel.find({ entityType }).lean<EntityDocument[]>();
    return docs.map(toDomain);
  },

  findNamesByParentId: async (parentId) => {
    const docs = await entityModel.find({ parentId }, { name: 1 }).lean<Pick<EntityDocument, '_id' | 'name'>[]>();
    return docs.map((doc) => doc.name ?? '');
  },

  isNameTaken: async (parentId, entityId, name) => {
    const existing = await entityModel
      .findOne({ parentId, name, _id: { $ne: entityId } }, { _id: 1 })
      .lean<Pick<EntityDocument, '_id'> | null>();
    return existing !== null;
  },

  update: async (entity, context) => {
    await entityModel.replaceOne({ _id: entity.id }, toDocument(entity)).session(toSession(context));
    return entity;
  },

  deleteById: async (id, context) => {
    const result = await entityModel.deleteOne({ _id: id }).session(toSession(context));
    return result.deletedCount > 0;
  },

  deleteByParentId: async (parentId, context) => {
    const result = await entityModel.deleteMany({ parentId }).session(toSession(context));
    return result.acknowledged;
  },
});
