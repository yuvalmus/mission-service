import { ZodTypeAny } from 'zod';
import { ENTITY_TYPES, EntityType } from 'constants/entity.constants';
import { Entity } from 'models/entity.union.models';
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
  CreateEliahuDtoSchema,
  CreateLamineDtoSchema,
  CreateLandingZoneDtoSchema,
  CreateMessiDtoSchema,
  CreateIslandDtoSchema,
  CreateSymbolPointDtoSchema,
  CreateWptDtoSchema,
  EliahuDtoSchema,
  LamineDtoSchema,
  LandingZoneDtoSchema,
  MessiDtoSchema,
  IslandDtoSchema,
  SymbolPointDtoSchema,
  UpdateEliahuDtoSchema,
  UpdateLamineDtoSchema,
  UpdateLandingZoneDtoSchema,
  UpdateMessiDtoSchema,
  UpdateIslandDtoSchema,
  UpdateSymbolPointDtoSchema,
  UpdateWptDtoSchema,
  WptDtoSchema
} from 'dtos/entities.dtos';
import * as entities from 'mappers/entities.mapper';

export interface EntityDefinition {
  entityType: EntityType;
  entityTypeSegment: string;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  dtoSchema: ZodTypeAny;
  createFromDto: (dto: unknown) => Entity;
  applyUpdate: (currentEntity: Entity, incomingEntity: unknown) => Entity;
  toDto: (entity: Entity) => unknown;
  fromDto: (dto: unknown, parentId: string) => Entity;
}

const define = (definition: Omit<EntityDefinition, 'entityTypeSegment'>): EntityDefinition => ({
  ...definition,
  entityTypeSegment: definition.entityType
});

export const ENTITY_DEFINITIONS: Record<
  Exclude<EntityType, typeof ENTITY_TYPES.ROUTE>,
  EntityDefinition
> = {
  [ENTITY_TYPES.CIRCLE]: define({
    entityType: ENTITY_TYPES.CIRCLE,
    createSchema: CreateCircleDtoSchema,
    updateSchema: UpdateCircleDtoSchema,
    dtoSchema: CircleDtoSchema,
    createFromDto: entities.createCircleFromDto as never,
    applyUpdate: entities.applyCircleUpdate as never,
    toDto: entities.circleToDto as never,
    fromDto: entities.circleFromDto as never
  }),
  [ENTITY_TYPES.SECTOR]: define({
    entityType: ENTITY_TYPES.SECTOR,
    createSchema: CreateSectorDtoSchema,
    updateSchema: UpdateSectorDtoSchema,
    dtoSchema: SectorDtoSchema,
    createFromDto: entities.createSectorFromDto as never,
    applyUpdate: entities.applySectorUpdate as never,
    toDto: entities.sectorToDto as never,
    fromDto: entities.sectorFromDto as never
  }),
  [ENTITY_TYPES.POLYGON]: define({
    entityType: ENTITY_TYPES.POLYGON,
    createSchema: CreatePolygonDtoSchema,
    updateSchema: UpdatePolygonDtoSchema,
    dtoSchema: PolygonDtoSchema,
    createFromDto: entities.createPolygonFromDto as never,
    applyUpdate: entities.applyPolygonUpdate as never,
    toDto: entities.polygonToDto as never,
    fromDto: entities.polygonFromDto as never
  }),
  [ENTITY_TYPES.CORRIDOR]: define({
    entityType: ENTITY_TYPES.CORRIDOR,
    createSchema: CreateCorridorDtoSchema,
    updateSchema: UpdateCorridorDtoSchema,
    dtoSchema: CorridorDtoSchema,
    createFromDto: entities.createCorridorFromDto as never,
    applyUpdate: entities.applyCorridorUpdate as never,
    toDto: entities.corridorToDto as never,
    fromDto: entities.corridorFromDto as never
  }),
  [ENTITY_TYPES.POLYLINE]: define({
    entityType: ENTITY_TYPES.POLYLINE,
    createSchema: CreatePolylineDtoSchema,
    updateSchema: UpdatePolylineDtoSchema,
    dtoSchema: PolylineDtoSchema,
    createFromDto: entities.createPolylineFromDto as never,
    applyUpdate: entities.applyPolylineUpdate as never,
    toDto: entities.polylineToDto as never,
    fromDto: entities.polylineFromDto as never
  }),
  [ENTITY_TYPES.NAVIGATION_WAY_POINT]: define({
    entityType: ENTITY_TYPES.NAVIGATION_WAY_POINT,
    createSchema: CreateWptDtoSchema,
    updateSchema: UpdateWptDtoSchema,
    dtoSchema: WptDtoSchema,
    createFromDto: entities.createWptFromDto as never,
    applyUpdate: entities.applyWptUpdate as never,
    toDto: entities.wptToDto as never,
    fromDto: entities.wptFromDto as never
  }),
  [ENTITY_TYPES.SYMBOL_POINT]: define({
    entityType: ENTITY_TYPES.SYMBOL_POINT,
    createSchema: CreateSymbolPointDtoSchema,
    updateSchema: UpdateSymbolPointDtoSchema,
    dtoSchema: SymbolPointDtoSchema,
    createFromDto: entities.createSymbolPointFromDto as never,
    applyUpdate: entities.applySymbolPointUpdate as never,
    toDto: entities.symbolPointToDto as never,
    fromDto: entities.symbolPointFromDto as never
  }),
  [ENTITY_TYPES.LANDING_ZONE]: define({
    entityType: ENTITY_TYPES.LANDING_ZONE,
    createSchema: CreateLandingZoneDtoSchema,
    updateSchema: UpdateLandingZoneDtoSchema,
    dtoSchema: LandingZoneDtoSchema,
    createFromDto: entities.createLandingZoneFromDto as never,
    applyUpdate: entities.applyLandingZoneUpdate as never,
    toDto: entities.landingZoneToDto as never,
    fromDto: entities.landingZoneFromDto as never
  }),
  [ENTITY_TYPES.ELIAHU]: define({
    entityType: ENTITY_TYPES.ELIAHU,
    createSchema: CreateEliahuDtoSchema,
    updateSchema: UpdateEliahuDtoSchema,
    dtoSchema: EliahuDtoSchema,
    createFromDto: entities.createEliahuFromDto as never,
    applyUpdate: entities.applyEliahuUpdate as never,
    toDto: entities.eliahuToDto as never,
    fromDto: entities.eliahuFromDto as never
  }),
  [ENTITY_TYPES.ISLAND]: define({
    entityType: ENTITY_TYPES.ISLAND,
    createSchema: CreateIslandDtoSchema,
    updateSchema: UpdateIslandDtoSchema,
    dtoSchema: IslandDtoSchema,
    createFromDto: entities.createIslandFromDto as never,
    applyUpdate: entities.applyIslandUpdate as never,
    toDto: entities.islandToDto as never,
    fromDto: entities.islandFromDto as never
  }),
  [ENTITY_TYPES.LAMINE]: define({
    entityType: ENTITY_TYPES.LAMINE,
    createSchema: CreateLamineDtoSchema,
    updateSchema: UpdateLamineDtoSchema,
    dtoSchema: LamineDtoSchema,
    createFromDto: entities.createLamineFromDto as never,
    applyUpdate: entities.applyLamineUpdate as never,
    toDto: entities.lamineToDto as never,
    fromDto: entities.lamineFromDto as never
  }),
  [ENTITY_TYPES.MESSI]: define({
    entityType: ENTITY_TYPES.MESSI,
    createSchema: CreateMessiDtoSchema,
    updateSchema: UpdateMessiDtoSchema,
    dtoSchema: MessiDtoSchema,
    createFromDto: entities.createMessiFromDto as never,
    applyUpdate: entities.applyMessiUpdate as never,
    toDto: entities.messiToDto as never,
    fromDto: entities.messiFromDto as never
  })
};

export const getEntityDefinition = (entityType: EntityType): EntityDefinition => {
  if (entityType === ENTITY_TYPES.ROUTE) {
    throw new Error(`No entity definition registered for type ${entityType}`);
  }
  return ENTITY_DEFINITIONS[entityType];
};

export const entityToDto = (entity: Entity): unknown => {
  if (entity.entityType === ENTITY_TYPES.ROUTE) {
    throw new Error('Route entities are mapped through route.mapper');
  }
  return getEntityDefinition(entity.entityType).toDto(entity);
};
