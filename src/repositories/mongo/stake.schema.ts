import { Connection, Model, Schema } from 'mongoose';
import { COLLECTIONS } from 'constants/app.constants';

const STAKE_MODEL_NAME = 'Stake';

export interface StakeDocument {
  _id: string;
  patrickName: string;
  versionNumber: number;
}

const stakeSchema = new Schema<StakeDocument>(
  {
    _id: { type: String, required: true },
    patrickName: { type: String, required: true, index: true },
    versionNumber: { type: Number, required: true }
  },
  { collection: COLLECTIONS.STAKES, versionKey: false }
);

export const createStakeModel = (connection: Connection): Model<StakeDocument> =>
  connection.model<StakeDocument>(STAKE_MODEL_NAME, stakeSchema);