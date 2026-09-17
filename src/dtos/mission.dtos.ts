import { z, registry } from 'config/openapi.config';
import { MISSION_LAYERS } from 'constants/entity.constants';
import { TimeInfoDtoSchema } from 'dtos/entity.dtos';
import {
  CircleDtoSchema,
  CorridorDtoSchema,
  PolygonDtoSchema,
  PolylineDtoSchema,
  SectorDtoSchema
} from 'dtos/shapes.dtos';
import {
  EliahuDtoSchema,
  LamineDtoSchema,
  LandingZoneDtoSchema,
  MessiDtoSchema,
  IslandDtoSchema,
  SymbolPointDtoSchema,
  WptDtoSchema
} from 'dtos/points.dtos';
import { RouteDtoSchema } from 'dtos/route.dtos';

export { TimeInfoDtoSchema };

export const SonicPropertiesDtoSchema = z
  .object({
    id: z.number(),
    kind: z.string(),
    area: z.string(),
    essence: z.string(),
    createBy: z.string(),
    pm: z.string(),
    sonicUpdate: z.coerce.date(),
    universeUpdate: z.coerce.date(),
    platform: z.string(),
    patrick: z.string(),
    category: z.string(),
    attachedMission: z.number().int()
  })
  .partial()
  .openapi('SonicMissionProperties');

export const CreateMissionDtoSchema = z
  .object({
    name: z.string().min(1),
    comment: z.string().optional(),
    createdBy: z.string().optional(),
    missionType: z.string().optional(),
    password: z.string().optional(),
    sonicProperties: SonicPropertiesDtoSchema.optional(),
    attachedMissionId: z.number().int().optional()
  })
  .openapi('CreateMissionDto');

export type CreateMissionDto = z.infer<typeof CreateMissionDtoSchema>;

export const UpdateMissionDtoSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    comment: z.string().optional(),
    createdBy: z.string().optional(),
    missionType: z.string().optional(),
    password: z.string().optional(),
    attachedMissionId: z.number().int().optional()
  })
  .openapi('UpdateMissionDto');

export type UpdateMissionDto = z.infer<typeof UpdateMissionDtoSchema>;

export const BasicMissionDtoSchema = z
  .object({
    id: z.string().uuid(),
    timeInfo: TimeInfoDtoSchema,
    name: z.string(),
    comment: z.string().optional(),
    createdBy: z.string().optional(),
    missionType: z.string().optional(),
    password: z.string().optional(),
    attachedMissionId: z.number().int().optional()
  })
  .openapi('BasicMissionDto');

export type BasicMissionDto = z.infer<typeof BasicMissionDtoSchema>;

export const MissionEntitiesDtoSchema = z
  .object({
    sectors: z.array(SectorDtoSchema).default([]),
    circles: z.array(CircleDtoSchema).default([]),
    polygons: z.array(PolygonDtoSchema).default([]),
    corridors: z.array(CorridorDtoSchema).default([]),
    polylines: z.array(PolylineDtoSchema).default([]),
    wpts: z.array(WptDtoSchema).default([]),
    landingZones: z.array(LandingZoneDtoSchema).default([]),
    eliahus: z.array(EliahuDtoSchema).default([]),
    universeIslands: z.array(IslandDtoSchema).default([]),
    lamines: z.array(LamineDtoSchema).default([]),
    symbolPoints: z.array(SymbolPointDtoSchema).default([]),
    routes: z.array(RouteDtoSchema).default([]),
    messis: z.array(MessiDtoSchema).default([])
  })
  .openapi('MissionEntitiesDto');

export type MissionEntitiesDto = z.infer<typeof MissionEntitiesDtoSchema>;

export const CorruptedDocumentDtoSchema = z
  .object({
    jsonString: z.string(),
    messageError: z.string()
  })
  .openapi('CorruptedDocumentDto');

export type CorruptedDocumentDto = z.infer<typeof CorruptedDocumentDtoSchema>;

export const MissionDtoSchema = BasicMissionDtoSchema.extend({
  entities: MissionEntitiesDtoSchema,
  corruptedEntities: z.array(CorruptedDocumentDtoSchema).default([]),
  sonicProperties: SonicPropertiesDtoSchema.optional(),
  versionNumber: z.number().int()
}).openapi('MissionDto');

export type MissionDto = z.infer<typeof MissionDtoSchema>;

export const MissionDtoListSchema = z.array(MissionDtoSchema).openapi('MissionDtoList');

export type MissionDtoList = z.infer<typeof MissionDtoListSchema>;

export const MergeMissionDtoSchema = z
  .object({
    currentId: z.string().uuid(),
    mergedId: z.string().uuid(),
    missionLayers: z.array(z.string())
  })
  .openapi('MergeMissionDto');

export type MergeMissionDto = z.infer<typeof MergeMissionDtoSchema>;

export const MISSION_LAYER_VALUES = Object.values(MISSION_LAYERS);

export const MissionIdParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .openapi('MissionIdParams');

export type MissionIdParams = z.infer<typeof MissionIdParamsSchema>;

export const SearchNameParamsSchema = z
  .object({
    name: z.string().min(1)
  })
  .openapi('SearchNameParams');

export type SearchNameParams = z.infer<typeof SearchNameParamsSchema>;

export const MissionIdListDtoSchema = z.array(z.string().uuid()).openapi('MissionIdListDto');

export type MissionIdListDto = z.infer<typeof MissionIdListDtoSchema>;

export const ErrorDetailsDtoSchema = z
  .object({
    statusCode: z.number().int(),
    message: z.string()
  })
  .openapi('ErrorDetails');

export type ErrorDetailsDto = z.infer<typeof ErrorDetailsDtoSchema>;

registry.register('CreateMissionDto', CreateMissionDtoSchema);
registry.register('UpdateMissionDto', UpdateMissionDtoSchema);
registry.register('BasicMissionDto', BasicMissionDtoSchema);
registry.register('MissionDto', MissionDtoSchema);
registry.register('MergeMissionDto', MergeMissionDtoSchema);
registry.register('ErrorDetails', ErrorDetailsDtoSchema);
