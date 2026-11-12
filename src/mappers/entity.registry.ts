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
  createFromDto(dto: unknown): Entity;
  applyUpdate(currentEntity: Entity, incomingEntity: unknown): Entity;
  toDto(entity: Entity): unknown;
  fromDto(dto: unknown, parentId: string): Entity;
}

const define = <T extends Omit<EntityDefinition, 'entityTypeSegment'>>(definition: T) => ({
  ...definition,
  entityTypeSegment: definition.entityType
});

export const ENTITY_DEFINITIONS = {
  [ENTITY_TYPES.CIRCLE]: define({
    entityType: ENTITY_TYPES.CIRCLE,
    createSchema: CreateCircleDtoSchema,
    updateSchema: UpdateCircleDtoSchema,
    dtoSchema: CircleDtoSchema,
    createFromDto: entities.createCircleFromDto,
    applyUpdate: entities.applyCircleUpdate,
    toDto: entities.circleToDto,
    fromDto: entities.circleFromDto
  }),
  [ENTITY_TYPES.SECTOR]: define({
    entityType: ENTITY_TYPES.SECTOR,
    createSchema: CreateSectorDtoSchema,
    updateSchema: UpdateSectorDtoSchema,
    dtoSchema: SectorDtoSchema,
    createFromDto: entities.createSectorFromDto,
    applyUpdate: entities.applySectorUpdate,
    toDto: entities.sectorToDto,
    fromDto: entities.sectorFromDto
  }),
  [ENTITY_TYPES.POLYGON]: define({
    entityType: ENTITY_TYPES.POLYGON,
    createSchema: CreatePolygonDtoSchema,
    updateSchema: UpdatePolygonDtoSchema,
    dtoSchema: PolygonDtoSchema,
    createFromDto: entities.createPolygonFromDto,
    applyUpdate: entities.applyPolygonUpdate,
    toDto: entities.polygonToDto,
    fromDto: entities.polygonFromDto
  }),
  [ENTITY_TYPES.CORRIDOR]: define({
    entityType: ENTITY_TYPES.CORRIDOR,
    createSchema: CreateCorridorDtoSchema,
    updateSchema: UpdateCorridorDtoSchema,
    dtoSchema: CorridorDtoSchema,
    createFromDto: entities.createCorridorFromDto,
    applyUpdate: entities.applyCorridorUpdate,
    toDto: entities.corridorToDto,
    fromDto: entities.corridorFromDto
  }),
  [ENTITY_TYPES.POLYLINE]: define({
    entityType: ENTITY_TYPES.POLYLINE,
    createSchema: CreatePolylineDtoSchema,
    updateSchema: UpdatePolylineDtoSchema,
    dtoSchema: PolylineDtoSchema,
    createFromDto: entities.createPolylineFromDto,
    applyUpdate: entities.applyPolylineUpdate,
    toDto: entities.polylineToDto,
    fromDto: entities.polylineFromDto
  }),
  [ENTITY_TYPES.NAVIGATION_WAY_POINT]: define({
    entityType: ENTITY_TYPES.NAVIGATION_WAY_POINT,
    createSchema: CreateWptDtoSchema,
    updateSchema: UpdateWptDtoSchema,
    dtoSchema: WptDtoSchema,
    createFromDto: entities.createWptFromDto,
    applyUpdate: entities.applyWptUpdate,
    toDto: entities.wptToDto,
    fromDto: entities.wptFromDto
  }),
  [ENTITY_TYPES.SYMBOL_POINT]: define({
    entityType: ENTITY_TYPES.SYMBOL_POINT,
    createSchema: CreateSymbolPointDtoSchema,
    updateSchema: UpdateSymbolPointDtoSchema,
    dtoSchema: SymbolPointDtoSchema,
    createFromDto: entities.createSymbolPointFromDto,
    applyUpdate: entities.applySymbolPointUpdate,
    toDto: entities.symbolPointToDto,
    fromDto: entities.symbolPointFromDto
  }),
  [ENTITY_TYPES.LANDING_ZONE]: define({
    entityType: ENTITY_TYPES.LANDING_ZONE,
    createSchema: CreateLandingZoneDtoSchema,
    updateSchema: UpdateLandingZoneDtoSchema,
    dtoSchema: LandingZoneDtoSchema,
    createFromDto: entities.createLandingZoneFromDto,
    applyUpdate: entities.applyLandingZoneUpdate,
    toDto: entities.landingZoneToDto,
    fromDto: entities.landingZoneFromDto
  }),
  [ENTITY_TYPES.ELIAHU]: define({
    entityType: ENTITY_TYPES.ELIAHU,
    createSchema: CreateEliahuDtoSchema,
    updateSchema: UpdateEliahuDtoSchema,
    dtoSchema: EliahuDtoSchema,
    createFromDto: entities.createEliahuFromDto,
    applyUpdate: entities.applyEliahuUpdate,
    toDto: entities.eliahuToDto,
    fromDto: entities.eliahuFromDto
  }),
  [ENTITY_TYPES.ISLAND]: define({
    entityType: ENTITY_TYPES.ISLAND,
    createSchema: CreateIslandDtoSchema,
    updateSchema: UpdateIslandDtoSchema,
    dtoSchema: IslandDtoSchema,
    createFromDto: entities.createIslandFromDto,
    applyUpdate: entities.applyIslandUpdate,
    toDto: entities.islandToDto,
    fromDto: entities.islandFromDto
  }),
  [ENTITY_TYPES.LAMINE]: define({
    entityType: ENTITY_TYPES.LAMINE,
    createSchema: CreateLamineDtoSchema,
    updateSchema: UpdateLamineDtoSchema,
    dtoSchema: LamineDtoSchema,
    createFromDto: entities.createLamineFromDto,
    applyUpdate: entities.applyLamineUpdate,
    toDto: entities.lamineToDto,
    fromDto: entities.lamineFromDto
  }),
  [ENTITY_TYPES.MESSI]: define({
    entityType: ENTITY_TYPES.MESSI,
    createSchema: CreateMessiDtoSchema,
    updateSchema: UpdateMessiDtoSchema,
    dtoSchema: MessiDtoSchema,
    createFromDto: entities.createMessiFromDto,
    applyUpdate: entities.applyMessiUpdate,
    toDto: entities.messiToDto,
    fromDto: entities.messiFromDto
  })
} satisfies Record<Exclude<EntityType, typeof ENTITY_TYPES.ROUTE>, EntityDefinition>;

export type EntityDefinitions = typeof ENTITY_DEFINITIONS;
export type EntityDefinitionType = keyof EntityDefinitions;

export function getEntityDefinition<K extends EntityDefinitionType>(
  entityType: K
): EntityDefinitions[K];
export function getEntityDefinition(entityType: EntityType): EntityDefinition;
export function getEntityDefinition(entityType: EntityType): EntityDefinition {
  if (entityType === ENTITY_TYPES.ROUTE) {
    throw new Error(`No entity definition registered for type ${entityType}`);
  }
  return ENTITY_DEFINITIONS[entityType];
}

export const entityToDto = (entity: Entity): unknown => {
  if (entity.entityType === ENTITY_TYPES.ROUTE) {
    throw new Error('Route entities are mapped through route.mapper');
  }
  const definition: EntityDefinition = getEntityDefinition(entity.entityType);
  return definition.toDto(entity);
};
