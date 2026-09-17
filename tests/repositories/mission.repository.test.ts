import { Model } from 'mongoose';
import { createMongoMissionRepository } from 'repositories/mongo/mission.repository';
import { MissionDocument } from 'repositories/mongo/mission.schema';
import {
  FIXED_DATE,
  MISSION_ID,
  MISSION_NAME,
  OTHER_MISSION_ID,
  buildMission,
} from '../fixtures/mission.fixtures';

// Mongoose queries are chainable thenables; each mocked method returns a minimal
// chain exposing only the links the repository actually uses (.lean / .session).
const leanQuery = <T>(result: T) => ({ lean: jest.fn().mockResolvedValue(result) });
const sessionQuery = <T>(result: T) => ({ session: jest.fn().mockResolvedValue(result) });

const buildMissionDocument = (overrides: Partial<MissionDocument> = {}): MissionDocument => ({
  _id: MISSION_ID,
  timeInfo: { dateCreated: FIXED_DATE, lastUpdateTime: FIXED_DATE },
  name: MISSION_NAME,
  comment: 'a comment',
  createdBy: 'tester',
  missionType: 'Training',
  password: 'secret',
  attachedMissionId: undefined,
  versionNumber: 1,
  sonicProperties: undefined,
  ...overrides,
});

describe('mongo mission.repository', () => {
  const missionModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    replaceOne: jest.fn(),
    deleteOne: jest.fn(),
  };
  const repository = createMongoMissionRepository({
    missionModel: missionModel as unknown as Model<MissionDocument>,
  });

  describe('create', () => {
    it('persists the mapped document and returns the domain mission', async () => {
      missionModel.create.mockResolvedValue(undefined);

      const result = await repository.create(buildMission());

      expect(missionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ _id: MISSION_ID, name: MISSION_NAME, versionNumber: 1 }),
      );
      expect(result).toEqual(buildMission());
    });

    it('propagates database failures', async () => {
      missionModel.create.mockRejectedValue(new Error('duplicate key'));

      await expect(repository.create(buildMission())).rejects.toThrow('duplicate key');
    });
  });

  describe('findById', () => {
    it('maps the found document to the domain model', async () => {
      missionModel.findById.mockReturnValue(leanQuery(buildMissionDocument()));

      const result = await repository.findById(MISSION_ID);

      expect(missionModel.findById).toHaveBeenCalledWith(MISSION_ID);
      expect(result).toEqual(buildMission());
    });

    it('returns null when no document matches', async () => {
      missionModel.findById.mockReturnValue(leanQuery(null));

      await expect(repository.findById(MISSION_ID)).resolves.toBeNull();
    });
  });

  describe('findByIds', () => {
    it('queries with an $in filter and maps every document', async () => {
      missionModel.find.mockReturnValue(leanQuery([buildMissionDocument()]));

      const result = await repository.findByIds([MISSION_ID, OTHER_MISSION_ID]);

      expect(missionModel.find).toHaveBeenCalledWith({ _id: { $in: [MISSION_ID, OTHER_MISSION_ID] } });
      expect(result).toHaveLength(1);
    });
  });

  describe('findAllBasic', () => {
    it('projects to base fields and omits version data', async () => {
      missionModel.find.mockReturnValue(leanQuery([buildMissionDocument()]));

      const result = await repository.findAllBasic();

      expect(result[0]).not.toHaveProperty('versionNumber');
      expect(result[0]).toMatchObject({ id: MISSION_ID, name: MISSION_NAME });
    });
  });

  describe('findAllNames', () => {
    it('returns only the mission names', async () => {
      missionModel.find.mockReturnValue(leanQuery([{ _id: MISSION_ID, name: MISSION_NAME }]));

      await expect(repository.findAllNames()).resolves.toEqual([MISSION_NAME]);
    });
  });

  describe('findIdByName', () => {
    it('returns the matching mission id', async () => {
      missionModel.findOne.mockReturnValue(leanQuery({ _id: MISSION_ID }));

      await expect(repository.findIdByName(MISSION_NAME)).resolves.toBe(MISSION_ID);
      expect(missionModel.findOne).toHaveBeenCalledWith({ name: MISSION_NAME }, { _id: 1 });
    });

    it('returns null when the name is unused', async () => {
      missionModel.findOne.mockReturnValue(leanQuery(null));

      await expect(repository.findIdByName(MISSION_NAME)).resolves.toBeNull();
    });
  });

  describe('searchByName', () => {
    it('escapes regex metacharacters in the search term', async () => {
      missionModel.find.mockReturnValue(leanQuery([]));

      await repository.searchByName('a.b(c)');

      expect(missionModel.find).toHaveBeenCalledWith(
        { name: { $regex: 'a\\.b\\(c\\)', $options: 'i' } },
        expect.any(Object),
      );
    });
  });

  describe('update', () => {
    it('replaces the document by id', async () => {
      missionModel.replaceOne.mockResolvedValue({ matchedCount: 1 });
      const mission = buildMission({ versionNumber: 2 });

      const result = await repository.update(mission);

      expect(missionModel.replaceOne).toHaveBeenCalledWith(
        { _id: MISSION_ID },
        expect.objectContaining({ versionNumber: 2 }),
      );
      expect(result).toEqual(mission);
    });
  });

  describe('delete', () => {
    it('returns true when a document was deleted', async () => {
      missionModel.deleteOne.mockReturnValue(sessionQuery({ deletedCount: 1 }));

      await expect(repository.delete(MISSION_ID)).resolves.toBe(true);
      expect(missionModel.deleteOne).toHaveBeenCalledWith({ _id: MISSION_ID });
    });

    it('returns false when nothing matched', async () => {
      missionModel.deleteOne.mockReturnValue(sessionQuery({ deletedCount: 0 }));

      await expect(repository.delete(MISSION_ID)).resolves.toBe(false);
    });

    it('passes the transaction session to the query', async () => {
      const query = sessionQuery({ deletedCount: 1 });
      missionModel.deleteOne.mockReturnValue(query);
      const session = { id: 'session' };

      await repository.delete(MISSION_ID, { raw: session });

      expect(query.session).toHaveBeenCalledWith(session);
    });
  });
});
