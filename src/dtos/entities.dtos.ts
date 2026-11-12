import { RefinementCtx } from 'zod';
import { z } from 'config/openapi.config';
import {
  ALTITUDE_LIMITS,
  ANGLE_LIMITS,
  AREA_CATEGORIES,
  ENTITY_SOURCES,
  LANDING_ZONE_CATEGORIES,
  LANDING_ZONE_STATUSES,
  LINE_STYLES,
  LZ_REUT_TYPES,
  LZ_OPERATING_TYPES,
  NAME_MAX_LENGTHS,
  ELIAHU_CATEGORIES,
  ELIAHU_STATUSES,
  POINT_CATEGORIES,
  POLYGON_LIMITS,
  POLYLINE_CATEGORIES,
  RADIUS_LIMITS,
  ISLAND_CATEGORIES,
  LAMINE_CATEGORIES,
  TIME_ZONE_AREAS,
  WPT_CATEGORIES
} from 'constants/entity.constants';
import { EntityColorSchema } from 'models/common.entity.models';
import {
  ActiveTimeDtoSchema,
  GeneralEntityInfoSchema,
  GeoCoordinateDtoSchema
} from 'dtos/commonEntity.dtos';

export const DTO_VALIDATION_MESSAGES = {
  NAME_TOO_LONG: (max: number) => `The name exceeds the maximum length of ${max} characters.`,
  MIN_ABOVE_MAX_ALTITUDE: 'minimum altitude cannot be higher than maximum altitude',
  TRAINING_LOW_ALTITUDE: (max: number) =>
    `${max} is not within the valid range of 0 to ${ALTITUDE_LIMITS.TRAINING_BOUNDARY_FEET}`,
  TRAINING_HIGH_ALTITUDE: (min: number) =>
    `${min} is not within the valid range of ${ALTITUDE_LIMITS.TRAINING_BOUNDARY_FEET} to 2147483647`,
  INVALID_TIME_RANGE: 'beginTime must be before endTime',
  POLYGON_MIN_COORDINATES: 'Area must contain at least two coordinates',
  START_ANGLE_RANGE: 'Start angle should be between 0-360',
  END_ANGLE_RANGE: 'End angle should be between 0-360',
  START_END_ANGLE_ORDER: 'Start angle must be smaller than end angle.',
  RADIUS_RANGE: (min: number, max: number) => `value must be between ${min} and ${max}`
} as const;

export const entityNameSchema = (maxLength: number = NAME_MAX_LENGTHS.DEFAULT) =>
  z.string().min(1).max(maxLength, DTO_VALIDATION_MESSAGES.NAME_TOO_LONG(maxLength));

export const radiusNmSchema = (limits: { readonly MIN: number; readonly MAX: number }) =>
  z
    .number()
    .min(limits.MIN, DTO_VALIDATION_MESSAGES.RADIUS_RANGE(limits.MIN, limits.MAX))
    .max(limits.MAX, DTO_VALIDATION_MESSAGES.RADIUS_RANGE(limits.MIN, limits.MAX));

const OptionalDatetime = z.string().datetime({ offset: true }).optional();

interface TimeRangeFields {
  beginTime?: string;
  endTime?: string;
}

export const validateTimeRange = (data: TimeRangeFields, ctx: RefinementCtx): void => {
  if (data.beginTime && data.endTime && new Date(data.beginTime) >= new Date(data.endTime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: DTO_VALIDATION_MESSAGES.INVALID_TIME_RANGE
    });
  }
};

interface AreaAltitudeFields {
  category: string;
  minAltitudeFeet: number;
  maxAltitudeFeet: number;
}

export const validateAreaAltitude = (data: AreaAltitudeFields, ctx: RefinementCtx): void => {
  if (data.minAltitudeFeet > data.maxAltitudeFeet) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: DTO_VALIDATION_MESSAGES.MIN_ABOVE_MAX_ALTITUDE
    });
  }
  if (
    data.category === AREA_CATEGORIES.TRAINING_LOW &&
    data.maxAltitudeFeet > ALTITUDE_LIMITS.TRAINING_BOUNDARY_FEET
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: DTO_VALIDATION_MESSAGES.TRAINING_LOW_ALTITUDE(data.maxAltitudeFeet)
    });
  }
  if (
    data.category === AREA_CATEGORIES.TRAINING_HIGH &&
    data.minAltitudeFeet < ALTITUDE_LIMITS.TRAINING_BOUNDARY_FEET
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: DTO_VALIDATION_MESSAGES.TRAINING_HIGH_ALTITUDE(data.minAltitudeFeet)
    });
  }
};

interface AngleFields {
  startAngle: number;
  endAngle: number;
}

export const validateSectorAngles = (data: AngleFields, ctx: RefinementCtx): void => {
  if (data.startAngle < ANGLE_LIMITS.MIN || data.startAngle > ANGLE_LIMITS.MAX) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: DTO_VALIDATION_MESSAGES.START_ANGLE_RANGE });
  }
  if (data.endAngle < ANGLE_LIMITS.MIN || data.endAngle > ANGLE_LIMITS.MAX) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: DTO_VALIDATION_MESSAGES.END_ANGLE_RANGE });
  }
  if (data.startAngle >= data.endAngle) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: DTO_VALIDATION_MESSAGES.START_END_ANGLE_ORDER });
  }
};

const createCommonFields = (maxNameLength?: number) => ({
  parentId: z.uuid(),
  source: z.enum(ENTITY_SOURCES),
  name: entityNameSchema(maxNameLength),
  remark: z.string(),
  isVisible: z.boolean(),
  remoteId: z.number().optional(),
  remoteName: z.string().optional()
});

const updateCommonFields = (maxNameLength?: number) => ({
  id: z.uuid(),
  parentId: z.uuid(),
  name: entityNameSchema(maxNameLength),
  remark: z.string(),
  isVisible: z.boolean(),
  remoteId: z.number(),
  remoteName: z.string()
});

const pointUpdateCommonFields = (maxNameLength?: number) => ({
  id: z.uuid(),
  parentId: z.uuid(),
  name: entityNameSchema(maxNameLength),
  remark: z.string(),
  isVisible: z.boolean(),
  remoteId: z.number().optional(),
  remoteName: z.string()
});

const styledFields = {
  color: EntityColorSchema,
  lineStyle: z.enum(LINE_STYLES)
} as const;

const areaFields = {
  category: z.enum(AREA_CATEGORIES),
  beginTime: OptionalDatetime,
  endTime: OptionalDatetime,
  minAltitudeFeet: z.number(),
  maxAltitudeFeet: z.number(),
  ...styledFields,
  isFilled: z.boolean()
} as const;

const readCommonFields = {
  general: GeneralEntityInfoSchema,
  entityType: z.string(),
  source: z.string(),
  isVisible: z.boolean(),
  remoteId: z.number().optional(),
  remoteName: z.string().optional()
} as const;

const pointReadCommonFields = {
  general: GeneralEntityInfoSchema,
  entityType: z.string(),
  source: z.string(),
  category: z.string(),
  isVisible: z.boolean()
} as const;

const readRemoteFields = {
  remoteId: z.number().optional(),
  remoteName: z.string().optional()
} as const;

const readAreaFields = {
  ...readCommonFields,
  category: z.string(),
  activeTime: ActiveTimeDtoSchema,
  minAltitudeFeet: z.number(),
  maxAltitudeFeet: z.number(),
  lineStyle: z.string(),
  color: z.string(),
  isFilled: z.boolean()
} as const;

const landingZoneFields = {
  category: z.enum(LANDING_ZONE_CATEGORIES),
  altitudeFeet: z.number(),
  alias: z.string(),
  code: z.string(),
  status: z.enum(LANDING_ZONE_STATUSES),
  operatingCategory: z.enum(LZ_OPERATING_TYPES),
  reutCategory: z.enum(LZ_REUT_TYPES),
  dustRepair: z.number().int(),
  magneticVariable: z.number()
} as const;

const withAreaRefinements = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((data, ctx) => {
    validateAreaAltitude(data as AreaAltitudeFields, ctx);
    validateTimeRange(data as TimeRangeFields, ctx);
  });

export const CreateCircleDtoSchema = withAreaRefinements(
  z.object({
    ...createCommonFields(),
    ...areaFields,
    radiusNm: radiusNmSchema(RADIUS_LIMITS.AREA),
    position: GeoCoordinateDtoSchema
  })
).openapi('CreateCircleDto');

export type CreateCircleDto = z.infer<typeof CreateCircleDtoSchema>;

export const UpdateCircleDtoSchema = withAreaRefinements(
  z.object({
    ...updateCommonFields(),
    ...areaFields,
    radiusNm: radiusNmSchema(RADIUS_LIMITS.AREA),
    position: GeoCoordinateDtoSchema
  })
).openapi('UpdateCircleDto');

export type UpdateCircleDto = z.infer<typeof UpdateCircleDtoSchema>;

export const CircleDtoSchema = z
  .object({
    ...readAreaFields,
    radiusNm: z.number(),
    position: GeoCoordinateDtoSchema
  })
  .openapi('CircleDto');

export type CircleDto = z.infer<typeof CircleDtoSchema>;

export const CreateSectorDtoSchema = z
  .object({
    ...createCommonFields(),
    ...areaFields,
    radiusNm: radiusNmSchema(RADIUS_LIMITS.AREA),
    position: GeoCoordinateDtoSchema,
    startAngle: z.number(),
    endAngle: z.number()
  })
  .superRefine((data, ctx) => {
    validateAreaAltitude(data, ctx);
    validateTimeRange(data, ctx);
    validateSectorAngles(data, ctx);
  })
  .openapi('CreateSectorDto');

export type CreateSectorDto = z.infer<typeof CreateSectorDtoSchema>;

export const UpdateSectorDtoSchema = z
  .object({
    ...updateCommonFields(),
    ...areaFields,
    radiusNm: radiusNmSchema(RADIUS_LIMITS.AREA),
    position: GeoCoordinateDtoSchema,
    startAngle: z.number(),
    endAngle: z.number()
  })
  .superRefine((data, ctx) => {
    validateAreaAltitude(data, ctx);
    validateTimeRange(data, ctx);
    validateSectorAngles(data, ctx);
  })
  .openapi('UpdateSectorDto');

export type UpdateSectorDto = z.infer<typeof UpdateSectorDtoSchema>;

export const SectorDtoSchema = z
  .object({
    ...readAreaFields,
    radiusNm: z.number(),
    position: GeoCoordinateDtoSchema,
    startAngle: z.number(),
    endAngle: z.number()
  })
  .openapi('SectorDto');

export type SectorDto = z.infer<typeof SectorDtoSchema>;

const polygonCoordinates = z
  .array(GeoCoordinateDtoSchema)
  .min(POLYGON_LIMITS.MIN_COORDINATES, DTO_VALIDATION_MESSAGES.POLYGON_MIN_COORDINATES);

export const CreatePolygonDtoSchema = withAreaRefinements(
  z.object({
    ...createCommonFields(),
    ...areaFields,
    zone: z.enum(TIME_ZONE_AREAS),
    coordinates: polygonCoordinates
  })
).openapi('CreatePolygonDto');

export type CreatePolygonDto = z.infer<typeof CreatePolygonDtoSchema>;

export const UpdatePolygonDtoSchema = withAreaRefinements(
  z.object({
    ...updateCommonFields(),
    ...areaFields,
    zone: z.enum(TIME_ZONE_AREAS),
    coordinates: polygonCoordinates
  })
).openapi('UpdatePolygonDto');

export type UpdatePolygonDto = z.infer<typeof UpdatePolygonDtoSchema>;

export const PolygonDtoSchema = z
  .object({
    ...readAreaFields,
    zone: z.string(),
    coordinates: z.array(GeoCoordinateDtoSchema)
  })
  .openapi('PolygonDto');

export type PolygonDto = z.infer<typeof PolygonDtoSchema>;

export const CreateCorridorDtoSchema = withAreaRefinements(
  z.object({
    ...createCommonFields(),
    ...areaFields,
    radiusNm: radiusNmSchema(RADIUS_LIMITS.AREA),
    coordinates: z.array(GeoCoordinateDtoSchema)
  })
).openapi('CreateCorridorDto');

export type CreateCorridorDto = z.infer<typeof CreateCorridorDtoSchema>;

export const UpdateCorridorDtoSchema = withAreaRefinements(
  z.object({
    ...updateCommonFields(),
    ...areaFields,
    radiusNm: radiusNmSchema(RADIUS_LIMITS.AREA),
    coordinates: z.array(GeoCoordinateDtoSchema)
  })
).openapi('UpdateCorridorDto');

export type UpdateCorridorDto = z.infer<typeof UpdateCorridorDtoSchema>;

export const CorridorDtoSchema = z
  .object({
    ...readAreaFields,
    radiusNm: z.number(),
    coordinates: z.array(GeoCoordinateDtoSchema)
  })
  .openapi('CorridorDto');

export type CorridorDto = z.infer<typeof CorridorDtoSchema>;

export const CreatePolylineDtoSchema = z
  .object({
    ...createCommonFields(),
    category: z.enum(POLYLINE_CATEGORIES),
    beginTime: OptionalDatetime,
    endTime: OptionalDatetime,
    ...styledFields,
    coordinates: z.array(GeoCoordinateDtoSchema)
  })
  .superRefine(validateTimeRange)
  .openapi('CreatePolylineDto');

export type CreatePolylineDto = z.infer<typeof CreatePolylineDtoSchema>;

export const UpdatePolylineDtoSchema = z
  .object({
    ...updateCommonFields(),
    category: z.enum(POLYLINE_CATEGORIES),
    ...styledFields,
    coordinates: z.array(GeoCoordinateDtoSchema)
  })
  .openapi('UpdatePolylineDto');

export type UpdatePolylineDto = z.infer<typeof UpdatePolylineDtoSchema>;

export const PolylineDtoSchema = z
  .object({
    ...readCommonFields,
    category: z.string(),
    activeTime: ActiveTimeDtoSchema,
    lineStyle: z.string(),
    color: z.string(),
    coordinates: z.array(GeoCoordinateDtoSchema)
  })
  .openapi('PolylineDto');

export type PolylineDto = z.infer<typeof PolylineDtoSchema>;

export const CreateWptDtoSchema = z
  .object({
    ...createCommonFields(NAME_MAX_LENGTHS.WPT),
    category: z.enum(WPT_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema
  })
  .openapi('CreateWptDto');

export type CreateWptDto = z.infer<typeof CreateWptDtoSchema>;

export const CreateRouteWptDtoSchema = z
  .object({
    id: z.uuid(),
    ...createCommonFields(NAME_MAX_LENGTHS.WPT),
    category: z.enum(WPT_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema
  })
  .openapi('CreateRouteWptDto');

export type CreateRouteWptDto = z.infer<typeof CreateRouteWptDtoSchema>;

export const UpdateWptDtoSchema = z
  .object({
    ...pointUpdateCommonFields(NAME_MAX_LENGTHS.WPT),
    category: z.enum(WPT_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema
  })
  .openapi('UpdateWptDto');

export type UpdateWptDto = z.infer<typeof UpdateWptDtoSchema>;

export const WptDtoSchema = z
  .object({
    ...pointReadCommonFields,
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema,
    ...readRemoteFields
  })
  .openapi('WptDto');

export type WptDto = z.infer<typeof WptDtoSchema>;

export const CreateSymbolPointDtoSchema = z
  .object({
    ...createCommonFields(),
    category: z.enum(POINT_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema
  })
  .openapi('CreateSymbolPointDto');

export type CreateSymbolPointDto = z.infer<typeof CreateSymbolPointDtoSchema>;

export const UpdateSymbolPointDtoSchema = z
  .object({
    ...pointUpdateCommonFields(),
    category: z.enum(POINT_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema
  })
  .openapi('UpdateSymbolPointDto');

export type UpdateSymbolPointDto = z.infer<typeof UpdateSymbolPointDtoSchema>;

export const SymbolPointDtoSchema = z
  .object({
    ...pointReadCommonFields,
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema,
    ...readRemoteFields
  })
  .openapi('SymbolPointDto');

export type SymbolPointDto = z.infer<typeof SymbolPointDtoSchema>;

export const CreateLandingZoneDtoSchema = z
  .object({
    ...createCommonFields(NAME_MAX_LENGTHS.LANDING_ZONE),
    ...landingZoneFields,
    position: GeoCoordinateDtoSchema,
    secondaryPosition: GeoCoordinateDtoSchema
  })
  .openapi('CreateLandingZoneDto');

export type CreateLandingZoneDto = z.infer<typeof CreateLandingZoneDtoSchema>;

export const UpdateLandingZoneDtoSchema = z
  .object({
    ...pointUpdateCommonFields(NAME_MAX_LENGTHS.LANDING_ZONE),
    ...landingZoneFields,
    position: GeoCoordinateDtoSchema,
    secondaryPosition: GeoCoordinateDtoSchema
  })
  .openapi('UpdateLandingZoneDto');

export type UpdateLandingZoneDto = z.infer<typeof UpdateLandingZoneDtoSchema>;

export const LandingZoneDtoSchema = z
  .object({
    ...pointReadCommonFields,
    altitudeFeet: z.number(),
    alias: z.string(),
    code: z.string(),
    status: z.string(),
    operatingCategory: z.string(),
    reutCategory: z.string(),
    dustRepair: z.number().int(),
    magneticVariable: z.number(),
    startNz: GeoCoordinateDtoSchema,
    endNz: GeoCoordinateDtoSchema,
    ...readRemoteFields
  })
  .openapi('LandingZoneDto');

export type LandingZoneDto = z.infer<typeof LandingZoneDtoSchema>;

export const CreateEliahuDtoSchema = z
  .object({
    ...createCommonFields(NAME_MAX_LENGTHS.ELIAHU),
    category: z.enum(ELIAHU_CATEGORIES),
    color: EntityColorSchema,
    isFilled: z.boolean(),
    radiusNm: radiusNmSchema(RADIUS_LIMITS.ELIAHU),
    status: z.enum(ELIAHU_STATUSES),
    position: GeoCoordinateDtoSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean()
  })
  .openapi('CreateEliahuDto');

export type CreateEliahuDto = z.infer<typeof CreateEliahuDtoSchema>;

export const UpdateEliahuDtoSchema = z
  .object({
    ...pointUpdateCommonFields(NAME_MAX_LENGTHS.ELIAHU),
    category: z.enum(ELIAHU_CATEGORIES),
    color: EntityColorSchema,
    isFilled: z.boolean(),
    radiusNm: radiusNmSchema(RADIUS_LIMITS.ELIAHU),
    status: z.enum(ELIAHU_STATUSES),
    position: GeoCoordinateDtoSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean()
  })
  .openapi('UpdateEliahuDto');

export type UpdateEliahuDto = z.infer<typeof UpdateEliahuDtoSchema>;

export const EliahuDtoSchema = z
  .object({
    ...pointReadCommonFields,
    color: z.string(),
    isFilled: z.boolean(),
    radiusNm: z.number(),
    status: z.string(),
    position: GeoCoordinateDtoSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean(),
    ...readRemoteFields
  })
  .openapi('EliahuDto');

export type EliahuDto = z.infer<typeof EliahuDtoSchema>;

export const CreateIslandDtoSchema = z
  .object({
    ...createCommonFields(),
    category: z.enum(ISLAND_CATEGORIES),
    altitudeFeet: z.number(),
    isFilled: z.boolean(),
    radiusNm: z.number().nonnegative(),
    secondaryRadiusNm: z.number().nonnegative(),
    position: GeoCoordinateDtoSchema,
    circleCenterPosition: GeoCoordinateDtoSchema,
    showLamine: z.boolean(),
    showSecondaryCircle: z.boolean()
  })
  .openapi('CreateIslandDto');

export type CreateIslandDto = z.infer<typeof CreateIslandDtoSchema>;

export const UpdateIslandDtoSchema = z
  .object({
    id: z.uuid(),
    parentId: z.uuid(),
    category: z.enum(ISLAND_CATEGORIES),
    altitudeFeet: z.number(),
    name: entityNameSchema(),
    remark: z.string(),
    isVisible: z.boolean(),
    isFilled: z.boolean(),
    radiusNm: z.number().nonnegative(),
    secondaryRadiusNm: z.number().nonnegative(),
    position: GeoCoordinateDtoSchema,
    circleCenterPosition: GeoCoordinateDtoSchema,
    showLamine: z.boolean(),
    showSecondaryCircle: z.boolean()
  })
  .openapi('UpdateIslandDto');

export type UpdateIslandDto = z.infer<typeof UpdateIslandDtoSchema>;

export const IslandDtoSchema = z
  .object({
    ...pointReadCommonFields,
    altitudeFeet: z.number(),
    isFilled: z.boolean(),
    radiusNm: z.number(),
    secondaryRadius: z.number(),
    position: GeoCoordinateDtoSchema,
    circleCenterPosition: GeoCoordinateDtoSchema,
    showLamine: z.boolean(),
    showSecondaryCircle: z.boolean()
  })
  .openapi('IslandDto');

export type IslandDto = z.infer<typeof IslandDtoSchema>;

export const CreateLamineDtoSchema = z
  .object({
    ...createCommonFields(NAME_MAX_LENGTHS.LAMINE),
    category: z.enum(LAMINE_CATEGORIES),
    altitudeFeet: z.number(),
    color: EntityColorSchema,
    isFilled: z.boolean(),
    radiusNm: radiusNmSchema(RADIUS_LIMITS.LAMINE),
    position: GeoCoordinateDtoSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean()
  })
  .openapi('CreateLamineDto');

export type CreateLamineDto = z.infer<typeof CreateLamineDtoSchema>;

export const UpdateLamineDtoSchema = z
  .object({
    ...pointUpdateCommonFields(NAME_MAX_LENGTHS.LAMINE),
    category: z.enum(LAMINE_CATEGORIES),
    altitudeFeet: z.number(),
    color: EntityColorSchema,
    isFilled: z.boolean(),
    radiusNm: radiusNmSchema(RADIUS_LIMITS.LAMINE),
    position: GeoCoordinateDtoSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean()
  })
  .openapi('UpdateLamineDto');

export type UpdateLamineDto = z.infer<typeof UpdateLamineDtoSchema>;

export const LamineDtoSchema = z
  .object({
    ...pointReadCommonFields,
    altitudeFeet: z.number(),
    color: z.string(),
    isFilled: z.boolean(),
    radiusNm: z.number(),
    position: GeoCoordinateDtoSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean(),
    ...readRemoteFields
  })
  .openapi('LamineDto');

export type LamineDto = z.infer<typeof LamineDtoSchema>;

export const CreateMessiDtoSchema = z
  .object({
    ...createCommonFields(NAME_MAX_LENGTHS.MESSI),
    category: z.string(),
    altitudeFeet: z.number(),
    isFilled: z.boolean(),
    position: GeoCoordinateDtoSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean()
  })
  .openapi('CreateMessiDto');

export type CreateMessiDto = z.infer<typeof CreateMessiDtoSchema>;

export const UpdateMessiDtoSchema = z
  .object({
    ...pointUpdateCommonFields(NAME_MAX_LENGTHS.MESSI),
    category: z.string(),
    altitudeFeet: z.number(),
    isFilled: z.boolean(),
    position: GeoCoordinateDtoSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean()
  })
  .openapi('UpdateMessiDto');

export type UpdateMessiDto = z.infer<typeof UpdateMessiDtoSchema>;

export const MessiDtoSchema = z
  .object({
    ...pointReadCommonFields,
    altitudeFeet: z.number(),
    isFilled: z.boolean(),
    position: GeoCoordinateDtoSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean(),
    ...readRemoteFields
  })
  .openapi('MessiDto');

export type MessiDto = z.infer<typeof MessiDtoSchema>;