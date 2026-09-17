import { RefinementCtx } from 'zod';
import { z } from 'config/openapi.config';
import {
  ALTITUDE_LIMITS,
  ANGLE_LIMITS,
  AREA_CATEGORIES,
  ENTITY_SOURCES,
  LINE_STYLES,
  NAME_MAX_LENGTHS,
  POLYGON_LIMITS,
  POLYLINE_CATEGORIES,
  RADIUS_LIMITS,
  TIME_ZONE_AREAS
} from 'constants/entity.constants';
import { KnownColorSchema } from 'models/entity.models';
import {
  ActiveTimeDtoSchema,
  GeneralEntityInfoSchema,
  GeoCoordinateDtoSchema
} from 'dtos/entity.dtos';

export const DTO_VALIDATION_MESSAGES = {
  NAME_TOO_LONG: (max: number) => `The name exceeds the maximum length of ${max} characters.`,
  MIN_ABOVE_MAX_ALTITUDE: 'minimum altitude cannot be higher than maximum altitude',
  TRAINING_LOW_ALTITUDE: (max: number) =>
    `${max} is not within the valid range of 0 to ${ALTITUDE_LIMITS.TRAINING_BOUNDARY_FEET}`,
  TRAINING_HIGH_ALTITUDE: (min: number) =>
    `${min} is not within the valid range of ${ALTITUDE_LIMITS.TRAINING_BOUNDARY_FEET} to 2147483647`,
  ACTIVE_TIME_ORDER: 'beginTime must be before endTime',
  POLYGON_MIN_COORDINATES: 'Area must contain at least two coordinates',
  START_ANGLE_RANGE: 'Start angle should be between 0-360',
  END_ANGLE_RANGE: 'End angle should be between 0-360',
  ANGLE_ORDER: 'Start angle must be smaller than end angle.',
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

interface ActiveWindowFields {
  beginTime?: string;
  endTime?: string;
}

export const validateActiveWindow = (data: ActiveWindowFields, ctx: RefinementCtx): void => {
  if (data.beginTime && data.endTime && new Date(data.beginTime) >= new Date(data.endTime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: DTO_VALIDATION_MESSAGES.ACTIVE_TIME_ORDER
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
    data.category === 'TrainingLow' &&
    data.maxAltitudeFeet > ALTITUDE_LIMITS.TRAINING_BOUNDARY_FEET
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: DTO_VALIDATION_MESSAGES.TRAINING_LOW_ALTITUDE(data.maxAltitudeFeet)
    });
  }
  if (
    data.category === 'TrainingHigh' &&
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
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: DTO_VALIDATION_MESSAGES.START_ANGLE_RANGE
    });
  }
  if (data.endAngle < ANGLE_LIMITS.MIN || data.endAngle > ANGLE_LIMITS.MAX) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: DTO_VALIDATION_MESSAGES.END_ANGLE_RANGE });
  }
  if (data.startAngle >= data.endAngle) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: DTO_VALIDATION_MESSAGES.ANGLE_ORDER });
  }
};

const createCommonFields = (nameMaxLength?: number) => ({
  parentId: z.string().uuid(),
  source: z.enum(ENTITY_SOURCES),
  name: entityNameSchema(nameMaxLength),
  remark: z.string(),
  isVisible: z.boolean(),
  remoteId: z.number().optional(),
  remoteName: z.string().optional()
});

const updateCommonFields = (nameMaxLength?: number) => ({
  id: z.string().uuid(),
  parentId: z.string().uuid(),
  name: entityNameSchema(nameMaxLength),
  remark: z.string(),
  isVisible: z.boolean(),
  remoteId: z.number(),
  remoteName: z.string()
});

const styledFields = {
  color: KnownColorSchema,
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

const withAreaRefinements = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((data, ctx) => {
    validateAreaAltitude(data as AreaAltitudeFields, ctx);
    validateActiveWindow(data as ActiveWindowFields, ctx);
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
    validateActiveWindow(data, ctx);
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
    validateActiveWindow(data, ctx);
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
  .superRefine(validateActiveWindow)
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
