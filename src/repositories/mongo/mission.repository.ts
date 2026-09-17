import { ClientSession, Model } from 'mongoose';
import { Mission, MissionBase, MISSION_CONSTANTS } from 'models/mission.models';
import { MissionRepository } from 'repositories/mission.repository';
import { MissionDocument } from 'repositories/mongo/mission.schema';
import { TransactionContext } from 'database/database.types';
import { escapeRegex } from 'utils/regex.util';

const BASIC_PROJECTION = {
  timeInfo: 1,
  name: 1,
  comment: 1,
  createdBy: 1,
  missionType: 1,
  password: 1,
  attachedMissionId: 1
} as const;

const toSession = (context?: TransactionContext): ClientSession | null =>
  (context?.raw as ClientSession | undefined) ?? null;

const toBase = (doc: MissionDocument): MissionBase => ({
  id: doc._id,
  timeInfo: doc.timeInfo,
  name: doc.name,
  comment: doc.comment ?? '',
  createdBy: doc.createdBy ?? '',
  missionType: doc.missionType ?? '',
  password: doc.password ?? '',
  attachedMissionId: doc.attachedMissionId
});

const toDomain = (doc: MissionDocument): Mission => ({
  ...toBase(doc),
  versionNumber: doc.versionNumber ?? MISSION_CONSTANTS.BASE_VERSION_NUMBER,
  sonicProperties: doc.sonicProperties ?? undefined
});

const toDocument = (mission: Mission): MissionDocument => ({
  _id: mission.id,
  timeInfo: mission.timeInfo,
  name: mission.name,
  comment: mission.comment,
  createdBy: mission.createdBy,
  missionType: mission.missionType,
  password: mission.password,
  attachedMissionId: mission.attachedMissionId,
  versionNumber: mission.versionNumber,
  sonicProperties: mission.sonicProperties ?? undefined
});

export interface MongoMissionRepositoryDeps {
  missionModel: Model<MissionDocument>;
}

export const createMongoMissionRepository = ({
  missionModel
}: MongoMissionRepositoryDeps): MissionRepository => ({
  create: async mission => {
    await missionModel.create(toDocument(mission));
    return mission;
  },

  findById: async id => {
    const doc = await missionModel.findById(id).lean<MissionDocument | null>();
    return doc ? toDomain(doc) : null;
  },

  findByIds: async ids => {
    const docs = await missionModel.find({ _id: { $in: [...ids] } }).lean<MissionDocument[]>();
    return docs.map(toDomain);
  },

  findAllBasic: async () => {
    const docs = await missionModel.find({}, BASIC_PROJECTION).lean<MissionDocument[]>();
    return docs.map(toBase);
  },

  findAllNames: async () => {
    const docs = await missionModel
      .find({}, { name: 1 })
      .lean<Pick<MissionDocument, '_id' | 'name'>[]>();
    return docs.map(doc => doc.name);
  },

  findIdByName: async name => {
    const doc = await missionModel
      .findOne({ name }, { _id: 1 })
      .lean<Pick<MissionDocument, '_id'> | null>();
    return doc?._id ?? null;
  },

  searchByName: async name => {
    const docs = await missionModel
      .find({ name: { $regex: escapeRegex(name), $options: 'i' } }, BASIC_PROJECTION)
      .lean<MissionDocument[]>();
    return docs.map(toBase);
  },

  update: async mission => {
    await missionModel.replaceOne({ _id: mission.id }, toDocument(mission));
    return mission;
  },

  delete: async (id, context) => {
    const result = await missionModel.deleteOne({ _id: id }).session(toSession(context));
    return result.deletedCount > 0;
  }
});
