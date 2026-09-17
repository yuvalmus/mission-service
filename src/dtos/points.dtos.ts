import { z } from 'config/openapi.config';
import {
  ELIAHU_CATEGORIES,
  ELIAHU_STATUSES,
  ENTITY_SOURCES,
  LAMINE_CATEGORIES,
  LANDING_ZONE_CATEGORIES,
  LANDING_ZONE_STATUSES,
  LZ_OPERATING_TYPES,
  LZ_REUT_TYPES,
  NAME_MAX_LENGTHS,
  POINT_CATEGORIES,
  RADIUS_LIMITS,
  ISLAND_CATEGORIES,
  WPT_CATEGORIES
} from 'constants/entity.constants';
import { KnownColorSchema } from 'models/entity.models';
import { GeneralEntityInfoSchema, GeoCoordinateDtoSchema } from 'dtos/entity.dtos';
import { entityNameSchema, radiusNmSchema } from 'dtos/shapes.dtos';

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
  remoteId: z.number().optional(),
  remoteName: z.string()
});

const readCommonFields = {
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
    id: z.string().uuid(),
    ...createCommonFields(NAME_MAX_LENGTHS.WPT),
    category: z.enum(WPT_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema
  })
  .openapi('CreateRouteWptDto');

export type CreateRouteWptDto = z.infer<typeof CreateRouteWptDtoSchema>;

export const UpdateWptDtoSchema = z
  .object({
    ...updateCommonFields(NAME_MAX_LENGTHS.WPT),
    category: z.enum(WPT_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema
  })
  .openapi('UpdateWptDto');

export type UpdateWptDto = z.infer<typeof UpdateWptDtoSchema>;

export const WptDtoSchema = z
  .object({
    ...readCommonFields,
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
    ...updateCommonFields(),
    category: z.enum(POINT_CATEGORIES),
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema
  })
  .openapi('UpdateSymbolPointDto');

export type UpdateSymbolPointDto = z.infer<typeof UpdateSymbolPointDtoSchema>;

export const SymbolPointDtoSchema = z
  .object({
    ...readCommonFields,
    altitudeFeet: z.number(),
    position: GeoCoordinateDtoSchema,
    ...readRemoteFields
  })
  .openapi('SymbolPointDto');

export type SymbolPointDto = z.infer<typeof SymbolPointDtoSchema>;

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
    ...updateCommonFields(NAME_MAX_LENGTHS.LANDING_ZONE),
    ...landingZoneFields,
    position: GeoCoordinateDtoSchema,
    secondaryPosition: GeoCoordinateDtoSchema
  })
  .openapi('UpdateLandingZoneDto');

export type UpdateLandingZoneDto = z.infer<typeof UpdateLandingZoneDtoSchema>;

export const LandingZoneDtoSchema = z
  .object({
    ...readCommonFields,
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
    color: KnownColorSchema,
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
    ...updateCommonFields(NAME_MAX_LENGTHS.ELIAHU),
    category: z.enum(ELIAHU_CATEGORIES),
    color: KnownColorSchema,
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
    ...readCommonFields,
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
    id: z.string().uuid(),
    parentId: z.string().uuid(),
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
    ...readCommonFields,
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
    color: KnownColorSchema,
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
    ...updateCommonFields(NAME_MAX_LENGTHS.LAMINE),
    category: z.enum(LAMINE_CATEGORIES),
    altitudeFeet: z.number(),
    color: KnownColorSchema,
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
    ...readCommonFields,
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
    ...updateCommonFields(NAME_MAX_LENGTHS.MESSI),
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
    ...readCommonFields,
    altitudeFeet: z.number(),
    isFilled: z.boolean(),
    position: GeoCoordinateDtoSchema,
    isOperational: z.boolean(),
    showSightPresentation: z.boolean(),
    ...readRemoteFields
  })
  .openapi('MessiDto');

export type MessiDto = z.infer<typeof MessiDtoSchema>;
