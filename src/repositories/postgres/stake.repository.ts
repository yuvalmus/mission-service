import { DatabaseError } from 'pg';
import { PG_TABLES } from 'constants/postgres.constants';
import { PostgresDatabase } from 'database/postgres.database';
import { DatabaseOperationError } from 'errors/app.errors';
import { Patrick, Stake, STAKE_CONSTANTS } from 'models/stake.models';
import { StakeRepository } from 'repositories/stake.repository';
import { isUuid } from 'utils/sql.util';

export interface PostgresStakeRepositoryDeps {
  database: PostgresDatabase;
  nodeName: string;
}

export interface InfraRow {
  id: string;
  squadron: string;
  version_number: number;
}

/**
 * Stakes are stored in the architecture's `infra` table.
 *
 * `infra` is the non-mission parent an entity may belong to, keyed by the squadron that owns it —
 * which is precisely what a stake is here, keyed by its patrick. Mapping them onto one table is
 * what lets `entities.belongs_to_one` hold for both kinds of parent without a second entity table.
 */
const INFRA_PROJECTION = 'id, squadron, version_number';

const ACTIVE_ONLY = 'deleted_at IS NULL';

const toDomain = (row: InfraRow): Stake => ({
  id: row.id,
  patrickName: row.squadron as Patrick,
  versionNumber: row.version_number ?? STAKE_CONSTANTS.BASE_VERSION_NUMBER,
});

const INSERT_INFRA = `
  INSERT INTO ${PG_TABLES.INFRA} (id, squadron, version_number, origin_node)
  VALUES ($1, $2, $3, $4)
`;

const UPDATE_INFRA = `
  UPDATE ${PG_TABLES.INFRA}
  SET squadron = $2,
      version_number = $3,
      last_update_time = NOW(),
      origin_node = $4
  WHERE id = $1
    AND ${ACTIVE_ONLY}
`;

export const createPostgresStakeRepository = ({
  database,
  nodeName,
}: PostgresStakeRepositoryDeps): StakeRepository => {
  const query = async <T extends object>(sql: string, values: unknown[] = []): Promise<T[]> => {
    try {
      const result = await database.withContext(undefined, (client) => client.query<T>(sql, values));
      return result.rows;
    } catch (error) {
      if (error instanceof DatabaseError) throw new DatabaseOperationError(error.message);
      throw error;
    }
  };

  const selectInfra = (where: string, values: unknown[]): Promise<InfraRow[]> =>
    query<InfraRow>(`SELECT ${INFRA_PROJECTION} FROM ${PG_TABLES.INFRA} WHERE ${where} LIMIT 1`, values);

  return {
    insert: async (stake) => {
      await query(INSERT_INFRA, [stake.id, stake.patrickName, stake.versionNumber, nodeName]);
      return stake;
    },

    update: async (stake) => {
      await query(UPDATE_INFRA, [stake.id, stake.patrickName, stake.versionNumber, nodeName]);
      return stake;
    },

    findById: async (id) => {
      if (!isUuid(id)) return null;
      const [row] = await selectInfra(`id = $1 AND ${ACTIVE_ONLY}`, [id]);
      return row ? toDomain(row) : null;
    },

    findByPatrickName: async (patrickName) => {
      const [row] = await selectInfra(`squadron = $1 AND ${ACTIVE_ONLY}`, [patrickName]);
      return row ? toDomain(row) : null;
    },
  };
};
