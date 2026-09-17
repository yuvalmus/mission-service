import { Connection, Model, Schema } from 'mongoose';
import { COLLECTIONS, MODEL_NAMES } from '@constants/app.constants';
import { SonicMissionProperties } from '@models/mission.models';

export interface MissionDocument {
  _id: string;
  timeInfo?: { dateCreated: Date; lastUpdateTime: Date } | null;
  name: string;
  comment?: string | null;
  createdBy?: string | null;
  missionType?: string | null;
  password?: string | null;
  attachedMissionId?: number | null;
  versionNumber: number;
  sonicProperties?: SonicMissionProperties | null;
}

const missionSchema = new Schema<MissionDocument>(
  {
    _id: { type: String, required: true },
    timeInfo: {
      type: new Schema(
        {
          dateCreated: { type: Date },
          lastUpdateTime: { type: Date },
        },
        { _id: false },
      ),
      default: null,
    },
    name: { type: String, required: true },
    comment: { type: String, default: null },
    createdBy: { type: String, default: null },
    missionType: { type: String, default: null },
    password: { type: String, default: null },
    attachedMissionId: { type: Number, default: null },
    versionNumber: { type: Number, required: true },
    sonicProperties: { type: Schema.Types.Mixed, default: null },
  },
  { collection: COLLECTIONS.MISSIONS, versionKey: false },
);

export interface EntityDocument {
  _id: string;
  parentId: string;
  name?: string;
  [key: string]: unknown;
}

const entitySchema = new Schema<EntityDocument>(
  {
    _id: { type: String, required: true },
    parentId: { type: String, index: true },
  },
  { collection: COLLECTIONS.ENTITIES, versionKey: false, strict: false },
);

export const createMissionModel = (connection: Connection): Model<MissionDocument> =>
  connection.model<MissionDocument>(MODEL_NAMES.MISSION, missionSchema);

export const createEntityModel = (connection: Connection): Model<EntityDocument> =>
  connection.model<EntityDocument>(MODEL_NAMES.ENTITY, entitySchema);
