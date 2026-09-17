import { z, registry } from 'config/openapi.config';
import { DATUMS } from 'models/geo.models';

export const AltitudeSchema = z
  .object({
    meters: z.number(),
    feet: z.number()
  })
  .openapi('Altitude');

export type Altitude = z.infer<typeof TimeInfoDtoSchema>;

export const TimeInfoDtoSchema = z
  .object({
    dateCreated: z.string().datetime({ offset: true }),
    lastUpdateTime: z.string().datetime({ offset: true })
  })
  .openapi('TimeInfoDto');

export type TimeInfoDto = z.infer<typeof TimeInfoDtoSchema>;

export const GeoCoordinateDtoSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    datum: z
      .union([z.literal(0), z.literal(1), z.enum([DATUMS.ED50, DATUMS.WGS84])])
      .transform(value => (value === 0 ? DATUMS.ED50 : value === 1 ? DATUMS.WGS84 : value))
      .default(DATUMS.WGS84)
  })
  .openapi('GeoCoordinateDto');

export type GeoCoordinateDto = z.infer<typeof GeoCoordinateDtoSchema>;

export const ActiveTimeDtoSchema = z
  .object({
    beginTime: z.string().datetime({ offset: true }).optional(),
    endTime: z.string().datetime({ offset: true }).optional()
  })
  .openapi('ActiveTimeDto');

export type ActiveTimeDto = z.infer<typeof ActiveTimeDtoSchema>;

export const GeneralEntityInfoSchema = z
  .object({
    id: z.string().uuid(),
    timeInfo: TimeInfoDtoSchema,
    name: z.string(),
    remark: z.string()
  })
  .openapi('GeneralEntityInfo');

export type GeneralEntityInfoDto = z.infer<typeof GeneralEntityInfoSchema>;

export const BasicEntityGeneralInfoSchema = z
  .object({
    id: z.string().uuid(),
    timeInfo: TimeInfoDtoSchema.optional(),
    name: z.string(),
    remark: z.string()
  })
  .openapi('BasicEntityGeneralInfo');

export type BasicEntityGeneralInfoDto = z.infer<typeof BasicEntityGeneralInfoSchema>;

export const BasicEntityDtoSchema = z
  .object({
    general: BasicEntityGeneralInfoSchema,
    entityType: z.string(),
    source: z.string(),
    isVisible: z.boolean()
  })
  .openapi('BasicEntityDto');

export type BasicEntityDto = z.infer<typeof BasicEntityDtoSchema>;

export const UpdateBasicEntityDtoSchema = z
  .object({
    entity: BasicEntityDtoSchema.optional(),
    isVisible: z.boolean().optional()
  })
  .openapi('UpdateBasicEntityDto');

export type UpdateBasicEntityDto = z.infer<typeof UpdateBasicEntityDtoSchema>;

export const UpdateBasicEntitiesDtoSchema = z
  .object({
    entities: z.array(BasicEntityDtoSchema).optional(),
    isVisible: z.boolean().optional()
  })
  .openapi('UpdateBasicEntitiesDto');

export type UpdateBasicEntitiesDto = z.infer<typeof UpdateBasicEntitiesDtoSchema>;

export const EntityIdParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .openapi('EntityIdParams');

export type EntityIdParams = z.infer<typeof EntityIdParamsSchema>;

export const DeleteEntityParamsSchema = z
  .object({
    mission: z.string().uuid(),
    id: z.string().uuid()
  })
  .openapi('DeleteEntityParams');

export type DeleteEntityParams = z.infer<typeof DeleteEntityParamsSchema>;

export const NamesParamsSchema = z
  .object({
    missionId: z.string().uuid(),
    amount: z.coerce.number().int().positive().optional().default(1)
  })
  .openapi('NamesParams');

export type NamesParams = z.infer<typeof NamesParamsSchema>;

registry.register('BasicEntityDto', BasicEntityDtoSchema);
registry.register('UpdateBasicEntityDto', UpdateBasicEntityDtoSchema);
registry.register('UpdateBasicEntitiesDto', UpdateBasicEntitiesDtoSchema);
