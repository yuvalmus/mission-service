import { ENTITY_TYPES } from '@constants/entity.constants';
import { createTimeInfo } from '@models/time.models';
import { Route, RouteLeg } from '@models/route.models';
import { Wpt } from '@models/points.models';
import {
  CreateOrUpdateRouteDto,
  LegHighPointDto,
  RetrieveNavigationRouteDto,
  RetrieveRouteDto,
  RouteDto,
  RouteLegDto,
  RouteNavLegDto,
} from '@dtos/route.dtos';
import { fromGeoDto, fromTimeInfoDto, toGeneralInfo, toGeoDto } from '@mappers/entity.mapper';
import { wptAsCreateRouteWptDto } from '@mappers/points.mapper';
import { FEET_IN_METER } from '@utils/geo.util';

const highPointFromDto = (dto: LegHighPointDto | null | undefined): RouteLeg['highestPoint'] =>
  dto ? { nz: fromGeoDto(dto.nz), altitudeFeet: dto.altitude.feet } : null;

const highPointToDto = (highestPoint: RouteLeg['highestPoint']): LegHighPointDto | null =>
  highestPoint && {
    nz: toGeoDto(highestPoint.nz),
    altitude: { feet: highestPoint.altitudeFeet, meters: highestPoint.altitudeFeet / FEET_IN_METER },
  };

export const routeLegFromDto = (dto: RouteLegDto): RouteLeg => ({
  startWpt: dto.startWpt,
  endWpt: dto.endWpt,
  distanceNm: dto.distanceNm,
  angle: dto.angle,
  legTimeMs: dto.legTimeMs,
  isManualLegTime: dto.isManualLegTime,
  tas: dto.tas,
  zmmTime: dto.zmmTime ? new Date(dto.zmmTime) : null,
  highestPoint: highPointFromDto(dto.highestPoint),
  safetyAltitudeFeet: dto.safetyAltitude,
  legOffsets: dto.legOffsets
    ? {
        dogHouseOffset: dto.legOffsets.dogHouseOffset ?? null,
        timeTillZmmOffset: dto.legOffsets.timeTillZmmOffset ?? null,
      }
    : null,
  turnPoint: dto.turnPoint ? fromGeoDto(dto.turnPoint) : null,
});

export const routeLegToDto = (leg: RouteLeg): RouteLegDto => ({
  startWpt: leg.startWpt,
  endWpt: leg.endWpt,
  distanceNm: leg.distanceNm,
  angle: leg.angle,
  legTimeMs: leg.legTimeMs,
  isManualLegTime: leg.isManualLegTime,
  tas: leg.tas,
  zmmTime: leg.zmmTime?.toISOString() ?? null,
  highestPoint: highPointToDto(leg.highestPoint),
  safetyAltitude: leg.safetyAltitudeFeet,
  legOffsets: leg.legOffsets,
  turnPoint: leg.turnPoint ? toGeoDto(leg.turnPoint) : null,
});

export const routeFromCreateOrUpdateDto = (dto: CreateOrUpdateRouteDto): Route => ({
  id: dto.id,
  parentId: dto.parentId,
  entityType: ENTITY_TYPES.ROUTE,
  name: dto.name,
  remark: dto.remark,
  source: dto.source,
  category: dto.category,
  timeInfo: createTimeInfo(),
  isVisible: dto.isVisible,
  color: dto.color,
  lineStyle: dto.lineStyle,
  wptsIds: dto.wpts.map((wpt) => wpt.id),
  legs: dto.legs.map(routeLegFromDto),
  defaultTas: dto.defaultTas,
  isActive: dto.isActive,
  routeSource: dto.routeSource,
  viewMode: dto.viewMode,
  zmmWptId: dto.zmmWptId ?? null,
  remoteId: dto.remoteId ?? 0,
  remoteName: dto.remoteName ?? '',
});

export const applyRouteUpdate = (route: Route, dto: CreateOrUpdateRouteDto, now: Date = new Date()): Route => ({
  ...route,
  timeInfo: { ...route.timeInfo, lastUpdateTime: now },
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  lineStyle: dto.lineStyle,
  category: dto.category,
  color: dto.color,
  wptsIds: dto.wpts.map((wpt) => wpt.id),
  remoteName: dto.remoteName ?? route.remoteName,
  remoteId: dto.remoteId ?? route.remoteId,
  legs: dto.legs.map(routeLegFromDto),
  defaultTas: dto.defaultTas,
  zmmWptId: dto.zmmWptId ?? null,
  parentId: dto.parentId,
});

export const routeToDto = (route: Route): RouteDto => ({
  general: toGeneralInfo(route),
  entityType: route.entityType,
  source: route.source,
  isVisible: route.isVisible,
  lineStyle: route.lineStyle,
  color: route.color,
  category: route.category,
  wptsIds: route.wptsIds,
  legs: route.legs.map(routeLegToDto),
  defaultTas: route.defaultTas,
  remoteId: route.remoteId,
  remoteName: route.remoteName,
  zmmWptId: route.zmmWptId,
});

export const routeFromDto = (dto: RouteDto, parentId: string): Route => ({
  id: dto.general.id,
  parentId,
  entityType: ENTITY_TYPES.ROUTE,
  name: dto.general.name,
  remark: dto.general.remark,
  source: dto.source as never,
  category: dto.category as never,
  timeInfo: fromTimeInfoDto(dto.general.timeInfo),
  isVisible: dto.isVisible,
  color: dto.color,
  lineStyle: dto.lineStyle as never,
  wptsIds: dto.wptsIds,
  legs: dto.legs.map(routeLegFromDto),
  defaultTas: dto.defaultTas,
  isActive: false,
  routeSource: 'SAMSON',
  viewMode: 'Regular',
  zmmWptId: dto.zmmWptId ?? null,
  remoteId: dto.remoteId,
  remoteName: dto.remoteName,
});

export const routeToRetrieveDto = (route: Route, routeWpts: readonly Wpt[]): RetrieveRouteDto => ({
  general: toGeneralInfo(route),
  entityType: route.entityType,
  source: route.source,
  isVisible: route.isVisible,
  lineStyle: route.lineStyle,
  color: route.color,
  category: route.category,
  wptsCoords: routeWpts.map((wpt) => toGeoDto(wpt.position)),
  remoteId: route.remoteId,
  remoteName: route.remoteName,
});

export const routeToRetrieveNavigationDto = (route: Route, routeWpts: readonly Wpt[]): RetrieveNavigationRouteDto => ({
  general: toGeneralInfo(route),
  legs: route.legs.map((leg, index): RouteNavLegDto => {
    const wpt = routeWpts[index];
    return {
      endWpt: leg.endWpt,
      endWptPosition: wpt ? toGeoDto(wpt.position) : null,
      distanceNm: leg.distanceNm,
      angle: leg.angle,
      legTimeMs: leg.legTimeMs,
      zmmTime: leg.zmmTime?.toISOString() ?? null,
      safetyAltitude: leg.safetyAltitudeFeet,
    };
  }),
});

export const routeAsCreateOrUpdateDto = (route: Route, wpts: readonly Wpt[]): CreateOrUpdateRouteDto => ({
  id: route.id,
  parentId: route.parentId,
  name: route.name,
  remark: route.remark,
  isActive: route.isActive,
  source: route.source,
  category: route.category,
  routeSource: route.routeSource,
  viewMode: route.viewMode,
  color: route.color,
  lineStyle: route.lineStyle,
  legs: route.legs.map(routeLegToDto),
  isVisible: route.isVisible,
  wpts: wpts.map(wptAsCreateRouteWptDto),
  defaultTas: route.defaultTas,
  remoteId: route.remoteId,
  remoteName: route.remoteName,
  zmmWptId: route.zmmWptId,
});
