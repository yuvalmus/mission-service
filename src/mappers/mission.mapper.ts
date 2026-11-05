import { randomUUID } from 'node:crypto';
import { ENTITY_TYPES } from 'constants/entity.constants';
import { Mission, MissionBase, MISSION_CONSTANTS } from 'models/mission.models';
import { Entity } from 'models/entity.union.models';
import { createTimeInfo } from 'models/time.models';
import {
  BasicMissionDto,
  CreateMissionDto,
  MissionDto,
  MissionEntitiesDto,
  UpdateMissionDto
} from 'dtos/mission.dtos';
import { getEntityDefinition } from 'mappers/entity.registry';
import { routeFromDto, routeToDto } from 'mappers/route.mapper';
import { fromTimeInfoDto, toTimeInfoDto } from 'mappers/common.entity.mapper';
import { Route } from 'models/route.models';

export const toBasicMissionDto = (mission: MissionBase): BasicMissionDto => ({
  id: mission.id,
  timeInfo: toTimeInfoDto(mission.timeInfo),
  name: mission.name,
  comment: mission.comment,
  createdBy: mission.createdBy,
  missionType: mission.missionType,
  password: mission.password,
  attachedMissionId: mission.attachedMissionId
});

export const toMissionEntitiesDto = (entities: readonly Entity[]): MissionEntitiesDto => {
  const dto: MissionEntitiesDto = {
    sectors: [],
    circles: [],
    polygons: [],
    corridors: [],
    polylines: [],
    wpts: [],
    landingZones: [],
    eliahus: [],
    universeIslands: [],
    lamines: [],
    symbolPoints: [],
    routes: [],
    messis: []
  };

  entities.forEach(entity => {
    switch (entity.entityType) {
      case ENTITY_TYPES.SECTOR:
        dto.sectors.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.CIRCLE:
        dto.circles.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.POLYGON:
        dto.polygons.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.CORRIDOR:
        dto.corridors.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.POLYLINE:
        dto.polylines.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.NAVIGATION_WAY_POINT:
        dto.wpts.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.LANDING_ZONE:
        dto.landingZones.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.ELIAHU:
        dto.eliahus.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.ISLAND:
        dto.universeIslands.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.LAMINE:
        dto.lamines.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.SYMBOL_POINT:
        dto.symbolPoints.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.MESSI:
        dto.messis.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
        break;
      case ENTITY_TYPES.ROUTE:
        dto.routes.push(routeToDto(entity));
        break;
    }
  });

  return dto;
};

export const toMissionDto = (mission: Mission, entities: readonly Entity[] = []): MissionDto => ({
  ...toBasicMissionDto(mission),
  entities: toMissionEntitiesDto(entities),
  corruptedEntities: [],
  versionNumber: mission.versionNumber,
  sonicProperties: mission.sonicProperties
});

export const createDtoToMission = (dto: CreateMissionDto): Mission => ({
  id: randomUUID(),
  timeInfo: createTimeInfo(),
  name: dto.name,
  comment: dto.comment ?? '',
  createdBy: dto.createdBy ?? '',
  missionType: dto.missionType ?? '',
  password: dto.password ?? '',
  attachedMissionId: dto.attachedMissionId ?? undefined,
  versionNumber: MISSION_CONSTANTS.BASE_VERSION_NUMBER,
  sonicProperties: dto.sonicProperties ?? undefined
});

export interface MissionWithEntities {
  mission: Mission;
  entities: Entity[];
}

export const missionFromDto = (dto: MissionDto): MissionWithEntities => {
  const mission: Mission = {
    id: dto.id,
    timeInfo: fromTimeInfoDto(dto.timeInfo),
    name: dto.name,
    comment: dto.comment,
    createdBy: dto.createdBy,
    missionType: dto.missionType,
    password: dto.password,
    attachedMissionId: dto.attachedMissionId,
    versionNumber: dto.versionNumber,
    sonicProperties: dto.sonicProperties
  };

  const fromDtoOf = (entityType: (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES]) =>
    getEntityDefinition(entityType).fromDto;

  const entities: Entity[] = [
    ...dto.entities.circles.map(entity => fromDtoOf(ENTITY_TYPES.CIRCLE)(entity, dto.id)),
    ...dto.entities.sectors.map(entity => fromDtoOf(ENTITY_TYPES.SECTOR)(entity, dto.id)),
    ...dto.entities.polygons.map(entity => fromDtoOf(ENTITY_TYPES.POLYGON)(entity, dto.id)),
    ...dto.entities.corridors.map(entity => fromDtoOf(ENTITY_TYPES.CORRIDOR)(entity, dto.id)),
    ...dto.entities.polylines.map(entity => fromDtoOf(ENTITY_TYPES.POLYLINE)(entity, dto.id)),
    ...dto.entities.wpts.map(entity =>
      fromDtoOf(ENTITY_TYPES.NAVIGATION_WAY_POINT)(entity, dto.id)
    ),
    ...dto.entities.landingZones.map(entity =>
      fromDtoOf(ENTITY_TYPES.LANDING_ZONE)(entity, dto.id)
    ),
    ...dto.entities.eliahus.map(entity => fromDtoOf(ENTITY_TYPES.ELIAHU)(entity, dto.id)),
    ...dto.entities.universeIslands.map(entity => fromDtoOf(ENTITY_TYPES.ISLAND)(entity, dto.id)),
    ...dto.entities.lamines.map(entity => fromDtoOf(ENTITY_TYPES.LAMINE)(entity, dto.id)),
    ...dto.entities.symbolPoints.map(entity =>
      fromDtoOf(ENTITY_TYPES.SYMBOL_POINT)(entity, dto.id)
    ),
    ...dto.entities.messis.map(entity =>
      fromDtoOf(ENTITY_TYPES.MESSI)(entity, dto.id)
    ),
    ...dto.entities.routes.map((entity): Route => routeFromDto(entity, dto.id))
  ];

  return { mission, entities };
};

export const applyUpdateDto = (
  currentMission: Mission,
  incomingMissionInfo: UpdateMissionDto,
  now: Date = new Date()
): Mission => ({
  ...currentMission,
  name: incomingMissionInfo.name,
  comment: incomingMissionInfo.comment,
  createdBy: incomingMissionInfo.createdBy,
  missionType: incomingMissionInfo.missionType,
  password: incomingMissionInfo.password ?? undefined,
  attachedMissionId: incomingMissionInfo.attachedMissionId ?? undefined,
  timeInfo: currentMission.timeInfo
    ? { ...currentMission.timeInfo, lastUpdateTime: now }
    : createTimeInfo(now),
  versionNumber: currentMission.versionNumber + 1
});

export const isMissionUnchanged = (mission: Mission, dto: UpdateMissionDto): boolean =>
  mission.name === dto.name &&
  mission.comment === (dto.comment ?? undefined) &&
  mission.createdBy === (dto.createdBy ?? undefined) &&
  mission.missionType === (dto.missionType ?? undefined) &&
  mission.password === (dto.password ?? undefined) &&
  mission.attachedMissionId === (dto.attachedMissionId ?? undefined);
