import { Connection, Model, Schema } from 'mongoose';
import { COLLECTIONS, MODEL_NAMES } from 'constants/app.constants';
import { SonicMissionProperties } from 'models/mission.models';
import { TimeInfo } from 'models/time.models';

export interface MissionDocument {
  _id: string;
  timeInfo: TimeInfo;
  name: string;
  comment?: string;
  createdBy?: string;
  missionType?: string;
  password?: string;
  attachedMissionId?: number;
  versionNumber: number;
  sonicProperties?: SonicMissionProperties;
}

const missionSchema = new Schema<MissionDocument>(
{
    _id: { type: String, required: true },
    timeInfo: {
      type: new Schema(
        {
          dateCreated: { type: Date },
          lastUpdateTime: { type: Date }
        },
        { _id: false }
      ),
      default: null
    },
    name: { type: String, required: true },
    comment: { type: String },
    createdBy: { type: String },
    missionType: { type: String },
    password: { type: String },
    attachedMissionId: { type: Number },
    versionNumber: { type: Number, required: true },
    sonicProperties: { type: Schema.Types.Mixed, default: null }
  },
  { collection: COLLECTIONS.MISSIONS, versionKey: false }
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
    parentId: { type: String, index: true }
  },
  { collection: COLLECTIONS.ENTITIES, versionKey: false, strict: false }
);

export const createMissionModel = (connection: Connection): Model<MissionDocument> =>
  connection.model<MissionDocument>(MODEL_NAMES.MISSION, missionSchema);

export const createEntityModel = (connection: Connection): Model<EntityDocument> =>
  connection.model<EntityDocument>(MODEL_NAMES.ENTITY, entitySchema);
