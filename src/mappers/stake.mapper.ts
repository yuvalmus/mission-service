import { ENTITY_TYPES } from '@constants/entity.constants';
import { AnyEntity } from '@models/entity-union.models';
import { Stake } from '@models/stake.models';
import { CreateStakeDto, StakeDto, StakeEntitiesDto } from '@dtos/stake.dtos';
import { getEntityDefinition } from '@mappers/entity.registry';
import { routeFromDto, routeToDto } from '@mappers/route.mapper';

export const toStakeEntitiesDto = (entities: readonly AnyEntity[]): StakeEntitiesDto => {
  const dto: StakeEntitiesDto = {
    stakeWpts: [],
    stakeLandingZones: [],
    stakeCircles: [],
    stakeCorridors: [],
    stakePolygons: [],
    stakePolylines: [],
    stakeSectors: [],
    stakeRoute: [],
  };

  entities.forEach((entity) => {
    switch (entity.entityType) {
      case ENTITY_TYPES.NAVIGATION_WAY_POINT:
        dto.stakeWpts.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.LANDING_ZONE:
        dto.stakeLandingZones.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.CIRCLE:
        dto.stakeCircles.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.CORRIDOR:
        dto.stakeCorridors.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.POLYGON:
        dto.stakePolygons.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.POLYLINE:
        dto.stakePolylines.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.SECTOR:
        dto.stakeSectors.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.ROUTE:
        dto.stakeRoute.push(routeToDto(entity));
        break;
    }
  });

  return dto;
};

export const toStakeDto = (stake: Stake, entities: readonly AnyEntity[]): StakeDto => ({
  squadronId: stake.id,
  squadronName: stake.squadronName,
  versionNumber: stake.versionNumber,
  stakeEntities: toStakeEntitiesDto(entities),
});

export const stakeEntitiesFromCreateDto = (dto: CreateStakeDto, stakeId: string): AnyEntity[] => {
  const fromDtoOf = (entityType: (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES]) =>
    getEntityDefinition(entityType).fromDto;

  return [
    ...dto.stakeEntities.stakeWpts.map((entity) => fromDtoOf(ENTITY_TYPES.NAVIGATION_WAY_POINT)(entity, stakeId)),
    ...dto.stakeEntities.stakeLandingZones.map((entity) => fromDtoOf(ENTITY_TYPES.LANDING_ZONE)(entity, stakeId)),
    ...dto.stakeEntities.stakeCircles.map((entity) => fromDtoOf(ENTITY_TYPES.CIRCLE)(entity, stakeId)),
    ...dto.stakeEntities.stakeCorridors.map((entity) => fromDtoOf(ENTITY_TYPES.CORRIDOR)(entity, stakeId)),
    ...dto.stakeEntities.stakePolygons.map((entity) => fromDtoOf(ENTITY_TYPES.POLYGON)(entity, stakeId)),
    ...dto.stakeEntities.stakePolylines.map((entity) => fromDtoOf(ENTITY_TYPES.POLYLINE)(entity, stakeId)),
    ...dto.stakeEntities.stakeSectors.map((entity) => fromDtoOf(ENTITY_TYPES.SECTOR)(entity, stakeId)),
    ...dto.stakeEntities.stakeRoute.map((entity) => routeFromDto(entity, stakeId)),
  ];
};
