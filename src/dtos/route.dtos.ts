import { z } from 'config/openapi.config';
import {
  ENTITY_SOURCES,
  LINE_STYLES,
  ROUTE_CATEGORIES,
  ROUTE_PROVIDERS,
  ROUTE_VIEW_MODES
} from 'constants/entity.constants';
import { KnownColorSchema } from 'models/entity.models';
import { AltitudeSchema, GeneralEntityInfoSchema, GeoCoordinateDtoSchema } from 'dtos/entity.dtos';
import { CreateRouteWptDtoSchema } from 'dtos/points.dtos';
import { entityNameSchema } from 'dtos/shapes.dtos';

export const LegHighPointDtoSchema = z
  .object({
    nz: GeoCoordinateDtoSchema,
    altitude: AltitudeSchema
  })
  .openapi('LegHighPointDto');

export type LegHighPointDto = z.infer<typeof LegHighPointDtoSchema>;

const PositionOffsetDtoSchema = z.object({
  offsetPixelsX: z.number().default(0),
  offsetPixelsY: z.number().default(0)
});

export const RouteLegOffsetsDtoSchema = z
  .object({
    dogHouseOffset: PositionOffsetDtoSchema.optional(),
    timeTillZmmOffset: PositionOffsetDtoSchema.optional()
  })
  .openapi('RouteLegOffsetsDto');

export const RouteLegDtoSchema = z
  .object({
    startWpt: z.string().uuid(),
    endWpt: z.string().uuid(),
    distanceNm: z.number().nonnegative(),
    angle: z.number(),
    legTimeMs: z.number().nonnegative(),
    isManualLegTime: z.boolean(),
    tas: z.number().int(),
    zmmTime: z.string().datetime({ offset: true }).optional(),
    highestPoint: LegHighPointDtoSchema,
    safetyAltitude: z.number(),
    legOffsets: RouteLegOffsetsDtoSchema,
    turnPoint: GeoCoordinateDtoSchema.optional()
  })
  .openapi('RouteLegDto');

export type RouteLegDto = z.infer<typeof RouteLegDtoSchema>;

export const CreateOrUpdateRouteDtoSchema = z
  .object({
    id: z.string().uuid(),
    parentId: z.string().uuid(),
    name: entityNameSchema(),
    remark: z.string(),
    isActive: z.boolean(),
    source: z.enum(ENTITY_SOURCES),
    category: z.enum(ROUTE_CATEGORIES),
    routeSource: z.enum(ROUTE_PROVIDERS),
    viewMode: z.enum(ROUTE_VIEW_MODES),
    color: KnownColorSchema,
    lineStyle: z.enum(LINE_STYLES),
    legs: z.array(RouteLegDtoSchema),
    isVisible: z.boolean(),
    wpts: z.array(CreateRouteWptDtoSchema),
    defaultTas: z.number().int(),
    remoteId: z.number().optional(),
    remoteName: z.string().optional(),
    zmmWptId: z.string().uuid().optional()
  })
  .openapi('CreateOrUpdateRouteDto');

export type CreateOrUpdateRouteDto = z.infer<typeof CreateOrUpdateRouteDtoSchema>;

export const RouteDtoSchema = z
  .object({
    general: GeneralEntityInfoSchema,
    entityType: z.string(),
    source: z.string(),
    isVisible: z.boolean(),
    lineStyle: z.string(),
    color: z.string(),
    category: z.string(),
    wptsIds: z.array(z.string().uuid()),
    legs: z.array(RouteLegDtoSchema),
    defaultTas: z.number().int(),
    remoteId: z.number().optional(),
    remoteName: z.string().optional(),
    zmmWptId: z.string().uuid().optional()
  })
  .openapi('RouteDto');

export type RouteDto = z.infer<typeof RouteDtoSchema>;

export const RetrieveRouteDtoSchema = z
  .object({
    general: GeneralEntityInfoSchema,
    entityType: z.string(),
    source: z.string(),
    isVisible: z.boolean(),
    lineStyle: z.string(),
    color: z.string(),
    category: z.string(),
    wptsCoords: z.array(GeoCoordinateDtoSchema),
    remoteId: z.number().optional(),
    remoteName: z.string().optional()
  })
  .openapi('RetrieveRouteDto');

export type RetrieveRouteDto = z.infer<typeof RetrieveRouteDtoSchema>;

export const RouteNavLegDtoSchema = z
  .object({
    endWpt: z.string().uuid(),
    endWptPosition: GeoCoordinateDtoSchema.optional(),
    distanceNm: z.number(),
    angle: z.number(),
    legTimeMs: z.number(),
    zmmTime: z.string().datetime({ offset: true }).optional(),
    safetyAltitude: z.number()
  })
  .openapi('RouteNavLegDto');

export type RouteNavLegDto = z.infer<typeof RouteNavLegDtoSchema>;

export const RetrieveNavigationRouteDtoSchema = z
  .object({
    general: GeneralEntityInfoSchema,
    legs: z.array(RouteNavLegDtoSchema)
  })
  .openapi('RetrieveNavigationRouteDto');

export type RetrieveNavigationRouteDto = z.infer<typeof RetrieveNavigationRouteDtoSchema>;
