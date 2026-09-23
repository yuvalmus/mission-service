import { GEOJSON_TYPES } from 'constants/postgres.constants';
import {
  EntityRow,
  parseEntityRow,
  toEntityGeometry,
  toEntityProperties,
  toEntityWriteRow,
} from 'mappers/entity-row.mapper';
import { Polygon, Polyline } from 'models/shapes.models';
import { Route } from 'models/route.models';
import { buildCircle, buildRoute } from '../fixtures/entity.fixtures';
import { MISSION_ID } from '../fixtures/mission.fixtures';

const coordinate = (latitude: number, longitude: number) => ({
  latitude,
  longitude,
  datum: 'WGS84' as const,
});

const buildPolygon = (overrides: Partial<Polygon> = {}): Polygon =>
  ({
    ...buildCircle(),
    entityType: 'polygon',
    zone: 'none',
    coordinates: [coordinate(32, 34), coordinate(32.1, 34), coordinate(32.1, 34.1)],
    ...overrides,
  }) as unknown as Polygon;

const buildPolyline = (overrides: Partial<Polyline> = {}): Polyline =>
  ({
    ...buildCircle(),
    entityType: 'polyline',
    category: 'general',
    coordinates: [coordinate(32, 34), coordinate(32.1, 34.1)],
    ...overrides,
  }) as unknown as Polyline;

describe('entity row mapper', () => {
  describe('geometry projection', () => {
    it('projects a positioned entity to a GeoJSON point in longitude/latitude order', () => {
      const geometry = toEntityGeometry(buildCircle({ position: coordinate(32.5, 34.25) }));

      expect(geometry).toEqual({ type: GEOJSON_TYPES.POINT, coordinates: [34.25, 32.5] });
    });

    it('closes the polygon ring by repeating the first position', () => {
      const geometry = toEntityGeometry(buildPolygon());

      expect(geometry?.type).toBe(GEOJSON_TYPES.POLYGON);
      const [ring] = geometry?.coordinates as number[][][];
      expect(ring).toHaveLength(4);
      expect(ring?.[0]).toEqual(ring?.[3]);
    });

    it('does not duplicate a ring that is already closed', () => {
      const closed = buildPolygon({
        coordinates: [coordinate(32, 34), coordinate(32.1, 34), coordinate(32.1, 34.1), coordinate(32, 34)],
      });

      const [ring] = toEntityGeometry(closed)?.coordinates as number[][][];
      expect(ring).toHaveLength(4);
    });

    it('projects a polyline to a line string', () => {
      const geometry = toEntityGeometry(buildPolyline());

      expect(geometry).toEqual({
        type: GEOJSON_TYPES.LINE_STRING,
        coordinates: [
          [34, 32],
          [34.1, 32.1],
        ],
      });
    });

    it('yields no geometry for a shape with too few points to be valid', () => {
      expect(toEntityGeometry(buildPolygon({ coordinates: [coordinate(32, 34)] }))).toBeNull();
      expect(toEntityGeometry(buildPolyline({ coordinates: [coordinate(32, 34)] }))).toBeNull();
    });

    it('yields no geometry for a route, which is defined by the waypoints it references', () => {
      expect(toEntityGeometry(buildRoute() as Route)).toBeNull();
    });
  });

  describe('quantization', () => {
    it('rounds coordinates to seven decimals in the projected geometry', () => {
      const geometry = toEntityGeometry(buildCircle({ position: coordinate(32.1234567891, 34.9876543219) }));

      expect(geometry?.coordinates).toEqual([34.9876543, 32.1234568]);
    });

    it('rounds coordinates inside the stored payload so it matches the geometry column', () => {
      const properties = toEntityProperties(buildCircle({ position: coordinate(32.1234567891, 34.9876543219) }));

      expect(properties.position).toEqual({ latitude: 32.1234568, longitude: 34.9876543, datum: 'WGS84' });
    });

    it('leaves non-coordinate numbers untouched', () => {
      const properties = toEntityProperties(buildCircle({ radiusNm: 5.123456789 }));

      expect(properties.radiusNm).toBe(5.123456789);
    });

    it('preserves dates rather than flattening them into objects', () => {
      const properties = toEntityProperties(buildCircle());

      expect((properties.timeInfo as { dateCreated: Date }).dateCreated).toBeInstanceOf(Date);
    });
  });

  describe('column extraction', () => {
    it('lifts id, parentId and entityType out of the stored payload', () => {
      const row = toEntityWriteRow(buildCircle());

      expect(row.properties).not.toHaveProperty('id');
      expect(row.properties).not.toHaveProperty('parentId');
      expect(row.properties).not.toHaveProperty('entityType');
      expect(row.entityType).toBe('circle');
      expect(row.parentId).toBe(MISSION_ID);
    });
  });

  describe('reading a row back', () => {
    const toRow = (missionId: string | null, infraId: string | null): EntityRow => {
      const entity = buildCircle();
      return {
        entity_id: entity.id,
        mission_id: missionId,
        infra_id: infraId,
        entity_type: entity.entityType,
        properties: toEntityProperties(entity),
      };
    };

    it('round-trips an entity through the row representation', () => {
      const { entity } = parseEntityRow(toRow(MISSION_ID, null));

      expect(entity).toEqual(buildCircle());
    });

    it('resolves the parent from the infra column when the parent is a stake', () => {
      const stakeId = '9f8e7d6c-5555-4444-8333-222211110000';
      const { entity } = parseEntityRow(toRow(null, stakeId));

      expect(entity?.parentId).toBe(stakeId);
    });

    it('reports a payload that no longer matches the schema instead of throwing', () => {
      const row = toRow(MISSION_ID, null);
      const result = parseEntityRow({ ...row, properties: { ...row.properties, color: 'NotARealColor' } });

      expect(result.entity).toBeNull();
      expect(result.issues).toBeDefined();
    });
  });
});
