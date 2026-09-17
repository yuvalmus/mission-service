import { Connection, Model, Schema } from 'mongoose';
import { COLLECTIONS } from 'constants/app.constants';
import { Patrick, Stake } from 'models/stake.models';
import { StakeRepository } from 'repositories/stake.repository';

export interface StakeDocument {
  _id: string;
  patrickName: string;
  versionNumber: number;
}

const stakeSchema = new Schema<StakeDocument>(
  {
    _id: { type: String, required: true },
    patrickName: { type: String, required: true, index: true },
    versionNumber: { type: Number, required: true },
  },
  { collection: COLLECTIONS.STAKES, versionKey: false },
);

const STAKE_MODEL_NAME = 'Stake';

export const createStakeModel = (connection: Connection): Model<StakeDocument> =>
  connection.model<StakeDocument>(STAKE_MODEL_NAME, stakeSchema);

const toDomain = (doc: StakeDocument): Stake => ({
  id: doc._id,
  patrickName: doc.patrickName as Patrick,
  versionNumber: doc.versionNumber,
});

const toDocument = (stake: Stake): StakeDocument => ({
  _id: stake.id,
  patrickName: stake.patrickName,
  versionNumber: stake.versionNumber,
});

export interface MongoStakeRepositoryDeps {
  stakeModel: Model<StakeDocument>;
}

export const createMongoStakeRepository = ({ stakeModel }: MongoStakeRepositoryDeps): StakeRepository => ({
  insert: async (stake) => {
    await stakeModel.create(toDocument(stake));
    return stake;
  },

  findById: async (id) => {
    const doc = await stakeModel.findById(id).lean<StakeDocument | null>();
    return doc ? toDomain(doc) : null;
  },

  findByPatrickName: async (patrickName) => {
    const doc = await stakeModel.findOne({ patrickName }).lean<StakeDocument | null>();
    return doc ? toDomain(doc) : null;
  },

  update: async (stake) => {
    await stakeModel.replaceOne({ _id: stake.id }, toDocument(stake));
    return stake;
  },
});
