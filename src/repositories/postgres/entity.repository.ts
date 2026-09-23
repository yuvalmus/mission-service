import { DatabaseError } from 'pg';
import { EntityType } from 'constants/entity.constants';
import { ERROR_MESSAGES } from 'constants/error.constants';
import {
  ENTITY_SCHEMA_VERSION,
  PG_ERROR_CODES,
  PG_FUNCTIONS,
  PG_TABLES,
  PG_VIEWS,
} from 'constants/postgres.constants';
import { TransactionContext } from 'database/database.types';
import { PostgresDatabase } from 'database/postgres.database';
import { BadRequestError, DatabaseOperationError } from 'errors/app.errors';
import { AnyEntity } from 'models/entity-union.models';
import { EntityRow, parseEntityRow, toEntityWriteRow } from 'mappers/entity-row.mapper';
import { EntityRepository } from 'repositories/entity.repository';
import { isUuid } from 'utils/sql.util';
import { AppLogger } from 'utils/logger.util';

export interface PostgresEntityRepositoryDeps {
  database: PostgresDatabase;
  nodeName: string;
  logger: AppLogger;
}

const ENTITY_PROJECTION = `
  entity_id,
  mission_id,
  infra_id,
  entity_type,
  properties,
  version,
  mission_change_seq,
  schema_version,
  is_deleted,
  origin_node
`;

/**
 * `parentId` is a mission id or a stake id. Exactly one of the two sub-selects yields a row, which
 * is what satisfies the `belongs_to_one` constraint; if neither does, the constraint rejects the
 * write and the caller gets a 400 instead of a raw database error.
 */
const RESOLVE_MISSION = `(SELECT id FROM ${PG_TABLES.MISSIONS} WHERE id = $2 AND deleted_at IS NULL)`;
const RESOLVE_INFRA = `(SELECT id FROM ${PG_TABLES.INFRA} WHERE id = $2 AND deleted_at IS NULL)`;

const INSERT_ENTITY = `
  INSERT INTO ${PG_TABLES.ENTITIES}
    (entity_id, mission_id, infra_id, entity_type, geom, properties, schema_version, origin_node)
  VALUES
    ($1, ${RESOLVE_MISSION}, ${RESOLVE_INFRA}, $3, ${PG_FUNCTIONS.GEOM_FROM_GEOJSON}($4::jsonb), $5::jsonb, $6, $7)
  RETURNING entity_id
`;

const UPDATE_ENTITY = `
  UPDATE ${PG_TABLES.ENTITIES}
  SET mission_id = ${RESOLVE_MISSION},
      infra_id = ${RESOLVE_INFRA},
      entity_type = $3,
      geom = ${PG_FUNCTIONS.GEOM_FROM_GEOJSON}($4::jsonb),
      properties = $5::jsonb,
      schema_version = $6,
      origin_node = $7
  WHERE entity_id = $1
    AND is_deleted = false
  RETURNING entity_id
`;

/**
 * Deletion is a tombstone, never a physical DELETE. A row that simply vanished could not be
 * reported by the delta feed, so a peer's map would keep drawing it. Flipping the flag is an
 * ordinary update: the version rises, the change replicates, and every station learns to remove
 * the entity. The background collector reclaims the row later.
 */
const TOMBSTONE_ENTITY = `
  UPDATE ${PG_TABLES.ENTITIES}
  SET is_deleted = true
  WHERE entity_id = $1
    AND is_deleted = false
  RETURNING entity_id
`;

const TOMBSTONE_BY_PARENT = `
  UPDATE ${PG_TABLES.ENTITIES}
  SET is_deleted = true
  WHERE (mission_id = $1 OR infra_id = $1)
    AND is_deleted = false
  RETURNING entity_id
`;

const isCheckViolation = (error: unknown): boolean =>
  error instanceof DatabaseError && error.code === PG_ERROR_CODES.CHECK_VIOLATION;

export const createPostgresEntityRepository = ({
  database,
  nodeName,
  logger,
}: PostgresEntityRepositoryDeps): EntityRepository => {
  const toDomainList = (rows: EntityRow[]): AnyEntity[] =>
    rows.reduce<AnyEntity[]>((entities, row) => {
      const { entity, issues } = parseEntityRow(row);
      if (!entity) {
        logger.warn({ entityId: row.entity_id, issues }, 'Skipping entity that does not match the current schema');
        return entities;
      }
      return [...entities, entity];
    }, []);

  const writeEntity = async (
    sql: string,
    entity: AnyEntity,
    context: TransactionContext | undefined,
  ): Promise<number> => {
    const row = toEntityWriteRow(entity);
    const values = [
      row.id,
      row.parentId,
      row.entityType,
      row.geometry === null ? null : JSON.stringify(row.geometry),
      JSON.stringify(row.properties),
      ENTITY_SCHEMA_VERSION,
      nodeName,
    ];

    try {
      const result = await database.withContext(context, (client) => client.query(sql, values));
      return result.rowCount ?? 0;
    } catch (error) {
      if (isCheckViolation(error)) {
        const constraint = error instanceof DatabaseError ? error.constraint : undefined;
        logger.warn({ entityId: entity.id, constraint }, 'Entity rejected by a database constraint');
        throw new BadRequestError(
          constraint === 'belongs_to_one'
            ? ERROR_MESSAGES.ENTITY_PARENT_NOT_FOUND(entity.parentId)
            : ERROR_MESSAGES.ENTITY_INTEGRITY_VIOLATION(entity.entityType, entity.id),
        );
      }
      if (error instanceof DatabaseError) {
        throw new DatabaseOperationError(error.message);
      }
      throw error;
    }
  };

  const selectEntities = async (where: string, values: unknown[]): Promise<AnyEntity[]> => {
    const result = await database.withContext(undefined, (client) =>
      client.query<EntityRow>(`SELECT ${ENTITY_PROJECTION} FROM ${PG_VIEWS.ACTIVE_ENTITIES} WHERE ${where}`, values),
    );
    return toDomainList(result.rows);
  };

  return {
    insert: async (entity, context) => {
      await writeEntity(INSERT_ENTITY, entity, context);
      return entity;
    },

    update: async (entity, context) => {
      const affected = await writeEntity(UPDATE_ENTITY, entity, context);
      if (affected === 0) {
        logger.warn({ entityId: entity.id }, 'Update matched no active entity');
      }
      return entity;
    },

    findById: async (id) => {
      if (!isUuid(id)) return null;
      const [entity] = await selectEntities('entity_id = $1', [id]);
      return entity ?? null;
    },

    findByParentId: (parentId) => selectEntities('(mission_id = $1 OR infra_id = $1)', [parentId]),

    findByType: (entityType: EntityType) => selectEntities('entity_type = $1', [entityType]),

    findNamesByParentId: async (parentId) => {
      const result = await database.withContext(undefined, (client) =>
        client.query<{ name: string | null }>(
          `SELECT name FROM ${PG_VIEWS.ACTIVE_ENTITIES} WHERE mission_id = $1 OR infra_id = $1`,
          [parentId],
        ),
      );
      return result.rows.map((row) => row.name ?? '');
    },

    isNameTaken: async (parentId, entityId, name) => {
      const result = await database.withContext(undefined, (client) =>
        client.query(
          `SELECT 1
           FROM ${PG_VIEWS.ACTIVE_ENTITIES}
           WHERE (mission_id = $1 OR infra_id = $1)
             AND name = $2
             AND entity_id <> $3
           LIMIT 1`,
          [parentId, name, entityId],
        ),
      );
      return (result.rowCount ?? 0) > 0;
    },

    deleteById: async (id, context) => {
      const result = await database.withContext(context, (client) => client.query(TOMBSTONE_ENTITY, [id]));
      return (result.rowCount ?? 0) > 0;
    },

    deleteByParentId: async (parentId, context) => {
      const result = await database.withContext(context, (client) => client.query(TOMBSTONE_BY_PARENT, [parentId]));
      logger.info({ parentId, tombstoned: result.rowCount ?? 0 }, 'Tombstoned entities of parent');
      return true;
    },
  };
};
