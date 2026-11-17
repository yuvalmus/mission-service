import { PG_TABLES } from 'constants/postgres.constants';
import { PostgresDatabase } from 'database/postgres.database';
import { TransactionContext } from 'database/database.types';

export interface EntityVersionRow {
  event_id: string;
  entity_id: string;
  version: string;
  entity_type: string;
  origin_node: string;
  mission_change_seq: string;
  last_update_time: Date;
  is_deleted: boolean;
  is_current: boolean;
  geometry: unknown | null;
  properties: Record<string, unknown> | null;
}

export interface HistoryRepository {
  listVersions(entityId: string): Promise<EntityVersionRow[]>;
  restoreVersion(entityId: string, eventId: string, nodeName: string, context?: TransactionContext): Promise<boolean>;
  duplicateFromVersion(
    entityId: string,
    eventId: string,
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
    b.event_id,
    b.entity_id,
    b.version,
    b.entity_type,
    b.origin_node,
    b.mission_change_seq,
    b.last_update_time,
    b.is_deleted,
    COALESCE(e.origin_node = b.origin_node AND e.mission_change_seq = b.mission_change_seq, false) AS is_current,
    ST_AsGeoJSON(b.geom)::jsonb AS geometry,
    b.properties
  FROM ${PG_TABLES.ROUTE_BACKUPS} b
  LEFT JOIN ${PG_TABLES.ENTITIES} e ON e.entity_id = b.entity_id
  WHERE b.entity_id = $1
  ORDER BY b.last_update_time DESC, b.mission_change_seq DESC
`;

/**
 * Restoring is an ordinary update, not a rewind. The restored state is filed into the history as a
 * new version, the version advances and the change replicates like any other — so a restore can
 * itself be undone, and the peers learn about it through delta sync.
 */
const RESTORE_VERSION = `
  UPDATE ${PG_TABLES.ENTITIES} e
  SET geom = b.geom,
      properties = b.properties,
      is_deleted = false,
      origin_node = $3
  FROM ${PG_TABLES.ROUTE_BACKUPS} b
  WHERE e.entity_id = $1
    AND b.entity_id = $1
    AND b.event_id = $2
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
  WHERE b.entity_id = $1
    AND b.event_id = $2
  RETURNING entity_id
`;

export const createPostgresHistoryRepository = ({
  database,
}: PostgresHistoryRepositoryDeps): HistoryRepository => ({
  listVersions: async (entityId) => {
    const result = await database.withContext(undefined, (client) =>
      client.query<EntityVersionRow>(LIST_VERSIONS, [entityId]),
    );
    return result.rows;
  },

  restoreVersion: async (entityId, eventId, nodeName, context) => {
    const result = await database.withContext(context, (client) =>
      client.query(RESTORE_VERSION, [entityId, eventId, nodeName]),
    );
    return (result.rowCount ?? 0) > 0;
  },

  duplicateFromVersion: async (entityId, eventId, name, nodeName, context) => {
    const result = await database.withContext(context, (client) =>
      client.query<{ entity_id: string }>(DUPLICATE_FROM_VERSION, [entityId, eventId, name, nodeName]),
    );
    return result.rows[0]?.entity_id ?? null;
  },
});
