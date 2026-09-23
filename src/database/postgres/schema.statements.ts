import { Env } from 'config/env.config';
import { ENTITY_TYPES, EntityType } from 'constants/entity.constants';
import {
  ENTITY_COLUMNS,
  ENTITY_GEOMETRY_KINDS,
  ENTITY_SCHEMA_VERSION,
  GEOMETRY,
  GEOMETRY_KINDS,
  GeometryKind,
  PG_CHANNELS,
  PG_EXTENSIONS,
  PG_FUNCTIONS,
  PG_SEQUENCES,
  PG_TABLES,
  PG_TRIGGERS,
  PG_VIEWS,
  POSTGIS_TYPES_BY_KIND,
} from 'constants/postgres.constants';

const quoteLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const entityTypesOfKind = (kind: GeometryKind): EntityType[] =>
  (Object.keys(ENTITY_GEOMETRY_KINDS) as EntityType[]).filter((type) => ENTITY_GEOMETRY_KINDS[type] === kind);

/**
 * Semantic enforcement as a line of defence for the mesh: a bug on one station that writes a
 * polygon carrying point geometry would otherwise replicate that poison row to every peer. The
 * clause is generated from `ENTITY_GEOMETRY_KINDS`, so adding an entity type updates it here too.
 *
 * Geometry may be NULL — a `route` has none of its own, and a half-drawn polygon has too few
 * points to form a ring. When geometry is present its type must match the entity type.
 */
const buildSpatialIntegrityCheck = (): string => {
  const clauses = Object.values(GEOMETRY_KINDS)
    .filter((kind) => kind !== GEOMETRY_KINDS.NONE)
    .map((kind) => {
      const types = entityTypesOfKind(kind).map(quoteLiteral).join(', ');
      const postgisTypes = POSTGIS_TYPES_BY_KIND[kind].map(quoteLiteral).join(', ');
      return `(${ENTITY_COLUMNS.ENTITY_TYPE} IN (${types}) AND ST_GeometryType(${ENTITY_COLUMNS.GEOM}) IN (${postgisTypes}))`;
    })
    .join('\n            OR ');

  return `${ENTITY_COLUMNS.GEOM} IS NULL OR (\n            ${clauses}\n          )`;
};

export const buildSchemaStatements = (env: Env): string[] => {
  const nodeName = quoteLiteral(env.NODE_NAME);

  return [
    `CREATE EXTENSION IF NOT EXISTS ${PG_EXTENSIONS.PGCRYPTO};`,
    `CREATE EXTENSION IF NOT EXISTS ${PG_EXTENSIONS.POSTGIS};`,

    // --- Change sequence -------------------------------------------------------------------
    // Native global sequence rather than a per-mission counter: nextval() takes no row lock, so
    // concurrent writes to one mission cannot deadlock. Gaps within a mission are expected and
    // harmless — delta sync only ever asks for "greater than what I last saw".
    // INCREMENT BY node-count interleaves the stations (A: 1,3,5... B: 2,4,6...) so two peers
    // writing while disconnected can never hand the same sequence to different entities.
    `CREATE SEQUENCE IF NOT EXISTS ${PG_SEQUENCES.ENTITY_CHANGE}
       START WITH ${env.MESH_NODE_INDEX}
       INCREMENT BY ${env.MESH_NODE_COUNT}
       MINVALUE ${env.MESH_NODE_INDEX};`,
    `ALTER SEQUENCE ${PG_SEQUENCES.ENTITY_CHANGE} INCREMENT BY ${env.MESH_NODE_COUNT};`,

    // --- Tables ----------------------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS ${PG_TABLES.MISSIONS} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        version_number INTEGER NOT NULL DEFAULT 1,
        comment TEXT,
        created_by TEXT,
        mission_type TEXT,
        password TEXT,
        attached_mission_id INTEGER,
        sonic_properties JSONB,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_update_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        origin_node TEXT NOT NULL DEFAULT ${nodeName}
     );`,

    // The architecture's `infra` table. In this service the non-mission parent of an entity is a
    // stake, keyed by its patrick/squadron — the same role `infra` plays in the reference model.
    `CREATE TABLE IF NOT EXISTS ${PG_TABLES.INFRA} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        squadron TEXT NOT NULL,
        version_number INTEGER NOT NULL DEFAULT 1,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_update_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        origin_node TEXT NOT NULL DEFAULT ${nodeName}
     );`,

    `CREATE TABLE IF NOT EXISTS ${PG_TABLES.ENTITIES} (
        ${ENTITY_COLUMNS.ID} UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ${ENTITY_COLUMNS.MISSION_ID} UUID REFERENCES ${PG_TABLES.MISSIONS}(id) ON DELETE CASCADE,
        ${ENTITY_COLUMNS.INFRA_ID} UUID REFERENCES ${PG_TABLES.INFRA}(id) ON DELETE CASCADE,
        ${ENTITY_COLUMNS.PARENT_ENTITY_ID} UUID REFERENCES ${PG_TABLES.ENTITIES}(${ENTITY_COLUMNS.ID}) ON DELETE SET NULL,
        ${ENTITY_COLUMNS.ENTITY_TYPE} TEXT NOT NULL,
        ${ENTITY_COLUMNS.NAME} TEXT,
        ${ENTITY_COLUMNS.CATEGORY} TEXT,
        ${ENTITY_COLUMNS.GEOM} GEOMETRY(Geometry, ${GEOMETRY.SRID}),
        ${ENTITY_COLUMNS.PROPERTIES} JSONB NOT NULL DEFAULT '{}'::jsonb,
        ${ENTITY_COLUMNS.VERSION} BIGINT NOT NULL DEFAULT 1,
        ${ENTITY_COLUMNS.MISSION_CHANGE_SEQ} BIGINT NOT NULL DEFAULT 0,
        ${ENTITY_COLUMNS.SCHEMA_VERSION} INTEGER NOT NULL DEFAULT ${ENTITY_SCHEMA_VERSION},
        ${ENTITY_COLUMNS.IS_DELETED} BOOLEAN NOT NULL DEFAULT false,
        ${ENTITY_COLUMNS.CREATED_AT} TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ${ENTITY_COLUMNS.LAST_UPDATE_TIME} TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ${ENTITY_COLUMNS.ORIGIN_NODE} TEXT NOT NULL DEFAULT ${nodeName},
        CONSTRAINT belongs_to_one CHECK (
          (${ENTITY_COLUMNS.MISSION_ID} IS NOT NULL AND ${ENTITY_COLUMNS.INFRA_ID} IS NULL) OR
          (${ENTITY_COLUMNS.MISSION_ID} IS NULL AND ${ENTITY_COLUMNS.INFRA_ID} IS NOT NULL)
        ),
        CONSTRAINT enforce_spatial_integrity CHECK (
          ${buildSpatialIntegrityCheck()}
        )
     );`,

    // Ten versions back per entity, written by the BEFORE UPDATE trigger. Pruning is deliberately
    // NOT done here — it runs in the background collector so it cannot lengthen a write.
    `CREATE TABLE IF NOT EXISTS ${PG_TABLES.ROUTE_BACKUPS} (
        backup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        route_id UUID NOT NULL,
        ${ENTITY_COLUMNS.VERSION} BIGINT NOT NULL,
        ${ENTITY_COLUMNS.ENTITY_TYPE} TEXT NOT NULL,
        ${ENTITY_COLUMNS.MISSION_ID} UUID,
        ${ENTITY_COLUMNS.INFRA_ID} UUID,
        ${ENTITY_COLUMNS.GEOM} GEOMETRY(Geometry, ${GEOMETRY.SRID}),
        ${ENTITY_COLUMNS.PROPERTIES} JSONB,
        ${ENTITY_COLUMNS.IS_DELETED} BOOLEAN NOT NULL DEFAULT false,
        updated_by_node TEXT,
        ${ENTITY_COLUMNS.CREATED_AT} TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );`,

    // --- Indexes ---------------------------------------------------------------------------
    `CREATE INDEX IF NOT EXISTS idx_spatial_entities ON ${PG_TABLES.ENTITIES} USING GIST (${ENTITY_COLUMNS.GEOM});`,
    `CREATE INDEX IF NOT EXISTS idx_entities_mission_seq ON ${PG_TABLES.ENTITIES} (${ENTITY_COLUMNS.MISSION_ID}, ${ENTITY_COLUMNS.MISSION_CHANGE_SEQ});`,
    `CREATE INDEX IF NOT EXISTS idx_entities_infra_seq ON ${PG_TABLES.ENTITIES} (${ENTITY_COLUMNS.INFRA_ID}, ${ENTITY_COLUMNS.MISSION_CHANGE_SEQ});`,
    `CREATE INDEX IF NOT EXISTS idx_entities_mission_name ON ${PG_TABLES.ENTITIES} (${ENTITY_COLUMNS.MISSION_ID}, ${ENTITY_COLUMNS.NAME});`,
    `CREATE INDEX IF NOT EXISTS idx_entities_infra_name ON ${PG_TABLES.ENTITIES} (${ENTITY_COLUMNS.INFRA_ID}, ${ENTITY_COLUMNS.NAME});`,
    `CREATE INDEX IF NOT EXISTS idx_entities_type ON ${PG_TABLES.ENTITIES} (${ENTITY_COLUMNS.ENTITY_TYPE});`,
    `CREATE INDEX IF NOT EXISTS idx_entities_tombstones ON ${PG_TABLES.ENTITIES} (${ENTITY_COLUMNS.LAST_UPDATE_TIME}) WHERE ${ENTITY_COLUMNS.IS_DELETED};`,
    `CREATE INDEX IF NOT EXISTS idx_route_backups_route_ver ON ${PG_TABLES.ROUTE_BACKUPS} (route_id, ${ENTITY_COLUMNS.VERSION} DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_missions_name ON ${PG_TABLES.MISSIONS} (name);`,
    `CREATE INDEX IF NOT EXISTS idx_infra_squadron ON ${PG_TABLES.INFRA} (squadron);`,

    // --- Geometry helper ---------------------------------------------------------------------
    // Quantises to 7 decimals (~1.1cm) on the way in, trimming roughly 30% off replication and
    // render payloads. The application rounds to the same precision so `properties` and `geom`
    // never disagree.
    `CREATE OR REPLACE FUNCTION ${PG_FUNCTIONS.GEOM_FROM_GEOJSON}(payload JSONB)
     RETURNS GEOMETRY AS $$
       SELECT CASE
         WHEN payload IS NULL THEN NULL
         ELSE ST_SnapToGrid(ST_SetSRID(ST_GeomFromGeoJSON(payload), ${GEOMETRY.SRID}), ${GEOMETRY.GRID_SIZE})
       END;
     $$ LANGUAGE sql IMMUTABLE;`,

    // --- Version + sequence assignment -------------------------------------------------------
    // Origin-only (plain ENABLE): a row arriving through pglogical keeps the version and sequence
    // its author gave it, so both stations agree on the identity of a change.
    `CREATE OR REPLACE FUNCTION ${PG_FUNCTIONS.ASSIGN_ENTITY_CHANGE_METADATA}() RETURNS trigger AS $$
     BEGIN
       IF TG_OP = 'UPDATE' THEN
         NEW.${ENTITY_COLUMNS.VERSION} := COALESCE(OLD.${ENTITY_COLUMNS.VERSION}, 0) + 1;
       ELSE
         NEW.${ENTITY_COLUMNS.VERSION} := COALESCE(NEW.${ENTITY_COLUMNS.VERSION}, 1);
       END IF;

       NEW.${ENTITY_COLUMNS.MISSION_CHANGE_SEQ} := nextval('${PG_SEQUENCES.ENTITY_CHANGE}');
       NEW.${ENTITY_COLUMNS.LAST_UPDATE_TIME} := NOW();

       -- Derived from the payload so the indexed columns cannot drift from properties.
       NEW.${ENTITY_COLUMNS.NAME} := NEW.${ENTITY_COLUMNS.PROPERTIES}->>'name';
       NEW.${ENTITY_COLUMNS.CATEGORY} := NEW.${ENTITY_COLUMNS.PROPERTIES}->>'category';

       -- origin_node means "the station that last wrote this row", stamped here rather than by
       -- the application so no write path can forget it — a tombstone included. Replication
       -- filters on it, so a stale value would silently stop a change from reaching the peer.
       NEW.${ENTITY_COLUMNS.ORIGIN_NODE} := ${nodeName};

       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;`,

    `DROP TRIGGER IF EXISTS ${PG_TRIGGERS.ENTITY_CHANGE_METADATA} ON ${PG_TABLES.ENTITIES};`,
    `CREATE TRIGGER ${PG_TRIGGERS.ENTITY_CHANGE_METADATA}
       BEFORE INSERT OR UPDATE ON ${PG_TABLES.ENTITIES}
       FOR EACH ROW EXECUTE FUNCTION ${PG_FUNCTIONS.ASSIGN_ENTITY_CHANGE_METADATA}();`,

    // Missions and infra carry the same last-writer stamp. Origin-only, like the entity metadata
    // trigger: a row applied from the peer keeps the peer as its author.
    `CREATE OR REPLACE FUNCTION ${PG_FUNCTIONS.STAMP_ORIGIN_NODE}() RETURNS trigger AS $$
     BEGIN
       NEW.origin_node := ${nodeName};
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;`,

    `DROP TRIGGER IF EXISTS ${PG_TRIGGERS.MISSION_ORIGIN} ON ${PG_TABLES.MISSIONS};`,
    `CREATE TRIGGER ${PG_TRIGGERS.MISSION_ORIGIN}
       BEFORE INSERT OR UPDATE ON ${PG_TABLES.MISSIONS}
       FOR EACH ROW EXECUTE FUNCTION ${PG_FUNCTIONS.STAMP_ORIGIN_NODE}();`,

    `DROP TRIGGER IF EXISTS ${PG_TRIGGERS.INFRA_ORIGIN} ON ${PG_TABLES.INFRA};`,
    `CREATE TRIGGER ${PG_TRIGGERS.INFRA_ORIGIN}
       BEFORE INSERT OR UPDATE ON ${PG_TABLES.INFRA}
       FOR EACH ROW EXECUTE FUNCTION ${PG_FUNCTIONS.STAMP_ORIGIN_NODE}();`,

    // --- History backup ----------------------------------------------------------------------
    // Last-Write-Wins means an incoming replicated row overwrites the local one. The row that was
    // about to be overwritten is copied here first, so LWW never destroys information — including
    // when the overwrite arrives from the peer after a disconnection.
    `CREATE OR REPLACE FUNCTION ${PG_FUNCTIONS.BACKUP_ENTITY_VERSION}() RETURNS trigger AS $$
     BEGIN
       INSERT INTO ${PG_TABLES.ROUTE_BACKUPS} (
         route_id, ${ENTITY_COLUMNS.VERSION}, ${ENTITY_COLUMNS.ENTITY_TYPE},
         ${ENTITY_COLUMNS.MISSION_ID}, ${ENTITY_COLUMNS.INFRA_ID},
         ${ENTITY_COLUMNS.GEOM}, ${ENTITY_COLUMNS.PROPERTIES},
         ${ENTITY_COLUMNS.IS_DELETED}, updated_by_node, ${ENTITY_COLUMNS.CREATED_AT}
       ) VALUES (
         OLD.${ENTITY_COLUMNS.ID}, OLD.${ENTITY_COLUMNS.VERSION}, OLD.${ENTITY_COLUMNS.ENTITY_TYPE},
         OLD.${ENTITY_COLUMNS.MISSION_ID}, OLD.${ENTITY_COLUMNS.INFRA_ID},
         OLD.${ENTITY_COLUMNS.GEOM}, OLD.${ENTITY_COLUMNS.PROPERTIES},
         OLD.${ENTITY_COLUMNS.IS_DELETED}, OLD.${ENTITY_COLUMNS.ORIGIN_NODE}, OLD.${ENTITY_COLUMNS.LAST_UPDATE_TIME}
       );
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;`,

    `DROP TRIGGER IF EXISTS ${PG_TRIGGERS.ENTITY_BACKUP} ON ${PG_TABLES.ENTITIES};`,
    `CREATE TRIGGER ${PG_TRIGGERS.ENTITY_BACKUP}
       BEFORE UPDATE ON ${PG_TABLES.ENTITIES}
       FOR EACH ROW EXECUTE FUNCTION ${PG_FUNCTIONS.BACKUP_ENTITY_VERSION}();`,

    // --- Change notification -----------------------------------------------------------------
    // Identifiers and versions only. pg_notify caps a payload at 8KB, so geometry and properties
    // stay out; a listener that wants the body asks for the delta.
    `CREATE OR REPLACE FUNCTION ${PG_FUNCTIONS.NOTIFY_ENTITY_CHANGE}() RETURNS trigger AS $$
     DECLARE
       row_data RECORD;
     BEGIN
       row_data := COALESCE(NEW, OLD);
       PERFORM pg_notify('${PG_CHANNELS.ENTITY_CHANGES}', json_build_object(
         'type', 'changed',
         'mission_id', row_data.${ENTITY_COLUMNS.MISSION_ID},
         'infra_id', row_data.${ENTITY_COLUMNS.INFRA_ID},
         'parent_id', COALESCE(row_data.${ENTITY_COLUMNS.MISSION_ID}, row_data.${ENTITY_COLUMNS.INFRA_ID}),
         'entity_id', row_data.${ENTITY_COLUMNS.ID},
         'entity_type', row_data.${ENTITY_COLUMNS.ENTITY_TYPE},
         'version', row_data.${ENTITY_COLUMNS.VERSION},
         'last_change_seq', row_data.${ENTITY_COLUMNS.MISSION_CHANGE_SEQ},
         'is_deleted', row_data.${ENTITY_COLUMNS.IS_DELETED},
         'origin_node', row_data.${ENTITY_COLUMNS.ORIGIN_NODE}
       )::text);
       RETURN row_data;
     END;
     $$ LANGUAGE plpgsql;`,

    `DROP TRIGGER IF EXISTS ${PG_TRIGGERS.ENTITY_NOTIFY} ON ${PG_TABLES.ENTITIES};`,
    `CREATE TRIGGER ${PG_TRIGGERS.ENTITY_NOTIFY}
       AFTER INSERT OR UPDATE ON ${PG_TABLES.ENTITIES}
       FOR EACH ROW EXECUTE FUNCTION ${PG_FUNCTIONS.NOTIFY_ENTITY_CHANGE}();`,

    `CREATE OR REPLACE FUNCTION ${PG_FUNCTIONS.NOTIFY_MISSION_CHANGE}() RETURNS trigger AS $mission$
     DECLARE
       row_data RECORD;
     BEGIN
       IF TG_OP = 'UPDATE'
          AND NEW.name IS NOT DISTINCT FROM OLD.name
          AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
         RETURN NEW;
       END IF;

       row_data := COALESCE(NEW, OLD);
       PERFORM pg_notify('${PG_CHANNELS.MISSION_CHANGES}', json_build_object(
         'id', row_data.id,
         'name', row_data.name,
         'version_number', row_data.version_number,
         'created_at', row_data.date_created,
         'deleted_at', row_data.deleted_at,
         'origin_node', row_data.origin_node,
         'operation', CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END
       )::text);
       RETURN row_data;
     END;
     $mission$ LANGUAGE plpgsql;`,

    `DROP TRIGGER IF EXISTS ${PG_TRIGGERS.MISSION_NOTIFY} ON ${PG_TABLES.MISSIONS};`,
    `CREATE TRIGGER ${PG_TRIGGERS.MISSION_NOTIFY}
       AFTER INSERT OR UPDATE ON ${PG_TABLES.MISSIONS}
       FOR EACH ROW EXECUTE FUNCTION ${PG_FUNCTIONS.NOTIFY_MISSION_CHANGE}();`,

    // ENABLE ALWAYS makes a trigger fire for rows applied by pglogical too, not just local writes.
    //
    //  - notify: a change made on the peer must still reach this station's UI.
    //  - backup: this is what makes Last-Write-Wins non-destructive. When a peer returning from a
    //    disconnection overwrites a row that was edited locally, the trigger runs on the receiving
    //    station and files the losing local row into the history before it is replaced.
    //
    // The metadata trigger stays origin-only by design: a replicated row must keep the version and
    // sequence its author assigned, or the two stations would disagree about what a change is.
    `ALTER TABLE ${PG_TABLES.ENTITIES} ENABLE ALWAYS TRIGGER ${PG_TRIGGERS.ENTITY_NOTIFY};`,
    `ALTER TABLE ${PG_TABLES.ENTITIES} ENABLE ALWAYS TRIGGER ${PG_TRIGGERS.ENTITY_BACKUP};`,
    `ALTER TABLE ${PG_TABLES.MISSIONS} ENABLE ALWAYS TRIGGER ${PG_TRIGGERS.MISSION_NOTIFY};`,

    // --- Views -------------------------------------------------------------------------------
    `DROP VIEW IF EXISTS ${PG_VIEWS.MAP_RENDER_LAYER};`,
    `DROP VIEW IF EXISTS ${PG_VIEWS.ACTIVE_ENTITIES};`,

    // Top-down view masking: deleting a mission flips one `deleted_at` and every entity beneath it
    // disappears from reads. Thousands of rows go dark in a single replicated write instead of a
    // tombstone storm across the LAN.
    `CREATE VIEW ${PG_VIEWS.ACTIVE_ENTITIES} AS
       SELECT e.*
       FROM ${PG_TABLES.ENTITIES} e
       LEFT JOIN ${PG_TABLES.MISSIONS} m ON e.${ENTITY_COLUMNS.MISSION_ID} = m.id
       LEFT JOIN ${PG_TABLES.INFRA} i ON e.${ENTITY_COLUMNS.INFRA_ID} = i.id
       WHERE (e.${ENTITY_COLUMNS.MISSION_ID} IS NULL OR m.deleted_at IS NULL)
         AND (e.${ENTITY_COLUMNS.INFRA_ID} IS NULL OR i.deleted_at IS NULL)
         AND e.${ENTITY_COLUMNS.IS_DELETED} = false;`,

    // Shader-ready payload for the WebGL layer: geometry already serialised to GeoJSON and render
    // defaults injected at read time, so the browser parses instead of computing.
    `CREATE VIEW ${PG_VIEWS.MAP_RENDER_LAYER} AS
       SELECT
         ${ENTITY_COLUMNS.ID},
         ${ENTITY_COLUMNS.MISSION_ID},
         ${ENTITY_COLUMNS.INFRA_ID},
         COALESCE(${ENTITY_COLUMNS.MISSION_ID}, ${ENTITY_COLUMNS.INFRA_ID}) AS parent_id,
         ${ENTITY_COLUMNS.ENTITY_TYPE},
         ${ENTITY_COLUMNS.NAME},
         ${ENTITY_COLUMNS.CATEGORY},
         ST_AsGeoJSON(${ENTITY_COLUMNS.GEOM})::jsonb AS geometry,
         jsonb_set(
           ${ENTITY_COLUMNS.PROPERTIES},
           '{opacity}',
           COALESCE(${ENTITY_COLUMNS.PROPERTIES}->'opacity', '1.0'::jsonb)
         ) AS ${ENTITY_COLUMNS.PROPERTIES},
         ${ENTITY_COLUMNS.VERSION},
         ${ENTITY_COLUMNS.MISSION_CHANGE_SEQ},
         ${ENTITY_COLUMNS.SCHEMA_VERSION},
         ${ENTITY_COLUMNS.LAST_UPDATE_TIME},
         ${ENTITY_COLUMNS.ORIGIN_NODE}
       FROM ${PG_VIEWS.ACTIVE_ENTITIES};`,
  ];
};

export const ENTITY_TYPE_VALUES: readonly EntityType[] = Object.values(ENTITY_TYPES);
