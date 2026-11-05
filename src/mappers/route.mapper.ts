import { ENTITY_TYPES, ROUTE_PROVIDERS, ROUTE_VIEW_MODES } from 'constants/entity.constants';
import { createTimeInfo } from 'models/time.models';
import { Route, RouteLeg } from 'models/route.models';
import { Wpt } from 'models/entities.models';
import {
  CreateOrUpdateRouteDto,
  LegHighPointDto,
  RetrieveNavigationRouteDto,
  RetrieveRouteDto,
  RouteDto,
  RouteLegDto,
  RouteNavLegDto
} from 'dtos/route.dtos';
import { fromGeoDto, fromTimeInfoDto, toGeneralInfo, toGeoDto } from 'mappers/common.entity.mapper';
import { wptAsCreateRouteWptDto } from 'mappers/entities.mapper';
import { FEET_IN_METER } from 'utils/geo.util';

const highPointFromDto = (dto: LegHighPointDto): RouteLeg['highestPoint'] => {
  return { nz: fromGeoDto(dto.nz), altitudeFeet: dto.altitude.feet };
};

const highPointToDto = (highestPoint: RouteLeg['highestPoint']): LegHighPointDto =>
  highestPoint && {
    nz: toGeoDto(highestPoint.nz),
    altitude: { feet: highestPoint.altitudeFeet, meters: highestPoint.altitudeFeet / FEET_IN_METER }
  };

export const routeLegFromDto = (dto: RouteLegDto): RouteLeg => ({
  startWpt: dto.startWpt,
  endWpt: dto.endWpt,
  distanceNm: dto.distanceNm,
  angle: dto.angle,
  legTimeMs: dto.legTimeMs,
  isManualLegTime: dto.isManualLegTime,
  tas: dto.tas,
  zmmTime: dto.zmmTime ?? undefined,
  highestPoint: highPointFromDto(dto.highestPoint),
  safetyAltitudeFeet: dto.safetyAltitude,
  legOffsets: {
    dogHouseOffset: dto.legOffsets.dogHouseOffset,
    timeTillZmmOffset: dto.legOffsets.timeTillZmmOffset
  },
  turnPoint: dto.turnPoint ? fromGeoDto(dto.turnPoint) : undefined
});

export const routeLegToDto = (leg: RouteLeg): RouteLegDto => ({
  startWpt: leg.startWpt,
  endWpt: leg.endWpt,
  distanceNm: leg.distanceNm,
  angle: leg.angle,
  legTimeMs: leg.legTimeMs,
  isManualLegTime: leg.isManualLegTime,
  tas: leg.tas,
  zmmTime: leg.zmmTime ?? undefined,
  highestPoint: highPointToDto(leg.highestPoint),
  safetyAltitude: leg.safetyAltitudeFeet,
  legOffsets: leg.legOffsets ?? undefined,
  turnPoint: leg.turnPoint ? toGeoDto(leg.turnPoint) : undefined
});

export const createOrUpdateRouteFromDto = (dto: CreateOrUpdateRouteDto): Route => ({
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
  wptsIds: dto.wpts.map(wpt => wpt.id),
  legs: dto.legs.map(routeLegFromDto),
  defaultTas: dto.defaultTas,
  isActive: dto.isActive,
  routeSource: dto.routeSource,
  viewMode: dto.viewMode,
  zmmWptId: dto.zmmWptId ?? undefined,
  remoteId: dto.remoteId ?? 0,
  remoteName: dto.remoteName ?? ''
});

export const applyRouteUpdate = (
  currentRoute: Route,
  incomingRoute: CreateOrUpdateRouteDto,
  now: Date = new Date()
): Route => ({
  ...currentRoute,
  timeInfo: { ...currentRoute.timeInfo, lastUpdateTime: now },
  name: incomingRoute.name,
  remark: incomingRoute.remark,
  isVisible: incomingRoute.isVisible,
  lineStyle: incomingRoute.lineStyle,
  category: incomingRoute.category,
  color: incomingRoute.color,
  wptsIds: incomingRoute.wpts.map(wpt => wpt.id),
  remoteName: incomingRoute.remoteName ?? currentRoute.remoteName,
  remoteId: incomingRoute.remoteId ?? currentRoute.remoteId,
  legs: incomingRoute.legs.map(routeLegFromDto),
  defaultTas: incomingRoute.defaultTas,
  zmmWptId: incomingRoute.zmmWptId ?? undefined,
  parentId: incomingRoute.parentId
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
  remoteId: route.remoteId ?? undefined,
  remoteName: route.remoteName,
  zmmWptId: route.zmmWptId
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
  routeSource: ROUTE_PROVIDERS.HAIR,
  viewMode: ROUTE_VIEW_MODES.REGULAR,
  zmmWptId: dto.zmmWptId ?? undefined,
  remoteId: dto.remoteId,
  remoteName: dto.remoteName ?? undefined
});

export const routeToRetrieveDto = (route: Route, routeWpts: readonly Wpt[]): RetrieveRouteDto => ({
  general: toGeneralInfo(route),
  entityType: route.entityType,
  source: route.source,
  isVisible: route.isVisible,
  lineStyle: route.lineStyle,
  color: route.color,
  category: route.category,
  wptsCoords: routeWpts.map(wpt => toGeoDto(wpt.position)),
  remoteId: route.remoteId ?? undefined,
  remoteName: route.remoteName
});

export const routeToRetrieveNavigationDto = (
  route: Route,
  routeWpts: readonly Wpt[]
): RetrieveNavigationRouteDto => ({
  general: toGeneralInfo(route),
  legs: route.legs.map((leg, index): RouteNavLegDto => {
    const wpt = routeWpts[index];
    return {
      endWpt: leg.endWpt,
      endWptPosition: wpt ? toGeoDto(wpt.position) : undefined,
      distanceNm: leg.distanceNm,
      angle: leg.angle,
      legTimeMs: leg.legTimeMs,
      zmmTime: leg.zmmTime ?? undefined,
      safetyAltitude: leg.safetyAltitudeFeet
    };
  })
});

export const routeAsCreateOrUpdateDto = (
  route: Route,
  wpts: readonly Wpt[]
): CreateOrUpdateRouteDto => ({
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
  zmmWptId: route.zmmWptId
});
