import { EntityType } from 'constants/entity.constants';
import {
  ENTITY_GEOMETRY_KINDS,
  GEOJSON_TYPES,
  GEOMETRY,
  GEOMETRY_KINDS,
  GeometryKind,
} from 'constants/postgres.constants';
import { GeoCoordinate } from 'models/geo.models';
import { AnyEntity, EntitySchema } from 'models/entity-union.models';

/** GeoJSON position order is [longitude, latitude]. */
type GeoJsonPosition = [number, number];

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

export interface EntityRow {
  entity_id: string;
  mission_id: string | null;
  infra_id: string | null;
  entity_type: string;
  properties: Record<string, unknown>;
  version?: string | number;
  mission_change_seq?: string | number;
  schema_version?: number;
  is_deleted?: boolean;
  origin_node?: string;
}

export interface EntityWriteRow {
  id: string;
  parentId: string;
  entityType: EntityType;
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown>;
}

const COORDINATE_KEYS = {
  LATITUDE: 'latitude',
  LONGITUDE: 'longitude',
} as const;

const ENTITY_KEYS = {
  ID: 'id',
  PARENT_ID: 'parentId',
  ENTITY_TYPE: 'entityType',
  POSITION: 'position',
  COORDINATES: 'coordinates',
} as const;

/**
 * Server-side quantization to 7 decimals (~1.1cm). Applied to the stored payload as well as the
 * geometry column so the two never disagree, and so the saving carries through to REST responses
 * and pglogical traffic rather than only the map layer.
 */
const quantize = (value: number): number => Number(value.toFixed(GEOMETRY.DECIMALS));

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

const quantizeDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(quantizeDeep);
  if (!isPlainRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => {
      const isCoordinate =
        (key === COORDINATE_KEYS.LATITUDE || key === COORDINATE_KEYS.LONGITUDE) && typeof nested === 'number';
      return [key, isCoordinate ? quantize(nested) : quantizeDeep(nested)];
    }),
  );
};

const isGeoCoordinate = (value: unknown): value is GeoCoordinate =>
  isPlainRecord(value) &&
  typeof value[COORDINATE_KEYS.LATITUDE] === 'number' &&
  typeof value[COORDINATE_KEYS.LONGITUDE] === 'number';

const toPosition = (coordinate: GeoCoordinate): GeoJsonPosition => [
  quantize(coordinate.longitude),
  quantize(coordinate.latitude),
];

const readCoordinateList = (entity: AnyEntity): GeoCoordinate[] => {
  const raw = (entity as Record<string, unknown>)[ENTITY_KEYS.COORDINATES];
  return Array.isArray(raw) ? raw.filter(isGeoCoordinate) : [];
};

const readPosition = (entity: AnyEntity): GeoCoordinate | null => {
  const raw = (entity as Record<string, unknown>)[ENTITY_KEYS.POSITION];
  return isGeoCoordinate(raw) ? raw : null;
};

/** A polygon ring must be explicitly closed — GeoJSON requires the first point repeated last. */
const closeRing = (positions: GeoJsonPosition[]): GeoJsonPosition[] => {
  const [first] = positions;
  const last = positions[positions.length - 1];
  if (!first || !last) return positions;
  const isClosed = first[0] === last[0] && first[1] === last[1];
  return isClosed ? positions : [...positions, first];
};

const buildPointGeometry = (entity: AnyEntity): GeoJsonGeometry | null => {
  const position = readPosition(entity);
  return position ? { type: GEOJSON_TYPES.POINT, coordinates: toPosition(position) } : null;
};

const buildPolygonGeometry = (entity: AnyEntity): GeoJsonGeometry | null => {
  const positions = readCoordinateList(entity).map(toPosition);
  if (positions.length < GEOMETRY.POLYGON_MIN_POINTS) return null;
  return { type: GEOJSON_TYPES.POLYGON, coordinates: [closeRing(positions)] };
};

const buildLineStringGeometry = (entity: AnyEntity): GeoJsonGeometry | null => {
  const positions = readCoordinateList(entity).map(toPosition);
  if (positions.length < GEOMETRY.LINESTRING_MIN_POINTS) return null;
  return { type: GEOJSON_TYPES.LINE_STRING, coordinates: positions };
};

const GEOMETRY_BUILDERS: Record<GeometryKind, (entity: AnyEntity) => GeoJsonGeometry | null> = {
  [GEOMETRY_KINDS.POINT]: buildPointGeometry,
  [GEOMETRY_KINDS.POLYGON]: buildPolygonGeometry,
  [GEOMETRY_KINDS.LINESTRING]: buildLineStringGeometry,
  [GEOMETRY_KINDS.NONE]: () => null,
};

/**
 * Projects an entity into the PostGIS `geom` column.
 *
 * Geometry is derived, not authoritative — the typed payload in `properties` remains the source
 * of truth for the REST API. `geom` exists so the GIST index, spatial queries and the WebGL
 * render layer have something to work with. Shapes with too few points to form a valid geometry
 * (a polygon mid-draw) project to NULL rather than being rejected.
 */
export const toEntityGeometry = (entity: AnyEntity): GeoJsonGeometry | null =>
  GEOMETRY_BUILDERS[ENTITY_GEOMETRY_KINDS[entity.entityType]](entity);

/** Everything except the fields promoted to their own columns. */
export const toEntityProperties = (entity: AnyEntity): Record<string, unknown> => {
  const { id: _id, parentId: _parentId, entityType: _entityType, ...rest } = entity;
  return quantizeDeep(rest) as Record<string, unknown>;
};

export const toEntityWriteRow = (entity: AnyEntity): EntityWriteRow => ({
  id: entity.id,
  parentId: entity.parentId,
  entityType: entity.entityType,
  geometry: toEntityGeometry(entity),
  properties: toEntityProperties(entity),
});

export const toEntityCandidate = (row: EntityRow): Record<string, unknown> => ({
  ...row.properties,
  [ENTITY_KEYS.ID]: row.entity_id,
  [ENTITY_KEYS.PARENT_ID]: row.mission_id ?? row.infra_id,
  [ENTITY_KEYS.ENTITY_TYPE]: row.entity_type,
});

export interface EntityRowParseResult {
  entity: AnyEntity | null;
  issues?: unknown;
}

/**
 * Rows whose payload no longer satisfies the current schema are reported, not thrown on. A
 * mission written by an older build must still load: the unreadable entity is skipped by the
 * caller and kept in the database for later migration instead of failing the whole read.
 */
export const parseEntityRow = (row: EntityRow): EntityRowParseResult => {
  const result = EntitySchema.safeParse(toEntityCandidate(row));
  return result.success ? { entity: result.data } : { entity: null, issues: result.error.issues };
};
