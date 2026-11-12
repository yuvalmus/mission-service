import { PG_TABLES } from 'constants/postgres.constants';
import { PostgresDatabase } from 'database/postgres.database';
import { TransactionContext } from 'database/database.types';

export interface EntityBackupRow {
  backup_id: string;
  route_id: string;
  version: string;
  entity_type: string;
  geometry: unknown | null;
  properties: Record<string, unknown> | null;
  is_deleted: boolean;
  updated_by_node: string | null;
  created_at: Date;
}

export interface HistoryRepository {
  listVersions(entityId: string, limit: number): Promise<EntityBackupRow[]>;
  restoreVersion(entityId: string, version: number, nodeName: string, context?: TransactionContext): Promise<boolean>;
  duplicateFromVersion(
    entityId: string,
    version: number,
    name: string | null,
    nodeName: string,
    context?: TransactionContext,
  ): Promise<string | null>;
}

export interface PostgresHistoryRepositoryDeps {
  database: PostgresDatabase;
}

const LIST_VERSIONS = `
  SELECT
    backup_id,
    route_id,
    version,
    entity_type,
    ST_AsGeoJSON(geom)::jsonb AS geometry,
    properties,
    is_deleted,
    updated_by_node,
    created_at
  FROM ${PG_TABLES.ROUTE_BACKUPS}
  WHERE route_id = $1
  ORDER BY version DESC
  LIMIT $2
`;

/**
 * Restoring is an ordinary update, not a rewind. The state being replaced is copied into the
 * history by the same BEFORE trigger, the version advances and the change replicates like any
 * other — so a restore can itself be undone, and the peers learn about it through delta sync.
 */
const RESTORE_VERSION = `
  UPDATE ${PG_TABLES.ENTITIES} e
  SET geom = b.geom,
      properties = b.properties,
      is_deleted = false,
      origin_node = $3
  FROM ${PG_TABLES.ROUTE_BACKUPS} b
  WHERE e.entity_id = $1
    AND b.route_id = $1
    AND b.version = $2
  RETURNING e.entity_id
`;

/** A fresh UUID, so the copy can never collide with a row minted on the peer while disconnected. */
const DUPLICATE_FROM_VERSION = `
  INSERT INTO ${PG_TABLES.ENTITIES}
    (entity_id, mission_id, infra_id, entity_type, geom, properties, origin_node)
  SELECT
    gen_random_uuid(),
    b.mission_id,
    b.infra_id,
    b.entity_type,
    b.geom,
    CASE WHEN $3::text IS NULL THEN b.properties ELSE jsonb_set(b.properties, '{name}', to_jsonb($3::text)) END,
    $4
  FROM ${PG_TABLES.ROUTE_BACKUPS} b
  WHERE b.route_id = $1
    AND b.version = $2
  RETURNING entity_id
`;

export const createPostgresHistoryRepository = ({
  database,
}: PostgresHistoryRepositoryDeps): HistoryRepository => ({
  listVersions: async (entityId, limit) => {
    const result = await database.withContext(undefined, (client) =>
      client.query<EntityBackupRow>(LIST_VERSIONS, [entityId, limit]),
    );
    return result.rows;
  },

  restoreVersion: async (entityId, version, nodeName, context) => {
    const result = await database.withContext(context, (client) =>
      client.query(RESTORE_VERSION, [entityId, version, nodeName]),
    );
    return (result.rowCount ?? 0) > 0;
  },

  duplicateFromVersion: async (entityId, version, name, nodeName, context) => {
    const result = await database.withContext(context, (client) =>
      client.query<{ entity_id: string }>(DUPLICATE_FROM_VERSION, [entityId, version, name, nodeName]),
    );
    return result.rows[0]?.entity_id ?? null;
  },
});
