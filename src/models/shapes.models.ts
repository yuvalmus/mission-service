import { z } from 'zod';
import {
  AREA_CATEGORIES,
  ENTITY_TYPES,
  POLYLINE_CATEGORIES,
  TIME_ZONE_AREAS
} from 'constants/entity.constants';
import { GeoCoordinateSchema } from 'models/geo.models';
import {
  KnownColorSchema,
  LineStyleSchema,
  RemoteEntitySchema,
  createEntityBaseSchema
} from 'models/entity.models';
import { ActiveTimeSchema } from './time.models';

export const AltitudeRangeSchema = z.object({
  minAltitudeFeet: z.number(),
  maxAltitudeFeet: z.number()
});

export type AltitudeRange = z.infer<typeof AltitudeRangeSchema>;

const areaEntityShape = {
  category: z.enum(AREA_CATEGORIES),
  color: KnownColorSchema,
  lineStyle: LineStyleSchema,
  activeTime: ActiveTimeSchema,
  altitudeRange: AltitudeRangeSchema,
  isFilled: z.boolean().default(false)
} as const;

export const CircleSchema = createEntityBaseSchema(ENTITY_TYPES.CIRCLE)
  .merge(RemoteEntitySchema)
  .extend({
    ...areaEntityShape,
    radiusNm: z.number(),
    position: GeoCoordinateSchema
  });

export type Circle = z.infer<typeof CircleSchema>;

export const SectorSchema = createEntityBaseSchema(ENTITY_TYPES.SECTOR)
  .merge(RemoteEntitySchema)
  .extend({
    ...areaEntityShape,
    radiusNm: z.number(),
    position: GeoCoordinateSchema,
    startAngle: z.number(),
    endAngle: z.number()
  });

export type Sector = z.infer<typeof SectorSchema>;

export const PolygonSchema = createEntityBaseSchema(ENTITY_TYPES.POLYGON)
  .merge(RemoteEntitySchema)
  .extend({
    ...areaEntityShape,
    zone: z.enum(TIME_ZONE_AREAS),
    coordinates: z.array(GeoCoordinateSchema)
  });

export type Polygon = z.infer<typeof PolygonSchema>;

export const CorridorSchema = createEntityBaseSchema(ENTITY_TYPES.CORRIDOR)
  .merge(RemoteEntitySchema)
  .extend({
    ...areaEntityShape,
    radiusNm: z.number(),
    coordinates: z.array(GeoCoordinateSchema)
  });

export type Corridor = z.infer<typeof CorridorSchema>;

export const PolylineSchema = createEntityBaseSchema(ENTITY_TYPES.POLYLINE)
  .merge(RemoteEntitySchema)
  .extend({
    category: z.enum(POLYLINE_CATEGORIES),
    color: KnownColorSchema,
    lineStyle: LineStyleSchema,
    activeTime: ActiveTimeSchema,
    coordinates: z.array(GeoCoordinateSchema)
  });

export type Polyline = z.infer<typeof PolylineSchema>;
