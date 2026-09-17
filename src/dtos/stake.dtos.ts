import { z, registry } from 'config/openapi.config';
import {
  CircleDtoSchema,
  CorridorDtoSchema,
  PolygonDtoSchema,
  PolylineDtoSchema,
  SectorDtoSchema,
} from 'dtos/shapes.dtos';
import { LandingZoneDtoSchema, WptDtoSchema } from 'dtos/points.dtos';
import { RouteDtoSchema } from 'dtos/route.dtos';

export const StakeEntitiesDtoSchema = z
  .object({
    stakeWpts: z.array(WptDtoSchema),
    stakeLandingZones: z.array(LandingZoneDtoSchema),
    stakeCircles: z.array(CircleDtoSchema),
    stakeCorridors: z.array(CorridorDtoSchema),
    stakePolygons: z.array(PolygonDtoSchema),
    stakePolylines: z.array(PolylineDtoSchema),
    stakeSectors: z.array(SectorDtoSchema),
    stakeRoute: z.array(RouteDtoSchema),
  })
  .openapi('StakeEntitiesDto');

export type StakeEntitiesDto = z.infer<typeof StakeEntitiesDtoSchema>;

export const StakeDtoSchema = z
  .object({
    patrickId: z.string().uuid(),
    patrickName: z.string(),
    versionNumber: z.number().int(),
    stakeEntities: StakeEntitiesDtoSchema,
  })
  .openapi('StakeDto');

export type StakeDto = z.infer<typeof StakeDtoSchema>;

export const CreateStakeDtoSchema = z
  .object({
    patrickName: z.string(),
    stakeEntities: StakeEntitiesDtoSchema,
  })
  .openapi('CreateStakeDto');

export type CreateStakeDto = z.infer<typeof CreateStakeDtoSchema>;

export const PatrickParamsSchema = z
  .object({
    patrickName: z.string().min(1),
  })
  .openapi('PatrickParams');

export type PatrickParams = z.infer<typeof PatrickParamsSchema>;

registry.register('StakeDto', StakeDtoSchema);
registry.register('CreateStakeDto', CreateStakeDtoSchema);
