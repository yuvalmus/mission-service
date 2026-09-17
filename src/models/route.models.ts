import { z } from 'zod';
import {
  ENTITY_TYPES,
  ROUTE_CATEGORIES,
  ROUTE_LIMITS,
  ROUTE_PROVIDERS,
  ROUTE_VIEW_MODES
} from 'constants/entity.constants';
import { GeoCoordinateSchema } from 'models/geo.models';
import {
  KnownColorSchema,
  LineStyleSchema,
  RemoteEntitySchema,
  createEntityBaseSchema
} from 'models/entity.models';

export const LegHighPointSchema = z.object({
  nz: GeoCoordinateSchema,
  altitudeFeet: z.number()
});

export type LegHighPoint = z.infer<typeof LegHighPointSchema>;

const PositionOffsetSchema = z.object({
  offsetPixelsX: z.number().default(0),
  offsetPixelsY: z.number().default(0)
});

export const RouteLegOffsetsSchema = z.object({
  dogHouseOffset: PositionOffsetSchema.optional(),
  timeTillZmmOffset: PositionOffsetSchema.optional()
});

export type RouteLegOffsets = z.infer<typeof RouteLegOffsetsSchema>;

export const RouteLegSchema = z.object({
  startWpt: z.string().uuid(),
  endWpt: z.string().uuid(),
  distanceNm: z.number().nonnegative(),
  angle: z.number(),
  legTimeMs: z.number().nonnegative(),
  isManualLegTime: z.boolean(),
  tas: z.number().int(),
  zmmTime: z.string().optional(),
  highestPoint: LegHighPointSchema,
  safetyAltitudeFeet: z.number(),
  legOffsets: RouteLegOffsetsSchema,
  turnPoint: GeoCoordinateSchema.optional()
});

export type RouteLeg = z.infer<typeof RouteLegSchema>;

export const RouteSchema = createEntityBaseSchema(ENTITY_TYPES.ROUTE)
  .merge(RemoteEntitySchema)
  .extend({
    category: z.enum(ROUTE_CATEGORIES),
    color: KnownColorSchema,
    lineStyle: LineStyleSchema,
    remoteName: z.string().max(ROUTE_LIMITS.REMOTE_NAME_MAX_LENGTH).optional(),
    wptsIds: z.array(z.string().uuid()),
    legs: z.array(RouteLegSchema),
    defaultTas: z.number().int(),
    isActive: z.boolean().default(false),
    routeSource: z.enum(ROUTE_PROVIDERS).default('hair'),
    viewMode: z.enum(ROUTE_VIEW_MODES).default('regular'),
    zmmWptId: z.string().uuid().optional()
  });

export type Route = z.infer<typeof RouteSchema>;
