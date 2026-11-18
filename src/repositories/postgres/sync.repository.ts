import { PG_TABLES, PG_VIEWS } from 'constants/postgres.constants';
import { VectorClock } from 'constants/sync.constants';
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
  clock: Record<string, string | number> | null;
  entity_count: string;
}

export interface ChangeCounterRow {
  parent_id: string;
  last_seq: string;
}

export interface SyncRepository {
  getEntityDeltaSince(parentId: string, clock: VectorClock, limit: number): Promise<EntityDeltaRow[]>;
  getRenderLayer(parentId: string): Promise<EntityRenderRow[]>;
  getSyncStatus(parentId: string): Promise<SyncStatusRow | null>;
  getLocalCounters(): Promise<ChangeCounterRow[]>;
}

export interface PostgresSyncRepositoryDeps {
  database: PostgresDatabase;
}

/**
 * Delta sync.
 *
 * Every write takes the next number from its station's counter for the parent, so "what changed
 * since I last looked" is one indexed range scan per station. The client keeps the highest number
 * it has seen from each station and asks for everything above it — only the entities that actually
 * moved cross the LAN, instead of the whole mission. Rows come ordered by station, then number, so
 * a page cut leaves a prefix of every station's changes.
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
    AND e.mission_change_seq > COALESCE(($2::jsonb ->> e.origin_node)::bigint, 0)
  ORDER BY e.origin_node, e.mission_change_seq
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
 * The parent's clock: the highest number per origin station among its entities. Derived from the
 * rows rather than read from change_counters, which is local and only counts this station's writes.
 */
const SYNC_STATUS = `
  SELECT
    parent.id AS parent_id,
    parent.kind AS parent_kind,
    parent.deleted_at IS NOT NULL AS is_deleted,
    (SELECT jsonb_object_agg(s.origin_node, s.max_seq)
       FROM (SELECT e.origin_node, MAX(e.mission_change_seq) AS max_seq
               FROM ${PG_TABLES.ENTITIES} e
              WHERE e.mission_id = parent.id OR e.infra_id = parent.id
              GROUP BY e.origin_node) s) AS clock,
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
 * Refill for the Bridge after an outage. The counters hold exactly this station's own writes per
 * parent — the set this station is responsible for publishing; a change made on a peer reaches the
 * mesh through that peer's own stream and its mirrors.
 */
const LOCAL_COUNTERS = `SELECT parent_id, last_seq FROM ${PG_TABLES.CHANGE_COUNTERS}`;

export const createPostgresSyncRepository = ({ database }: PostgresSyncRepositoryDeps): SyncRepository => ({
  getLocalCounters: async () => {
    const result = await database.withContext(undefined, (client) =>
      client.query<ChangeCounterRow>(LOCAL_COUNTERS),
    );
    return result.rows;
  },

  getEntityDeltaSince: async (parentId, clock, limit) => {
    const result = await database.withContext(undefined, (client) =>
      client.query<EntityDeltaRow>(ENTITY_DELTA, [parentId, JSON.stringify(clock), limit]),
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
