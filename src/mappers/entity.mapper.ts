import { randomUUID } from 'node:crypto';
import { ENTITY_TYPES } from '@constants/entity.constants';
import { AnyEntity } from '@models/entity-union.models';
import { TimeInfo, ActiveTime, createTimeInfo } from '@models/time.models';
import { GeoCoordinate } from '@models/geo.models';
import {
  ActiveTimeDto,
  BasicEntityDto,
  GeneralEntityInfoDto,
  GeoCoordinateDto,
  TimeInfoDto,
} from '@dtos/entity.dtos';

export const toTimeInfoDto = (timeInfo: TimeInfo | null): TimeInfoDto | null =>
  timeInfo && {
    dateCreated: timeInfo.dateCreated.toISOString(),
    lastUpdateTime: timeInfo.lastUpdateTime.toISOString(),
  };

export const fromTimeInfoDto = (dto: TimeInfoDto | null | undefined): TimeInfo =>
  dto
    ? { dateCreated: new Date(dto.dateCreated), lastUpdateTime: new Date(dto.lastUpdateTime) }
    : createTimeInfo();

export const toGeoDto = (position: GeoCoordinate): GeoCoordinateDto => ({
  latitude: position.latitude,
  longitude: position.longitude,
  datum: position.datum,
});

export const fromGeoDto = (dto: GeoCoordinateDto): GeoCoordinate => ({
  latitude: dto.latitude,
  longitude: dto.longitude,
  datum: dto.datum,
});

export const toActiveTimeDto = (activeTime: ActiveTime | null): ActiveTimeDto | null =>
  activeTime && {
    beginTime: activeTime.beginTime?.toISOString() ?? null,
    endTime: activeTime.endTime?.toISOString() ?? null,
  };

export const activeTimeFromWindow = (
  beginTime: string | null | undefined,
  endTime: string | null | undefined,
): ActiveTime => ({
  beginTime: beginTime ? new Date(beginTime) : null,
  endTime: endTime ? new Date(endTime) : null,
});

export const activeTimeFromDto = (dto: ActiveTimeDto | null | undefined): ActiveTime | null =>
  dto ? activeTimeFromWindow(dto.beginTime, dto.endTime) : null;

export const toGeneralInfo = (entity: AnyEntity): GeneralEntityInfoDto => ({
  id: entity.id,
  timeInfo: toTimeInfoDto(entity.timeInfo),
  name: entity.name,
  remark: entity.remark,
});

export const toBasicEntityDto = (entity: AnyEntity): BasicEntityDto => ({
  general: toGeneralInfo(entity),
  entityType: entity.entityType,
  source: entity.source,
  isVisible: entity.isVisible,
});

export const cloneEntityToMission = (entity: AnyEntity, missionId: string): AnyEntity => {
  const cloned = { ...entity, id: randomUUID(), parentId: missionId };
  if (cloned.entityType === ENTITY_TYPES.NAVIGATION_WAY_POINT) {
    return { ...cloned, connectedRoutes: [] };
  }
  return cloned;
};

export const withUpdatedTimestamp = <T extends AnyEntity>(entity: T, now: Date = new Date()): T => ({
  ...entity,
  timeInfo: { ...entity.timeInfo, lastUpdateTime: now },
});
