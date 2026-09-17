import { ZodTypeAny } from 'zod';
import { ENTITY_SEGMENTS, ENTITY_TYPES, EntityType } from '@constants/entity.constants';
import { AnyEntity } from '@models/entity-union.models';
import {
  CircleDtoSchema,
  CorridorDtoSchema,
  CreateCircleDtoSchema,
  CreateCorridorDtoSchema,
  CreatePolygonDtoSchema,
  CreatePolylineDtoSchema,
  CreateSectorDtoSchema,
  PolygonDtoSchema,
  PolylineDtoSchema,
  SectorDtoSchema,
  UpdateCircleDtoSchema,
  UpdateCorridorDtoSchema,
  UpdatePolygonDtoSchema,
  UpdatePolylineDtoSchema,
  UpdateSectorDtoSchema,
} from '@dtos/shapes.dtos';
import {
  CreateEliahuDtoSchema,
  CreateLamineDtoSchema,
  CreateLandingZoneDtoSchema,
  CreateMessiDtoSchema,
  CreateReconDtoSchema,
  CreateSymbolPointDtoSchema,
  CreateWptDtoSchema,
  EliahuDtoSchema,
  LamineDtoSchema,
  LandingZoneDtoSchema,
  MessiDtoSchema,
  ReconDtoSchema,
  SymbolPointDtoSchema,
  UpdateEliahuDtoSchema,
  UpdateLamineDtoSchema,
  UpdateLandingZoneDtoSchema,
  UpdateMessiDtoSchema,
  UpdateReconDtoSchema,
  UpdateSymbolPointDtoSchema,
  UpdateWptDtoSchema,
  WptDtoSchema,
} from '@dtos/points.dtos';
import * as shapes from '@mappers/shapes.mapper';
import * as points from '@mappers/points.mapper';

export interface EntityDefinition {
  entityType: EntityType;
  segment: string;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  dtoSchema: ZodTypeAny;
  fromCreateDto: (dto: unknown) => AnyEntity;
  applyUpdate: (entity: AnyEntity, dto: unknown) => AnyEntity;
  toDto: (entity: AnyEntity) => unknown;
  fromDto: (dto: unknown, parentId: string) => AnyEntity;
}

const define = (definition: Omit<EntityDefinition, 'segment'>): EntityDefinition => ({
  ...definition,
  segment: ENTITY_SEGMENTS[definition.entityType],
});

export const ENTITY_DEFINITIONS: readonly EntityDefinition[] = [
  define({
    entityType: ENTITY_TYPES.CIRCLE,
    createSchema: CreateCircleDtoSchema,
    updateSchema: UpdateCircleDtoSchema,
    dtoSchema: CircleDtoSchema,
    fromCreateDto: shapes.circleFromCreateDto as never,
    applyUpdate: shapes.applyCircleUpdate as never,
    toDto: shapes.circleToDto as never,
    fromDto: shapes.circleFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.SECTOR,
    createSchema: CreateSectorDtoSchema,
    updateSchema: UpdateSectorDtoSchema,
    dtoSchema: SectorDtoSchema,
    fromCreateDto: shapes.sectorFromCreateDto as never,
    applyUpdate: shapes.applySectorUpdate as never,
    toDto: shapes.sectorToDto as never,
    fromDto: shapes.sectorFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.POLYGON,
    createSchema: CreatePolygonDtoSchema,
    updateSchema: UpdatePolygonDtoSchema,
    dtoSchema: PolygonDtoSchema,
    fromCreateDto: shapes.polygonFromCreateDto as never,
    applyUpdate: shapes.applyPolygonUpdate as never,
    toDto: shapes.polygonToDto as never,
    fromDto: shapes.polygonFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.CORRIDOR,
    createSchema: CreateCorridorDtoSchema,
    updateSchema: UpdateCorridorDtoSchema,
    dtoSchema: CorridorDtoSchema,
    fromCreateDto: shapes.corridorFromCreateDto as never,
    applyUpdate: shapes.applyCorridorUpdate as never,
    toDto: shapes.corridorToDto as never,
    fromDto: shapes.corridorFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.POLYLINE,
    createSchema: CreatePolylineDtoSchema,
    updateSchema: UpdatePolylineDtoSchema,
    dtoSchema: PolylineDtoSchema,
    fromCreateDto: shapes.polylineFromCreateDto as never,
    applyUpdate: shapes.applyPolylineUpdate as never,
    toDto: shapes.polylineToDto as never,
    fromDto: shapes.polylineFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.NAVIGATION_WAY_POINT,
    createSchema: CreateWptDtoSchema,
    updateSchema: UpdateWptDtoSchema,
    dtoSchema: WptDtoSchema,
    fromCreateDto: points.wptFromCreateDto as never,
    applyUpdate: points.applyWptUpdate as never,
    toDto: points.wptToDto as never,
    fromDto: points.wptFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.SYMBOL_POINT,
    createSchema: CreateSymbolPointDtoSchema,
    updateSchema: UpdateSymbolPointDtoSchema,
    dtoSchema: SymbolPointDtoSchema,
    fromCreateDto: points.symbolPointFromCreateDto as never,
    applyUpdate: points.applySymbolPointUpdate as never,
    toDto: points.symbolPointToDto as never,
    fromDto: points.symbolPointFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.LANDING_ZONE,
    createSchema: CreateLandingZoneDtoSchema,
    updateSchema: UpdateLandingZoneDtoSchema,
    dtoSchema: LandingZoneDtoSchema,
    fromCreateDto: points.landingZoneFromCreateDto as never,
    applyUpdate: points.applyLandingZoneUpdate as never,
    toDto: points.landingZoneToDto as never,
    fromDto: points.landingZoneFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.ELIAHU,
    createSchema: CreateEliahuDtoSchema,
    updateSchema: UpdateEliahuDtoSchema,
    dtoSchema: EliahuDtoSchema,
    fromCreateDto: points.eliahuFromCreateDto as never,
    applyUpdate: points.applyEliahuUpdate as never,
    toDto: points.eliahuToDto as never,
    fromDto: points.eliahuFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.RECON,
    createSchema: CreateReconDtoSchema,
    updateSchema: UpdateReconDtoSchema,
    dtoSchema: ReconDtoSchema,
    fromCreateDto: points.reconFromCreateDto as never,
    applyUpdate: points.applyReconUpdate as never,
    toDto: points.reconToDto as never,
    fromDto: points.reconFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.LAMINE,
    createSchema: CreateLamineDtoSchema,
    updateSchema: UpdateLamineDtoSchema,
    dtoSchema: LamineDtoSchema,
    fromCreateDto: points.lamineFromCreateDto as never,
    applyUpdate: points.applyLamineUpdate as never,
    toDto: points.lamineToDto as never,
    fromDto: points.lamineFromDto as never,
  }),
  define({
    entityType: ENTITY_TYPES.MESSI,
    createSchema: CreateMessiDtoSchema,
    updateSchema: UpdateMessiDtoSchema,
    dtoSchema: MessiDtoSchema,
    fromCreateDto: points.messiFromCreateDto as never,
    applyUpdate: points.applyMessiUpdate as never,
    toDto: points.messiToDto as never,
    fromDto: points.messiFromDto as never,
  }),
];

const definitionsByType = new Map(ENTITY_DEFINITIONS.map((definition) => [definition.entityType, definition]));

export const getEntityDefinition = (entityType: EntityType): EntityDefinition => {
  const definition = definitionsByType.get(entityType);
  if (!definition) {
    throw new Error(`No entity definition registered for type ${entityType}`);
  }
  return definition;
};

export const entityToDto = (entity: AnyEntity): unknown => {
  if (entity.entityType === ENTITY_TYPES.ROUTE) {
    throw new Error('Route entities are mapped through route.mapper');
  }
  return getEntityDefinition(entity.entityType).toDto(entity);
};
