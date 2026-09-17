import { z } from 'zod';
import {
  ELIAHU_CATEGORIES,
  ELIAHU_STATUSES,
  ENTITY_TYPES,
  LAMINE_CATEGORIES,
  LANDING_ZONE_CATEGORIES,
  LANDING_ZONE_STATUSES,
  LZ_OPERATING_TYPES,
  LZ_REUT_TYPES,
  NAME_MAX_LENGTHS,
  POINT_CATEGORIES,
  ISLAND_CATEGORIES,
  WPT_CATEGORIES,
} from 'constants/entity.constants';
import { GeoCoordinateSchema } from 'models/geo.models';
import {
  KnownColorSchema,
  RemoteEntitySchema,
  createEntityBaseSchema,
} from 'models/entity.models';

export const WptSchema = createEntityBaseSchema(ENTITY_TYPES.NAVIGATION_WAY_POINT, NAME_MAX_LENGTHS.WPT)
  .merge(RemoteEntitySchema)
  .extend({
    category: z.enum(WPT_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateSchema,
    connectedRoutes: z.array(z.string().uuid()).default([]),
  });

export type Wpt = z.infer<typeof WptSchema>;

export const SymbolPointSchema = createEntityBaseSchema(ENTITY_TYPES.SYMBOL_POINT)
  .merge(RemoteEntitySchema)
  .extend({
    category: z.enum(POINT_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateSchema,
  });

export type SymbolPoint = z.infer<typeof SymbolPointSchema>;

export const LandingZoneSchema = createEntityBaseSchema(ENTITY_TYPES.LANDING_ZONE, NAME_MAX_LENGTHS.LANDING_ZONE)
  .merge(RemoteEntitySchema)
  .extend({
    category: z.enum(LANDING_ZONE_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateSchema,
    secondaryPosition: GeoCoordinateSchema,
    alias: z.string().default(''),
    code: z.string().default(''),
    status: z.enum(LANDING_ZONE_STATUSES),
    operatingCategory: z.enum(LZ_OPERATING_TYPES),
    reutCategory: z.enum(LZ_REUT_TYPES),
    dustRepair: z.number().int(),
    magneticVariable: z.number(),
  });

export type LandingZone = z.infer<typeof LandingZoneSchema>;

export const EliahuSchema = createEntityBaseSchema(ENTITY_TYPES.ELIAHU, NAME_MAX_LENGTHS.ELIAHU)
  .merge(RemoteEntitySchema)
  .extend({
    category: z.enum(ELIAHU_CATEGORIES),
    color: KnownColorSchema,
    status: z.enum(ELIAHU_STATUSES),
    radiusNm: z.number(),
    position: GeoCoordinateSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean(),
    isFilled: z.boolean().default(false),
  });

export type Eliahu = z.infer<typeof EliahuSchema>;

export const LamineSchema = createEntityBaseSchema(ENTITY_TYPES.LAMINE, NAME_MAX_LENGTHS.LAMINE)
  .merge(RemoteEntitySchema)
  .extend({
    category: z.enum(LAMINE_CATEGORIES),
    color: KnownColorSchema,
    altitudeFeet: z.number(),
    radiusNm: z.number(),
    position: GeoCoordinateSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean(),
    isFilled: z.boolean().default(false),
  });

export type Lamine = z.infer<typeof LamineSchema>;

export const MessiSchema = createEntityBaseSchema(ENTITY_TYPES.MESSI, NAME_MAX_LENGTHS.MESSI)
  .merge(RemoteEntitySchema)
  .extend({
    category: z.string(),
    altitudeFeet: z.number(),
    position: GeoCoordinateSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean(),
    isFilled: z.boolean().default(false),
  });

export type Messi = z.infer<typeof MessiSchema>;

export const IslandSchema = createEntityBaseSchema(ENTITY_TYPES.ISLAND).extend({
  category: z.enum(ISLAND_CATEGORIES),
  altitudeFeet: z.number(),
  radiusNm: z.number(),
  secondaryRadiusNm: z.number(),
  position: GeoCoordinateSchema,
  secondaryPosition: GeoCoordinateSchema,
  showLamine: z.boolean(),
  showSecondaryCircle: z.boolean(),
  isFilled: z.boolean().default(false),
});

export type Island = z.infer<typeof IslandSchema>;
