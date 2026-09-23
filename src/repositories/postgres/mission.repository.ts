import { DatabaseError } from 'pg';
import { PG_TABLES } from 'constants/postgres.constants';
import { PostgresDatabase } from 'database/postgres.database';
import { DatabaseOperationError } from 'errors/app.errors';
import { Mission, MissionBase, MISSION_CONSTANTS, SonicMissionProperties } from 'models/mission.models';
import { MissionRepository } from 'repositories/mission.repository';
import { escapeLikePattern, isUuid, LIKE_ESCAPE_CHARACTER } from 'utils/sql.util';

export interface PostgresMissionRepositoryDeps {
  database: PostgresDatabase;
  nodeName: string;
}

export interface MissionRow {
  id: string;
  name: string;
  version_number: number;
  comment: string | null;
  created_by: string | null;
  mission_type: string | null;
  password: string | null;
  attached_mission_id: number | null;
  sonic_properties: SonicMissionProperties | null;
  date_created: Date;
  last_update_time: Date;
}

const MISSION_PROJECTION = `
  id,
  name,
  version_number,
  comment,
  created_by,
  mission_type,
  password,
  attached_mission_id,
  sonic_properties,
  date_created,
  last_update_time
`;

/** Soft-deleted missions are invisible to every read — see the top-down masking view. */
const ACTIVE_ONLY = 'deleted_at IS NULL';

const toBase = (row: MissionRow): MissionBase => ({
  id: row.id,
  timeInfo: { dateCreated: row.date_created, lastUpdateTime: row.last_update_time },
  name: row.name,
  comment: row.comment ?? '',
  createdBy: row.created_by ?? '',
  missionType: row.mission_type ?? '',
  password: row.password ?? '',
  attachedMissionId: row.attached_mission_id ?? undefined,
});

const toDomain = (row: MissionRow): Mission => ({
  ...toBase(row),
  versionNumber: row.version_number ?? MISSION_CONSTANTS.BASE_VERSION_NUMBER,
  sonicProperties: row.sonic_properties ?? undefined,
});

const toValues = (mission: Mission, nodeName: string): unknown[] => [
  mission.id,
  mission.name,
  mission.versionNumber,
  mission.comment ?? null,
  mission.createdBy ?? null,
  mission.missionType ?? null,
  mission.password ?? null,
  mission.attachedMissionId ?? null,
  mission.sonicProperties ? JSON.stringify(mission.sonicProperties) : null,
  mission.timeInfo?.dateCreated ?? new Date(),
  mission.timeInfo?.lastUpdateTime ?? new Date(),
  nodeName,
];

const INSERT_MISSION = `
  INSERT INTO ${PG_TABLES.MISSIONS}
    (id, name, version_number, comment, created_by, mission_type, password,
     attached_mission_id, sonic_properties, date_created, last_update_time, origin_node)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
`;

const UPDATE_MISSION = `
  UPDATE ${PG_TABLES.MISSIONS}
  SET name = $2,
      version_number = $3,
      comment = $4,
      created_by = $5,
      mission_type = $6,
      password = $7,
      attached_mission_id = $8,
      sonic_properties = $9::jsonb,
      date_created = $10,
      last_update_time = $11,
      origin_node = $12
  WHERE id = $1
    AND ${ACTIVE_ONLY}
`;

/**
 * Top-down view masking. One timestamp on the parent hides every entity beneath it, so closing a
 * mission with thousands of entities is a single replicated write instead of a tombstone per row.
 * The background collector performs the physical delete once the peers have had time to catch up.
 */
const SOFT_DELETE_MISSION = `
  UPDATE ${PG_TABLES.MISSIONS}
  SET deleted_at = NOW()
  WHERE id = $1
    AND ${ACTIVE_ONLY}
  RETURNING id
`;

export const createPostgresMissionRepository = ({
  database,
  nodeName,
}: PostgresMissionRepositoryDeps): MissionRepository => {
  const query = async <T extends object>(sql: string, values: unknown[] = []): Promise<T[]> => {
    try {
      const result = await database.withContext(undefined, (client) => client.query<T>(sql, values));
      return result.rows;
    } catch (error) {
      if (error instanceof DatabaseError) throw new DatabaseOperationError(error.message);
      throw error;
    }
  };

  const selectMissions = (where: string, values: unknown[] = []): Promise<MissionRow[]> =>
    query<MissionRow>(`SELECT ${MISSION_PROJECTION} FROM ${PG_TABLES.MISSIONS} WHERE ${where}`, values);

  return {
    create: async (mission) => {
      await query(INSERT_MISSION, toValues(mission, nodeName));
      return mission;
    },

    update: async (mission) => {
      await query(UPDATE_MISSION, toValues(mission, nodeName));
      return mission;
    },

    findById: async (id) => {
      if (!isUuid(id)) return null;
      const [row] = await selectMissions(`id = $1 AND ${ACTIVE_ONLY}`, [id]);
      return row ? toDomain(row) : null;
    },

    findByIds: async (ids) => {
      const rows = await selectMissions(`id = ANY($1::uuid[]) AND ${ACTIVE_ONLY}`, [ids.filter(isUuid)]);
      return rows.map(toDomain);
    },

    findAllBasic: async () => {
      const rows = await selectMissions(ACTIVE_ONLY);
      return rows.map(toBase);
    },

    findAllNames: async () => {
      const rows = await query<{ name: string }>(
        `SELECT name FROM ${PG_TABLES.MISSIONS} WHERE ${ACTIVE_ONLY}`,
      );
      return rows.map((row) => row.name);
    },

    findIdByName: async (name) => {
      const rows = await query<{ id: string }>(
        `SELECT id FROM ${PG_TABLES.MISSIONS} WHERE name = $1 AND ${ACTIVE_ONLY} LIMIT 1`,
        [name],
      );
      return rows[0]?.id ?? null;
    },

    searchByName: async (name) => {
      const rows = await selectMissions(
        `name ILIKE '%' || $1 || '%' ESCAPE '${LIKE_ESCAPE_CHARACTER}' AND ${ACTIVE_ONLY}`,
        [escapeLikePattern(name)],
      );
      return rows.map(toBase);
    },

    delete: async (id, context) => {
      const result = await database.withContext(context, (client) => client.query(SOFT_DELETE_MISSION, [id]));
      return (result.rowCount ?? 0) > 0;
    },
  };
};
