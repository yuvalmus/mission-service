import { ENTITY_TYPES, EntityType } from 'constants/entity.constants';

export const PG_TABLES = {
  MISSIONS: 'missions',
  INFRA: 'infra',
  ENTITIES: 'entities',
  ROUTE_BACKUPS: 'route_backups',
} as const;

export const PG_VIEWS = {
  ACTIVE_ENTITIES: 'v_active_entities',
  MAP_RENDER_LAYER: 'v_map_render_layer',
} as const;

export const PG_SEQUENCES = {
  ENTITY_CHANGE: 'entity_change_seq',
} as const;

/** pg_notify channels the Bridge sidecar subscribes to. */
export const PG_CHANNELS = {
  ENTITY_CHANGES: 'entity_changes',
  MISSION_CHANGES: 'mission_changes',
} as const;

export type PgChannel = (typeof PG_CHANNELS)[keyof typeof PG_CHANNELS];

export const PG_FUNCTIONS = {
  GEOM_FROM_GEOJSON: 'app_geom_from_geojson',
  ASSIGN_ENTITY_CHANGE_METADATA: 'assign_entity_change_metadata',
  BACKUP_ENTITY_VERSION: 'backup_entity_version',
  STAMP_ORIGIN_NODE: 'stamp_origin_node',
  NOTIFY_ENTITY_CHANGE: 'notify_entity_change',
  NOTIFY_MISSION_CHANGE: 'notify_mission_change',
} as const;

export const PG_TRIGGERS = {
  ENTITY_CHANGE_METADATA: 'trg_entities_assign_change_metadata',
  ENTITY_BACKUP: 'trg_entities_lww_backup',
  ENTITY_NOTIFY: 'trg_entities_notify',
  MISSION_NOTIFY: 'trg_missions_notify',
  MISSION_ORIGIN: 'trg_missions_stamp_origin',
  INFRA_ORIGIN: 'trg_infra_stamp_origin',
} as const;

export const PG_EXTENSIONS = {
  PGCRYPTO: 'pgcrypto',
  POSTGIS: 'postgis',
  PGLOGICAL: 'pglogical',
} as const;

export const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
  UNDEFINED_TABLE: '42P01',
  UNDEFINED_FUNCTION: '42883',
  DUPLICATE_OBJECT: '42710',
} as const;

/**
 * EPSG:4326 (WGS84 lon/lat) everywhere — the UI renders with OpenLayers WebGL in 4326,
 * so the database never projects to Web Mercator.
 */
export const GEOMETRY = {
  SRID: 4326,
  /**
   * ST_SnapToGrid cell size — 7 decimals ~= 1.1cm. Trims ~30% of sync/render payload.
   * Kept as a string so it renders as `0.0000001` rather than JavaScript's `1e-7`.
   */
  GRID_SIZE: '0.0000001',
  /** Decimal places the application rounds to, so `properties` matches `geom`. */
  DECIMALS: 7,
  POLYGON_MIN_POINTS: 3,
  LINESTRING_MIN_POINTS: 2,
} as const;

export const GEOMETRY_KINDS = {
  POINT: 'point',
  POLYGON: 'polygon',
  LINESTRING: 'linestring',
  NONE: 'none',
} as const;

export type GeometryKind = (typeof GEOMETRY_KINDS)[keyof typeof GEOMETRY_KINDS];

export const GEOJSON_TYPES = {
  POINT: 'Point',
  POLYGON: 'Polygon',
  LINE_STRING: 'LineString',
} as const;

/**
 * Which PostGIS geometry each entity type projects into.
 *
 * The architecture doc fixes this for `point | circle | polygon | linestring`; this service has
 * thirteen entity types, so the same rule is expressed over all of them. This single map drives
 * both the application-side projection and the `enforce_spatial_integrity` CHECK constraint, so
 * the two can never drift.
 *
 * A `route` carries no geometry of its own — it is defined by the waypoints it references.
 */
export const ENTITY_GEOMETRY_KINDS: Record<EntityType, GeometryKind> = {
  [ENTITY_TYPES.CIRCLE]: GEOMETRY_KINDS.POINT,
  [ENTITY_TYPES.SECTOR]: GEOMETRY_KINDS.POINT,
  [ENTITY_TYPES.NAVIGATION_WAY_POINT]: GEOMETRY_KINDS.POINT,
  [ENTITY_TYPES.SYMBOL_POINT]: GEOMETRY_KINDS.POINT,
  [ENTITY_TYPES.LANDING_ZONE]: GEOMETRY_KINDS.POINT,
  [ENTITY_TYPES.ELIAHU]: GEOMETRY_KINDS.POINT,
  [ENTITY_TYPES.LAMINE]: GEOMETRY_KINDS.POINT,
  [ENTITY_TYPES.MESSI]: GEOMETRY_KINDS.POINT,
  [ENTITY_TYPES.ISLAND]: GEOMETRY_KINDS.POINT,
  [ENTITY_TYPES.POLYGON]: GEOMETRY_KINDS.POLYGON,
  [ENTITY_TYPES.CORRIDOR]: GEOMETRY_KINDS.LINESTRING,
  [ENTITY_TYPES.POLYLINE]: GEOMETRY_KINDS.LINESTRING,
  [ENTITY_TYPES.ROUTE]: GEOMETRY_KINDS.NONE,
} as const;

/** PostGIS `ST_GeometryType` values accepted for each kind. */
export const POSTGIS_TYPES_BY_KIND: Record<GeometryKind, readonly string[]> = {
  [GEOMETRY_KINDS.POINT]: ['ST_Point'],
  [GEOMETRY_KINDS.POLYGON]: ['ST_Polygon', 'ST_MultiPolygon'],
  [GEOMETRY_KINDS.LINESTRING]: ['ST_LineString', 'ST_MultiLineString'],
  [GEOMETRY_KINDS.NONE]: [],
} as const;

/** Entity fields promoted out of `properties` into real columns. */
export const ENTITY_COLUMNS = {
  ID: 'entity_id',
  MISSION_ID: 'mission_id',
  INFRA_ID: 'infra_id',
  PARENT_ENTITY_ID: 'parent_entity_id',
  ENTITY_TYPE: 'entity_type',
  NAME: 'name',
  CATEGORY: 'category',
  GEOM: 'geom',
  PROPERTIES: 'properties',
  VERSION: 'version',
  MISSION_CHANGE_SEQ: 'mission_change_seq',
  SCHEMA_VERSION: 'schema_version',
  IS_DELETED: 'is_deleted',
  CREATED_AT: 'created_at',
  LAST_UPDATE_TIME: 'last_update_time',
  ORIGIN_NODE: 'origin_node',
} as const;

/**
 * Current shape of the JSON written into `entities.properties`. Stamped on every row so a
 * mission saved by an older build can be recognised and migrated on load.
 */
export const ENTITY_SCHEMA_VERSION = 1;

/** Keys that live in dedicated columns and are stripped from the `properties` payload. */
export const ENTITY_COLUMN_KEYS = ['id', 'parentId', 'entityType'] as const;

export const MESH_DEFAULTS = {
  NODE_NAME: 'node-a',
  PEER_NODE_NAME: 'node-b',
  NODE_INDEX: 1,
  NODE_COUNT: 2,
} as const;
