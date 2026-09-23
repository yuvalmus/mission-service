import { DatabaseError } from 'pg';
import { PG_ERROR_CODES, PG_TABLES, PG_VIEWS } from 'constants/postgres.constants';
import { ERROR_MESSAGES } from 'constants/error.constants';
import { BadRequestError } from 'errors/app.errors';
import { createPostgresEntityRepository } from 'repositories/postgres/entity.repository';
import { createPostgresMissionRepository } from 'repositories/postgres/mission.repository';
import { createPostgresStakeRepository } from 'repositories/postgres/stake.repository';
import { toEntityProperties } from 'mappers/entity-row.mapper';
import { buildCircle } from '../fixtures/entity.fixtures';
import { buildMission, MISSION_ID } from '../fixtures/mission.fixtures';
import { createPostgresDatabaseMock, NODE_NAME, normalizeSql, PostgresDatabaseMock } from '../fixtures/postgres.fixtures';

const STAKE_ID = '9f8e7d6c-5555-4444-8333-222211110000';

const buildLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
}) as never;

const checkViolation = (constraint: string): DatabaseError => {
  const error = new DatabaseError('violates check constraint', 0, 'error');
  Object.assign(error, { code: PG_ERROR_CODES.CHECK_VIOLATION, constraint });
  return error;
};

describe('postgres repositories', () => {
  const mock = { value: undefined as unknown as PostgresDatabaseMock };

  beforeEach(() => {
    mock.value = createPostgresDatabaseMock();
  });

  const entityRepository = () =>
    createPostgresEntityRepository({ database: mock.value.database, nodeName: NODE_NAME, logger: buildLogger() });

  const missionRepository = () =>
    createPostgresMissionRepository({ database: mock.value.database, nodeName: NODE_NAME });

  const stakeRepository = () => createPostgresStakeRepository({ database: mock.value.database, nodeName: NODE_NAME });

  describe('entity repository', () => {
    it('resolves the parent against both missions and infra so belongs_to_one can hold', async () => {
      await entityRepository().insert(buildCircle());

      const sql = normalizeSql(mock.value.lastQuery()?.sql ?? '');
      expect(sql).toContain(`SELECT id FROM ${PG_TABLES.MISSIONS} WHERE id = $2`);
      expect(sql).toContain(`SELECT id FROM ${PG_TABLES.INFRA} WHERE id = $2`);
      expect(mock.value.lastQuery()?.values[1]).toBe(MISSION_ID);
    });

    it('stamps the writing station on every row', async () => {
      await entityRepository().insert(buildCircle());

      expect(mock.value.lastQuery()?.values).toContain(NODE_NAME);
    });

    it('translates an unresolvable parent into a 400 rather than a raw database error', async () => {
      mock.value.queueFailure(checkViolation('belongs_to_one'));

      await expect(entityRepository().insert(buildCircle())).rejects.toThrow(
        new BadRequestError(ERROR_MESSAGES.ENTITY_PARENT_NOT_FOUND(MISSION_ID)),
      );
    });

    it('translates a geometry that contradicts the entity type into a 400', async () => {
      mock.value.queueFailure(checkViolation('enforce_spatial_integrity'));

      await expect(entityRepository().insert(buildCircle())).rejects.toBeInstanceOf(BadRequestError);
    });

    it('tombstones an entity instead of deleting the row, so the delta feed can report it', async () => {
      mock.value.queueResult([{ entity_id: buildCircle().id }]);

      const deleted = await entityRepository().deleteById(buildCircle().id);

      const sql = normalizeSql(mock.value.lastQuery()?.sql ?? '');
      expect(sql).toContain(`UPDATE ${PG_TABLES.ENTITIES} SET is_deleted = true`);
      expect(sql).not.toContain('DELETE');
      expect(deleted).toBe(true);
    });

    it('reports nothing deleted when the entity was already a tombstone', async () => {
      expect(await entityRepository().deleteById(buildCircle().id)).toBe(false);
    });

    it('tombstones every live child of a parent', async () => {
      await entityRepository().deleteByParentId(MISSION_ID);

      const sql = normalizeSql(mock.value.lastQuery()?.sql ?? '');
      expect(sql).toContain('WHERE (mission_id = $1 OR infra_id = $1) AND is_deleted = false');
    });

    it('reads through the masking view so tombstones and closed missions stay hidden', async () => {
      await entityRepository().findByParentId(MISSION_ID);

      expect(normalizeSql(mock.value.lastQuery()?.sql ?? '')).toContain(`FROM ${PG_VIEWS.ACTIVE_ENTITIES}`);
    });

    it('treats a malformed id as not found instead of letting the uuid cast fail', async () => {
      expect(await entityRepository().findById('not-a-uuid')).toBeNull();
      expect(mock.value.queries).toHaveLength(0);
    });

    it('skips a stored entity that no longer matches the schema rather than failing the read', async () => {
      const circle = buildCircle();
      mock.value.queueResult([
        {
          entity_id: circle.id,
          mission_id: MISSION_ID,
          infra_id: null,
          entity_type: circle.entityType,
          properties: { ...toEntityProperties(circle), color: 'NotARealColor' },
        },
      ]);

      expect(await entityRepository().findByParentId(MISSION_ID)).toEqual([]);
    });
  });

  describe('mission repository', () => {
    it('masks a mission top-down instead of deleting it', async () => {
      mock.value.queueResult([{ id: MISSION_ID }]);

      const deleted = await missionRepository().delete(MISSION_ID);

      const sql = normalizeSql(mock.value.lastQuery()?.sql ?? '');
      expect(sql).toContain(`UPDATE ${PG_TABLES.MISSIONS} SET deleted_at = NOW()`);
      expect(sql).not.toContain('DELETE');
      expect(deleted).toBe(true);
    });

    it('hides masked missions from every read', async () => {
      await missionRepository().findAllBasic();

      expect(normalizeSql(mock.value.lastQuery()?.sql ?? '')).toContain('deleted_at IS NULL');
    });

    it('matches a search term literally by escaping LIKE wildcards', async () => {
      await missionRepository().searchByName('100%_real');

      expect(mock.value.lastQuery()?.values[0]).toBe('100\\%\\_real');
    });

    it('round-trips a mission through its row columns', async () => {
      const mission = buildMission();
      mock.value.queueResult([
        {
          id: mission.id,
          name: mission.name,
          version_number: mission.versionNumber,
          comment: mission.comment,
          created_by: mission.createdBy,
          mission_type: mission.missionType,
          password: mission.password,
          attached_mission_id: null,
          sonic_properties: null,
          date_created: mission.timeInfo.dateCreated,
          last_update_time: mission.timeInfo.lastUpdateTime,
        },
      ]);

      expect(await missionRepository().findById(MISSION_ID)).toEqual(mission);
    });
  });

  describe('stake repository', () => {
    it('stores a stake in the infra table keyed by its squadron', async () => {
      await stakeRepository().insert({ id: STAKE_ID, patrickName: 'patrick1', versionNumber: 1 });

      const sql = normalizeSql(mock.value.lastQuery()?.sql ?? '');
      expect(sql).toContain(`INSERT INTO ${PG_TABLES.INFRA} (id, squadron, version_number, origin_node)`);
      expect(mock.value.lastQuery()?.values).toEqual([STAKE_ID, 'patrick1', 1, NODE_NAME]);
    });

    it('finds a stake by the squadron column', async () => {
      mock.value.queueResult([{ id: STAKE_ID, squadron: 'patrick1', version_number: 3 }]);

      expect(await stakeRepository().findByPatrickName('patrick1')).toEqual({
        id: STAKE_ID,
        patrickName: 'patrick1',
        versionNumber: 3,
      });
    });
  });
});
