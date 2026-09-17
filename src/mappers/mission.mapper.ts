import { randomUUID } from 'node:crypto';
import { ENTITY_TYPES } from '@constants/entity.constants';
import { Mission, MissionBase, MISSION_CONSTANTS } from '@models/mission.models';
import { AnyEntity } from '@models/entity-union.models';
import { TimeInfo, createTimeInfo } from '@models/time.models';
import {
  BasicMissionDto,
  CreateMissionDto,
  MissionDto,
  MissionEntitiesDto,
  UpdateMissionDto,
} from '@dtos/mission.dtos';
import { getEntityDefinition } from '@mappers/entity.registry';
import { routeFromDto, routeToDto } from '@mappers/route.mapper';
import { fromTimeInfoDto } from '@mappers/entity.mapper';
import { Route } from '@models/route.models';

const toTimeInfoDto = (timeInfo: TimeInfo | null): BasicMissionDto['timeInfo'] =>
  timeInfo && {
    dateCreated: timeInfo.dateCreated.toISOString(),
    lastUpdateTime: timeInfo.lastUpdateTime.toISOString(),
  };

export const toBasicMissionDto = (mission: MissionBase): BasicMissionDto => ({
  id: mission.id,
  timeInfo: toTimeInfoDto(mission.timeInfo),
  name: mission.name,
  comment: mission.comment,
  createdBy: mission.createdBy,
  missionType: mission.missionType,
  password: mission.password,
  attachedMissionId: mission.attachedMissionId,
});

export const toMissionEntitiesDto = (entities: readonly AnyEntity[]): MissionEntitiesDto => {
  const dto: MissionEntitiesDto = {
    sectors: [],
    circles: [],
    polygons: [],
    corridors: [],
    polylines: [],
    wpts: [],
    landingZones: [],
    eliahus: [],
    globusRecons: [],
    lamines: [],
    symbolPoints: [],
    routes: [],
    messis: [],
  };

  entities.forEach((entity) => {
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
      case ENTITY_TYPES.RECON:
        dto.globusRecons.push(getEntityDefinition(entity.entityType).toDto(entity) as never);
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

export const toMissionDto = (mission: Mission, entities: readonly AnyEntity[] = []): MissionDto => ({
  ...toBasicMissionDto(mission),
  entities: toMissionEntitiesDto(entities),
  corruptedEntities: [],
  versionNumber: mission.versionNumber,
  sonicProperties: mission.sonicProperties,
});

export const createDtoToMission = (dto: CreateMissionDto): Mission => ({
  id: randomUUID(),
  timeInfo: createTimeInfo(),
  name: dto.name,
  comment: dto.comment ?? '',
  createdBy: dto.createdBy ?? '',
  missionType: dto.missionType ?? '',
  password: dto.password ?? '',
  attachedMissionId: dto.attachedMissionId ?? null,
  versionNumber: MISSION_CONSTANTS.BASE_VERSION_NUMBER,
  sonicProperties: dto.sonicProperties ?? null,
});

export interface MissionWithEntities {
  mission: Mission;
  entities: AnyEntity[];
}

export const missionFromDto = (dto: MissionDto): MissionWithEntities => {
  const mission: Mission = {
    id: dto.id,
    timeInfo: dto.timeInfo ? fromTimeInfoDto(dto.timeInfo) : null,
    name: dto.name,
    comment: dto.comment,
    createdBy: dto.createdBy,
    missionType: dto.missionType,
    password: dto.password,
    attachedMissionId: dto.attachedMissionId,
    versionNumber: dto.versionNumber,
    sonicProperties: dto.sonicProperties,
  };

  const fromDtoOf = (entityType: (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES]) =>
    getEntityDefinition(entityType).fromDto;

  const entities: AnyEntity[] = [
    ...dto.entities.circles.map((entity) => fromDtoOf(ENTITY_TYPES.CIRCLE)(entity, dto.id)),
    ...dto.entities.sectors.map((entity) => fromDtoOf(ENTITY_TYPES.SECTOR)(entity, dto.id)),
    ...dto.entities.polygons.map((entity) => fromDtoOf(ENTITY_TYPES.POLYGON)(entity, dto.id)),
    ...dto.entities.corridors.map((entity) => fromDtoOf(ENTITY_TYPES.CORRIDOR)(entity, dto.id)),
    ...dto.entities.polylines.map((entity) => fromDtoOf(ENTITY_TYPES.POLYLINE)(entity, dto.id)),
    ...dto.entities.wpts.map((entity) => fromDtoOf(ENTITY_TYPES.NAVIGATION_WAY_POINT)(entity, dto.id)),
    ...dto.entities.landingZones.map((entity) => fromDtoOf(ENTITY_TYPES.LANDING_ZONE)(entity, dto.id)),
    ...dto.entities.eliahus.map((entity) => fromDtoOf(ENTITY_TYPES.ELIAHU)(entity, dto.id)),
    ...dto.entities.globusRecons.map((entity) => fromDtoOf(ENTITY_TYPES.RECON)(entity, dto.id)),
    ...dto.entities.lamines.map((entity) => fromDtoOf(ENTITY_TYPES.LAMINE)(entity, dto.id)),
    ...dto.entities.symbolPoints.map((entity) => fromDtoOf(ENTITY_TYPES.SYMBOL_POINT)(entity, dto.id)),
    ...dto.entities.messis.map((entity) => fromDtoOf(ENTITY_TYPES.MESSI)(entity, dto.id)),
    ...dto.entities.routes.map((entity): Route => routeFromDto(entity, dto.id)),
  ];

  return { mission, entities };
};

export const applyUpdateDto = (mission: Mission, dto: UpdateMissionDto, now: Date = new Date()): Mission => ({
  ...mission,
  name: dto.name,
  comment: dto.comment ?? null,
  createdBy: dto.createdBy ?? null,
  missionType: dto.missionType ?? null,
  password: dto.password ?? null,
  attachedMissionId: dto.attachedMissionId ?? null,
  timeInfo: mission.timeInfo
    ? { ...mission.timeInfo, lastUpdateTime: now }
    : createTimeInfo(now),
  versionNumber: mission.versionNumber + 1,
});

export const isMissionUnchanged = (mission: Mission, dto: UpdateMissionDto): boolean =>
  mission.name === dto.name &&
  mission.comment === (dto.comment ?? null) &&
  mission.createdBy === (dto.createdBy ?? null) &&
  mission.missionType === (dto.missionType ?? null) &&
  mission.password === (dto.password ?? null) &&
  mission.attachedMissionId === (dto.attachedMissionId ?? null);
