import { PG_TABLES, PG_VIEWS } from 'constants/postgres.constants';
import { PostgresDatabase } from 'database/postgres.database';

export interface EntityDeltaRow {
  entity_id: string;
  parent_id: string;
  entity_type: string;
  name: string | null;
  category: string | null;
  geometry: unknown | null;
  properties: Record<string, unknown>;
  version: string;
  mission_change_seq: string;
  schema_version: number;
  is_deleted: boolean;
  is_hidden: boolean;
  origin_node: string;
  last_update_time: Date;
}

export interface EntityRenderRow {
  entity_id: string;
  parent_id: string;
  entity_type: string;
  name: string | null;
  category: string | null;
  geometry: unknown | null;
  properties: Record<string, unknown>;
  version: string;
  mission_change_seq: string;
  schema_version: number;
  origin_node: string;
}

export interface SyncStatusRow {
  parent_id: string | null;
  parent_kind: string | null;
  is_deleted: boolean;
  last_change_seq: string | null;
  entity_count: string;
}

export interface ChangePulseRow {
  entity_id: string;
  parent_id: string;
  entity_type: string;
  version: string;
  mission_change_seq: string;
  is_deleted: boolean;
  origin_node: string;
}

export interface SyncRepository {
  getEntityDeltaSince(parentId: string, sinceSeq: number, limit: number): Promise<EntityDeltaRow[]>;
  getRenderLayer(parentId: string): Promise<EntityRenderRow[]>;
  getSyncStatus(parentId: string): Promise<SyncStatusRow | null>;
  getLocalChangesSince(sinceSeq: number, originNode: string, limit: number): Promise<ChangePulseRow[]>;
}

export interface PostgresSyncRepositoryDeps {
  database: PostgresDatabase;
}

/**
 * Delta sync.
 *
 * Every write assigns the row the next value of the station's change sequence, so "what changed
 * since I last looked" is a single indexed range scan. The client keeps the highest sequence it
 * has processed and asks for everything above it — only the entities that actually moved cross
 * the LAN, instead of the whole mission.
 *
 * `is_hidden` folds the two ways an entity can disappear into one flag the client can act on:
 * its own tombstone, or its parent being masked.
 */
const ENTITY_DELTA = `
  SELECT
    e.entity_id,
    COALESCE(e.mission_id, e.infra_id) AS parent_id,
    e.entity_type,
    e.name,
    e.category,
    CASE WHEN e.is_deleted THEN NULL ELSE ST_AsGeoJSON(e.geom)::jsonb END AS geometry,
    e.properties,
    e.version,
    e.mission_change_seq,
    e.schema_version,
    e.is_deleted,
    (e.is_deleted OR m.deleted_at IS NOT NULL OR i.deleted_at IS NOT NULL) AS is_hidden,
    e.origin_node,
    e.last_update_time
  FROM ${PG_TABLES.ENTITIES} e
  LEFT JOIN ${PG_TABLES.MISSIONS} m ON e.mission_id = m.id
  LEFT JOIN ${PG_TABLES.INFRA} i ON e.infra_id = i.id
  WHERE (e.mission_id = $1 OR e.infra_id = $1)
    AND e.mission_change_seq > $2
  ORDER BY e.mission_change_seq ASC, e.entity_id ASC
  LIMIT $3
`;

const RENDER_LAYER = `
  SELECT
    entity_id,
    parent_id,
    entity_type,
    name,
    category,
    geometry,
    properties,
    version,
    mission_change_seq,
    schema_version,
    origin_node
  FROM ${PG_VIEWS.MAP_RENDER_LAYER}
  WHERE parent_id = $1
  ORDER BY mission_change_seq ASC, entity_id ASC
`;

/**
 * The parent's current high-water mark, derived from its entities rather than kept as a counter
 * on the parent row. A counter would mean every entity write also updated the parent — a row lock
 * that serialises concurrent edits to the same mission, which is exactly what the native sequence
 * was chosen to avoid.
 */
const SYNC_STATUS = `
  SELECT
    parent.id AS parent_id,
    parent.kind AS parent_kind,
    parent.deleted_at IS NOT NULL AS is_deleted,
    (SELECT MAX(e.mission_change_seq)
       FROM ${PG_TABLES.ENTITIES} e
      WHERE e.mission_id = parent.id OR e.infra_id = parent.id) AS last_change_seq,
    (SELECT COUNT(*)
       FROM ${PG_VIEWS.ACTIVE_ENTITIES} a
      WHERE a.mission_id = parent.id OR a.infra_id = parent.id) AS entity_count
  FROM (
    SELECT id, deleted_at, 'mission' AS kind FROM ${PG_TABLES.MISSIONS} WHERE id = $1
    UNION ALL
    SELECT id, deleted_at, 'infra' AS kind FROM ${PG_TABLES.INFRA} WHERE id = $1
  ) parent
  LIMIT 1
`;

/**
 * Refill for the Bridge after it has been down.
 *
 * Restricted to rows this station authored, because that is exactly the set this station is
 * responsible for publishing — a change made on the peer reaches the mesh through the peer's own
 * stream and its mirror. Restricting it this way also keeps the cursor meaningful: every row here
 * came from one monotonically increasing local sequence, so "greater than the last one published"
 * cannot skip anything.
 */
const LOCAL_CHANGES_SINCE = `
  SELECT
    entity_id,
    COALESCE(mission_id, infra_id) AS parent_id,
    entity_type,
    version,
    mission_change_seq,
    is_deleted,
    origin_node
  FROM ${PG_TABLES.ENTITIES}
  WHERE mission_change_seq > $1
    AND origin_node = $2
  ORDER BY mission_change_seq ASC
  LIMIT $3
`;

export const createPostgresSyncRepository = ({ database }: PostgresSyncRepositoryDeps): SyncRepository => ({
  getLocalChangesSince: async (sinceSeq, originNode, limit) => {
    const result = await database.withContext(undefined, (client) =>
      client.query<ChangePulseRow>(LOCAL_CHANGES_SINCE, [sinceSeq, originNode, limit]),
    );
    return result.rows;
  },

  getEntityDeltaSince: async (parentId, sinceSeq, limit) => {
    const result = await database.withContext(undefined, (client) =>
      client.query<EntityDeltaRow>(ENTITY_DELTA, [parentId, sinceSeq, limit]),
    );
    return result.rows;
  },

  getRenderLayer: async (parentId) => {
    const result = await database.withContext(undefined, (client) =>
      client.query<EntityRenderRow>(RENDER_LAYER, [parentId]),
    );
    return result.rows;
  },

  getSyncStatus: async (parentId) => {
    const result = await database.withContext(undefined, (client) =>
      client.query<SyncStatusRow>(SYNC_STATUS, [parentId]),
    );
    return result.rows[0] ?? null;
  },
});
