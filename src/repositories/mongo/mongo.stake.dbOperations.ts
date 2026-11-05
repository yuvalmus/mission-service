import { Model } from 'mongoose';
import { Patrick, Stake } from 'models/stake.models';
import { StakeRepository } from 'repositories/stake.repository.interface';
import { StakeDocument } from 'repositories/mongo/stake.schema';
import { toSession } from 'repositories/mongo/mongo.utils';

const toDomain = (doc: StakeDocument): Stake => ({
  id: doc._id,
  patrickName: doc.patrickName as Patrick,
  versionNumber: doc.versionNumber
});

const toDocument = (stake: Stake): StakeDocument => ({
  _id: stake.id,
  patrickName: stake.patrickName,
  versionNumber: stake.versionNumber
});

export interface MongoStakeDbOperationsDeps {
  stakeModel: Model<StakeDocument>;
}

export const createMongoStakeDbOperations = ({
  stakeModel
}: MongoStakeDbOperationsDeps): StakeRepository => ({
  insert: async stake => {
    await stakeModel.create(toDocument(stake));
    return stake;
  },

  findById: async id => {
    const doc = await stakeModel.findById(id).lean<StakeDocument | null>();
    return doc ? toDomain(doc) : null;
  },

  findByPatrickName: async patrickName => {
    const doc = await stakeModel.findOne({ patrickName }).lean<StakeDocument | null>();
    return doc ? toDomain(doc) : null;
  },

  update: async (stake, context) => {
    await stakeModel.replaceOne({ _id: stake.id }, toDocument(stake)).session(toSession(context));
    return stake;
  },

  bumpVersion: async (id, context) => {
    const doc = await stakeModel.findById(id).lean<StakeDocument | null>();
    if (!doc) return false;
    await stakeModel
      .replaceOne({ _id: id }, { ...doc, versionNumber: doc.versionNumber + 1 })
      .session(toSession(context));
    return true;
  }
});