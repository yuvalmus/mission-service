import { randomUUID } from 'node:crypto';
import { ENTITY_SOURCES, ENTITY_TYPES } from 'constants/entity.constants';
import { createTimeInfo } from 'models/time.models';
import {
  Circle,
  Corridor,
  Polygon,
  Polyline,
  Sector,
  Wpt,
  SymbolPoint,
  LandingZone,
  Eliahu,
  Lamine,
  Messi,
  Island
} from 'models/entities.models';
import {
  CircleDto,
  CorridorDto,
  CreateCircleDto,
  CreateCorridorDto,
  CreatePolygonDto,
  CreatePolylineDto,
  CreateSectorDto,
  PolygonDto,
  PolylineDto,
  SectorDto,
  UpdateCircleDto,
  UpdateCorridorDto,
  UpdatePolygonDto,
  UpdatePolylineDto,
  UpdateSectorDto,
  WptDto,
  SymbolPointDto,
  LandingZoneDto,
  EliahuDto,
  LamineDto,
  MessiDto,
  IslandDto,
  CreateWptDto,
  CreateSymbolPointDto,
  CreateLandingZoneDto,
  CreateEliahuDto,
  CreateIslandDto,
  CreateLamineDto,
  CreateMessiDto,
  CreateRouteWptDto,
  UpdateWptDto,
  UpdateSymbolPointDto,
  UpdateLandingZoneDto,
  UpdateEliahuDto,
  UpdateIslandDto,
  UpdateLamineDto,
  UpdateMessiDto
} from 'dtos/entities.dtos';
import {
  activeTimeFromDto,
  activeTimeFromWindow,
  fromGeoDto,
  fromTimeInfoDto,
  toActiveTimeDto,
  toGeneralInfo,
  toGeoDto
} from 'mappers/common.entity.mapper';
import { TimeInfoDto } from 'dtos/commonEntity.dtos';

const createBaseFields = (dto: {
  parentId: string;
  source: string;
  name: string;
  remark: string;
  isVisible: boolean;
  remoteId?: number;
  remoteName?: string;
}) => ({
  id: randomUUID(),
  parentId: dto.parentId,
  name: dto.name,
  remark: dto.remark,
  source: dto.source as never,
  timeInfo: createTimeInfo(),
  isVisible: dto.isVisible,
  remoteId: dto.remoteId ?? 0,
  remoteName: dto.remoteName ?? ''
});

export const createCircleFromDto = (dto: CreateCircleDto): Circle => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.CIRCLE,
  category: dto.category,
  color: dto.color,
  lineStyle: dto.lineStyle,
  activeTime: activeTimeFromWindow(dto.beginTime, dto.endTime),
  altitudeRange: { minAltitudeFeet: dto.minAltitudeFeet, maxAltitudeFeet: dto.maxAltitudeFeet },
  isFilled: dto.isFilled,
  radiusNm: dto.radiusNm,
  position: fromGeoDto(dto.position)
});

export const applyCircleUpdate = (
  currentCircle: Circle,
  incomingCircle: UpdateCircleDto,
  now: Date = new Date()
): Circle => ({
  ...currentCircle,
  timeInfo: { ...currentCircle.timeInfo, lastUpdateTime: now },
  category: incomingCircle.category,
  activeTime: activeTimeFromWindow(incomingCircle.beginTime, incomingCircle.endTime),
  altitudeRange: {
    minAltitudeFeet: incomingCircle.minAltitudeFeet,
    maxAltitudeFeet: incomingCircle.maxAltitudeFeet
  },
  name: incomingCircle.name,
  remark: incomingCircle.remark,
  isVisible: incomingCircle.isVisible,
  lineStyle: incomingCircle.lineStyle,
  color: incomingCircle.color,
  isFilled: incomingCircle.isFilled,
  radiusNm: incomingCircle.radiusNm,
  position: fromGeoDto(incomingCircle.position),
  remoteId: incomingCircle.remoteId,
  remoteName: incomingCircle.remoteName
});

export const circleToDto = (circle: Circle): CircleDto => ({
  general: toGeneralInfo(circle),
  entityType: circle.entityType,
  source: circle.source,
  category: circle.category,
  activeTime: toActiveTimeDto(circle.activeTime) ?? undefined,
  minAltitudeFeet: circle.altitudeRange.minAltitudeFeet,
  maxAltitudeFeet: circle.altitudeRange.maxAltitudeFeet,
  isVisible: circle.isVisible,
  lineStyle: circle.lineStyle,
  color: circle.color,
  isFilled: circle.isFilled,
  radiusNm: circle.radiusNm,
  position: toGeoDto(circle.position),
  remoteId: circle.remoteId,
  remoteName: circle.remoteName
});

export const circleFromDto = (dto: CircleDto, parentId: string): Circle => ({
  id: dto.general.id,
  parentId,
  entityType: ENTITY_TYPES.CIRCLE,
  name: dto.general.name,
  remark: dto.general.remark,
  source: dto.source as never,
  category: dto.category as never,
  timeInfo: fromTimeInfoDto(dto.general.timeInfo),
  isVisible: dto.isVisible,
  color: dto.color,
  lineStyle: dto.lineStyle as never,
  activeTime: activeTimeFromDto(dto.activeTime) ?? { beginTime: undefined, endTime: undefined },
  altitudeRange: { minAltitudeFeet: dto.minAltitudeFeet, maxAltitudeFeet: dto.maxAltitudeFeet },
  isFilled: dto.isFilled,
  radiusNm: dto.radiusNm,
  position: fromGeoDto(dto.position),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});

export const createSectorFromDto = (dto: CreateSectorDto): Sector => ({
  ...createCircleFromDto({ ...dto } as unknown as CreateCircleDto),
  entityType: ENTITY_TYPES.SECTOR,
  startAngle: dto.startAngle,
  endAngle: dto.endAngle
});

export const applySectorUpdate = (
  currentSector: Sector,
  incomingSector: UpdateSectorDto,
  now: Date = new Date()
): Sector => ({
  ...currentSector,
  ...applyCircleUpdate(
    currentSector as unknown as Circle,
    { ...incomingSector } as unknown as UpdateCircleDto,
    now
  ),
  entityType: ENTITY_TYPES.SECTOR,
  startAngle: incomingSector.startAngle,
  endAngle: incomingSector.endAngle
});

export const sectorToDto = (sector: Sector): SectorDto => ({
  ...circleToDto(sector as unknown as Circle),
  startAngle: sector.startAngle,
  endAngle: sector.endAngle
});

export const sectorFromDto = (dto: SectorDto, parentId: string): Sector => ({
  ...circleFromDto({ ...dto } as unknown as CircleDto, parentId),
  entityType: ENTITY_TYPES.SECTOR,
  category: dto.category as never,
  startAngle: dto.startAngle,
  endAngle: dto.endAngle
});

export const createPolygonFromDto = (dto: CreatePolygonDto): Polygon => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.POLYGON,
  category: dto.category,
  color: dto.color,
  lineStyle: dto.lineStyle,
  activeTime: activeTimeFromWindow(dto.beginTime, dto.endTime),
  altitudeRange: { minAltitudeFeet: dto.minAltitudeFeet, maxAltitudeFeet: dto.maxAltitudeFeet },
  isFilled: dto.isFilled,
  zone: dto.zone,
  coordinates: dto.coordinates.map(fromGeoDto)
});

export const applyPolygonUpdate = (
  currentPolygon: Polygon,
  incomingPolygon: UpdatePolygonDto,
  now: Date = new Date()
): Polygon => ({
  ...currentPolygon,
  timeInfo: { ...currentPolygon.timeInfo, lastUpdateTime: now },
  category: incomingPolygon.category,
  activeTime: activeTimeFromWindow(incomingPolygon.beginTime, incomingPolygon.endTime),
  altitudeRange: {
    minAltitudeFeet: incomingPolygon.minAltitudeFeet,
    maxAltitudeFeet: incomingPolygon.maxAltitudeFeet
  },
  name: incomingPolygon.name,
  remark: incomingPolygon.remark,
  isVisible: incomingPolygon.isVisible,
  lineStyle: incomingPolygon.lineStyle,
  color: incomingPolygon.color,
  isFilled: incomingPolygon.isFilled,
  zone: incomingPolygon.zone,
  coordinates: incomingPolygon.coordinates.map(fromGeoDto),
  remoteId: incomingPolygon.remoteId,
  remoteName: incomingPolygon.remoteName
});

export const polygonToDto = (polygon: Polygon): PolygonDto => ({
  general: toGeneralInfo(polygon),
  entityType: polygon.entityType,
  source: polygon.source,
  category: polygon.category,
  activeTime: toActiveTimeDto(polygon.activeTime),
  minAltitudeFeet: polygon.altitudeRange.minAltitudeFeet,
  maxAltitudeFeet: polygon.altitudeRange.maxAltitudeFeet,
  isVisible: polygon.isVisible,
  lineStyle: polygon.lineStyle,
  color: polygon.color,
  isFilled: polygon.isFilled,
  zone: polygon.zone,
  coordinates: polygon.coordinates.map(toGeoDto),
  remoteId: polygon.remoteId,
  remoteName: polygon.remoteName
});

export const polygonFromDto = (dto: PolygonDto, parentId: string): Polygon => ({
  id: dto.general.id,
  parentId,
  entityType: ENTITY_TYPES.POLYGON,
  name: dto.general.name,
  remark: dto.general.remark,
  source: dto.source as never,
  category: dto.category as never,
  timeInfo: fromTimeInfoDto(dto.general.timeInfo),
  isVisible: dto.isVisible,
  color: dto.color,
  lineStyle: dto.lineStyle as never,
  activeTime: activeTimeFromDto(dto.activeTime) ?? { beginTime: undefined, endTime: undefined },
  altitudeRange: { minAltitudeFeet: dto.minAltitudeFeet, maxAltitudeFeet: dto.maxAltitudeFeet },
  isFilled: dto.isFilled,
  zone: dto.zone as never,
  coordinates: dto.coordinates.map(fromGeoDto),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});

export const createCorridorFromDto = (dto: CreateCorridorDto): Corridor => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.CORRIDOR,
  category: dto.category,
  color: dto.color,
  lineStyle: dto.lineStyle,
  activeTime: activeTimeFromWindow(dto.beginTime, dto.endTime),
  altitudeRange: { minAltitudeFeet: dto.minAltitudeFeet, maxAltitudeFeet: dto.maxAltitudeFeet },
  isFilled: dto.isFilled,
  radiusNm: dto.radiusNm,
  coordinates: dto.coordinates.map(fromGeoDto)
});

export const applyCorridorUpdate = (
  currentCorridor: Corridor,
  incomingCorridor: UpdateCorridorDto,
  now: Date = new Date()
): Corridor => ({
  ...currentCorridor,
  timeInfo: { ...currentCorridor.timeInfo, lastUpdateTime: now },
  category: incomingCorridor.category,
  activeTime: activeTimeFromWindow(incomingCorridor.beginTime, incomingCorridor.endTime),
  altitudeRange: {
    minAltitudeFeet: incomingCorridor.minAltitudeFeet,
    maxAltitudeFeet: incomingCorridor.maxAltitudeFeet
  },
  name: incomingCorridor.name,
  remark: incomingCorridor.remark,
  isVisible: incomingCorridor.isVisible,
  lineStyle: incomingCorridor.lineStyle,
  color: incomingCorridor.color,
  isFilled: incomingCorridor.isFilled,
  radiusNm: incomingCorridor.radiusNm,
  coordinates: incomingCorridor.coordinates.map(fromGeoDto),
  remoteId: incomingCorridor.remoteId,
  remoteName: incomingCorridor.remoteName
});

export const corridorToDto = (corridor: Corridor): CorridorDto => ({
  general: toGeneralInfo(corridor),
  entityType: corridor.entityType,
  source: corridor.source,
  category: corridor.category,
  activeTime: toActiveTimeDto(corridor.activeTime) ?? undefined,
  minAltitudeFeet: corridor.altitudeRange.minAltitudeFeet,
  maxAltitudeFeet: corridor.altitudeRange.maxAltitudeFeet,
  isVisible: corridor.isVisible,
  lineStyle: corridor.lineStyle,
  color: corridor.color,
  isFilled: corridor.isFilled,
  radiusNm: corridor.radiusNm,
  coordinates: corridor.coordinates.map(toGeoDto),
  remoteId: corridor.remoteId,
  remoteName: corridor.remoteName
});

export const corridorFromDto = (dto: CorridorDto, parentId: string): Corridor => ({
  id: dto.general.id,
  parentId,
  entityType: ENTITY_TYPES.CORRIDOR,
  name: dto.general.name,
  remark: dto.general.remark,
  source: dto.source as never,
  category: dto.category as never,
  timeInfo: fromTimeInfoDto(dto.general.timeInfo),
  isVisible: dto.isVisible,
  color: dto.color,
  lineStyle: dto.lineStyle as never,
  activeTime: activeTimeFromDto(dto.activeTime) ?? { beginTime: undefined, endTime: undefined },
  altitudeRange: { minAltitudeFeet: dto.minAltitudeFeet, maxAltitudeFeet: dto.maxAltitudeFeet },
  isFilled: dto.isFilled,
  radiusNm: dto.radiusNm,
  coordinates: dto.coordinates.map(fromGeoDto),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});

export const createPolylineFromDto = (dto: CreatePolylineDto): Polyline => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.POLYLINE,
  category: dto.category,
  color: dto.color,
  lineStyle: dto.lineStyle,
  activeTime: activeTimeFromWindow(dto.beginTime, dto.endTime),
  coordinates: dto.coordinates.map(fromGeoDto)
});

export const applyPolylineUpdate = (
  currentPolyline: Polyline,
  incomingPolyline: UpdatePolylineDto,
  now: Date = new Date()
): Polyline => ({
  ...currentPolyline,
  timeInfo: { ...currentPolyline.timeInfo, lastUpdateTime: now },
  category: incomingPolyline.category,
  name: incomingPolyline.name,
  remark: incomingPolyline.remark,
  isVisible: incomingPolyline.isVisible,
  lineStyle: incomingPolyline.lineStyle,
  color: incomingPolyline.color,
  coordinates: incomingPolyline.coordinates.map(fromGeoDto),
  remoteId: incomingPolyline.remoteId,
  remoteName: incomingPolyline.remoteName
});

export const polylineToDto = (polyline: Polyline): PolylineDto => ({
  general: toGeneralInfo(polyline),
  entityType: polyline.entityType,
  source: polyline.source,
  category: polyline.category,
  activeTime: toActiveTimeDto(polyline.activeTime) ?? undefined,
  isVisible: polyline.isVisible,
  lineStyle: polyline.lineStyle,
  color: polyline.color,
  coordinates: polyline.coordinates.map(toGeoDto),
  remoteId: polyline.remoteId,
  remoteName: polyline.remoteName
});

export const polylineFromDto = (dto: PolylineDto, parentId: string): Polyline => ({
  id: dto.general.id,
  parentId,
  entityType: ENTITY_TYPES.POLYLINE,
  name: dto.general.name,
  remark: dto.general.remark,
  source: dto.source as never,
  category: dto.category as never,
  timeInfo: fromTimeInfoDto(dto.general.timeInfo),
  isVisible: dto.isVisible,
  color: dto.color,
  lineStyle: dto.lineStyle as never,
  activeTime: activeTimeFromDto(dto.activeTime) ?? { beginTime: undefined, endTime: undefined },
  coordinates: dto.coordinates.map(fromGeoDto),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});

const readBaseFields = (
  dto: {
    general: {
      id: string;
      name: string;
      remark: string;
      timeInfo: TimeInfoDto;
    };
    source: string;
    isVisible: boolean;
  },
  parentId: string
) => ({
  id: dto.general.id,
  parentId,
  name: dto.general.name,
  remark: dto.general.remark,
  source: dto.source as never,
  timeInfo: fromTimeInfoDto(dto.general.timeInfo),
  isVisible: dto.isVisible
});

export const createWptFromDto = (dto: CreateWptDto): Wpt => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.NAVIGATION_WAY_POINT,
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  position: fromGeoDto(dto.position),
  connectedRoutes: []
});

export const wptFromRouteWptDto = (dto: CreateRouteWptDto): Wpt => ({
  ...createBaseFields(dto),
  id: dto.id,
  entityType: ENTITY_TYPES.NAVIGATION_WAY_POINT,
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  position: fromGeoDto(dto.position),
  connectedRoutes: []
});

export const applyWptUpdate = (
  currentWpt: Wpt,
  incomingWpt: UpdateWptDto,
  now: Date = new Date()
): Wpt => ({
  ...currentWpt,
  timeInfo: { ...currentWpt.timeInfo, lastUpdateTime: now },
  category: incomingWpt.category,
  altitudeFeet: incomingWpt.altitudeFeet,
  name: incomingWpt.name,
  remark: incomingWpt.remark,
  isVisible: incomingWpt.isVisible,
  position: fromGeoDto(incomingWpt.position),
  remoteId: incomingWpt.remoteId,
  remoteName: incomingWpt.remoteName
});

export const applyRouteWptUpdate = (currentWpt: Wpt, incomingWpt: CreateRouteWptDto): Wpt => ({
  ...currentWpt,
  category: incomingWpt.category,
  name: incomingWpt.name,
  position: fromGeoDto(incomingWpt.position),
  parentId: incomingWpt.parentId
});

export const wptEqualsRouteWptDto = (wpt: Wpt, dto: CreateRouteWptDto): boolean =>
  wpt.name === dto.name &&
  wpt.category === dto.category &&
  wpt.position.latitude === dto.position.latitude &&
  wpt.position.longitude === dto.position.longitude;

export const wptToDto = (wpt: Wpt): WptDto => ({
  general: toGeneralInfo(wpt),
  entityType: wpt.entityType,
  source: wpt.source,
  category: wpt.category,
  altitudeFeet: wpt.altitudeFeet,
  isVisible: wpt.isVisible,
  position: toGeoDto(wpt.position),
  remoteId: wpt.remoteId ?? undefined,
  remoteName: wpt.remoteName
});

export const wptFromDto = (dto: WptDto, parentId: string): Wpt => ({
  ...readBaseFields(dto, parentId),
  entityType: ENTITY_TYPES.NAVIGATION_WAY_POINT,
  category: dto.category as never,
  altitudeFeet: dto.altitudeFeet,
  position: fromGeoDto(dto.position),
  connectedRoutes: [],
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});

export const wptAsCreateRouteWptDto = (wpt: Wpt): CreateRouteWptDto => ({
  id: wpt.id,
  parentId: wpt.parentId,
  name: wpt.name,
  source: wpt.source,
  category: wpt.category,
  altitudeFeet: wpt.altitudeFeet,
  remark: wpt.remark,
  isVisible: wpt.isVisible,
  position: toGeoDto(wpt.position),
  remoteId: wpt.remoteId,
  remoteName: wpt.remoteName
});

export const createSymbolPointFromDto = (dto: CreateSymbolPointDto): SymbolPoint => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.SYMBOL_POINT,
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  position: fromGeoDto(dto.position)
});

export const applySymbolPointUpdate = (
  currentSymbolPoint: SymbolPoint,
  incomingSymbolPoint: UpdateSymbolPointDto,
  now: Date = new Date()
): SymbolPoint => ({
  ...currentSymbolPoint,
  timeInfo: { ...currentSymbolPoint.timeInfo, lastUpdateTime: now },
  category: incomingSymbolPoint.category,
  altitudeFeet: incomingSymbolPoint.altitudeFeet,
  name: incomingSymbolPoint.name,
  remark: incomingSymbolPoint.remark,
  isVisible: incomingSymbolPoint.isVisible,
  position: fromGeoDto(incomingSymbolPoint.position),
  remoteId: incomingSymbolPoint.remoteId,
  remoteName: incomingSymbolPoint.remoteName
});

export const symbolPointToDto = (symbolPoint: SymbolPoint): SymbolPointDto => ({
  general: toGeneralInfo(symbolPoint),
  entityType: symbolPoint.entityType,
  source: symbolPoint.source,
  category: symbolPoint.category,
  altitudeFeet: symbolPoint.altitudeFeet,
  isVisible: symbolPoint.isVisible,
  position: toGeoDto(symbolPoint.position),
  remoteId: symbolPoint.remoteId,
  remoteName: symbolPoint.remoteName
});

export const symbolPointFromDto = (dto: SymbolPointDto, parentId: string): SymbolPoint => ({
  ...readBaseFields(dto, parentId),
  entityType: ENTITY_TYPES.SYMBOL_POINT,
  category: dto.category as never,
  altitudeFeet: dto.altitudeFeet,
  position: fromGeoDto(dto.position),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});

export const createLandingZoneFromDto = (dto: CreateLandingZoneDto): LandingZone => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.LANDING_ZONE,
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  position: fromGeoDto(dto.position),
  secondaryPosition: fromGeoDto(dto.secondaryPosition),
  alias: dto.alias,
  code: dto.code,
  status: dto.status,
  operatingCategory: dto.operatingCategory,
  reutCategory: dto.reutCategory,
  dustRepair: dto.dustRepair,
  magneticVariable: dto.magneticVariable
});

export const applyLandingZoneUpdate = (
  currentLandingZone: LandingZone,
  incomingLandingZone: UpdateLandingZoneDto,
  now: Date = new Date()
): LandingZone => ({
  ...currentLandingZone,
  timeInfo: { ...currentLandingZone.timeInfo, lastUpdateTime: now },
  category: incomingLandingZone.category,
  altitudeFeet: incomingLandingZone.altitudeFeet,
  name: incomingLandingZone.name,
  remark: incomingLandingZone.remark,
  isVisible: incomingLandingZone.isVisible,
  alias: incomingLandingZone.alias,
  code: incomingLandingZone.code,
  status: incomingLandingZone.status,
  operatingCategory: incomingLandingZone.operatingCategory,
  reutCategory: incomingLandingZone.reutCategory,
  dustRepair: incomingLandingZone.dustRepair,
  magneticVariable: incomingLandingZone.magneticVariable,
  position: fromGeoDto(incomingLandingZone.position),
  secondaryPosition: fromGeoDto(incomingLandingZone.secondaryPosition),
  remoteId: incomingLandingZone.remoteId,
  remoteName: incomingLandingZone.remoteName
});

export const landingZoneToDto = (landingZone: LandingZone): LandingZoneDto => ({
  general: toGeneralInfo(landingZone),
  entityType: landingZone.entityType,
  source: landingZone.source,
  category: landingZone.category,
  altitudeFeet: landingZone.altitudeFeet,
  isVisible: landingZone.isVisible,
  alias: landingZone.alias,
  code: landingZone.code,
  status: landingZone.status,
  operatingCategory: landingZone.operatingCategory,
  reutCategory: landingZone.reutCategory,
  dustRepair: landingZone.dustRepair,
  magneticVariable: landingZone.magneticVariable,
  startNz: toGeoDto(landingZone.position),
  endNz: toGeoDto(landingZone.secondaryPosition),
  remoteId: landingZone.remoteId,
  remoteName: landingZone.remoteName
});

export const landingZoneFromDto = (dto: LandingZoneDto, parentId: string): LandingZone => ({
  ...readBaseFields(dto, parentId),
  entityType: ENTITY_TYPES.LANDING_ZONE,
  category: dto.category as never,
  altitudeFeet: dto.altitudeFeet,
  position: fromGeoDto(dto.startNz),
  secondaryPosition: fromGeoDto(dto.endNz),
  alias: dto.alias,
  code: dto.code,
  status: dto.status as never,
  operatingCategory: dto.operatingCategory as never,
  reutCategory: dto.reutCategory as never,
  dustRepair: dto.dustRepair,
  magneticVariable: dto.magneticVariable,
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});

export const createEliahuFromDto = (dto: CreateEliahuDto): Eliahu => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.ELIAHU,
  category: dto.category,
  color: dto.color,
  status: dto.status,
  radiusNm: dto.radiusNm,
  position: fromGeoDto(dto.position),
  isOperational: dto.isOperational,
  showSightPresentation: dto.showSightPresentation,
  isFilled: dto.isFilled
});

export const applyEliahuUpdate = (
  currentEliahu: Eliahu,
  incomingEliahu: UpdateEliahuDto,
  now: Date = new Date()
): Eliahu => ({
  ...currentEliahu,
  timeInfo: { ...currentEliahu.timeInfo, lastUpdateTime: now },
  category: incomingEliahu.category,
  name: incomingEliahu.name,
  remark: incomingEliahu.remark,
  isVisible: incomingEliahu.isVisible,
  color: incomingEliahu.color,
  isFilled: incomingEliahu.isFilled,
  radiusNm: incomingEliahu.radiusNm,
  status: incomingEliahu.status,
  position: fromGeoDto(incomingEliahu.position),
  isOperational: incomingEliahu.isOperational,
  showSightPresentation: incomingEliahu.showSightPresentation,
  remoteId: incomingEliahu.remoteId,
  remoteName: incomingEliahu.remoteName
});

export const eliahuToDto = (eliahu: Eliahu): EliahuDto => ({
  general: toGeneralInfo(eliahu),
  entityType: eliahu.entityType,
  source: eliahu.source,
  category: eliahu.category,
  isVisible: eliahu.isVisible,
  color: eliahu.color,
  isFilled: eliahu.isFilled,
  radiusNm: eliahu.radiusNm,
  status: eliahu.status,
  position: toGeoDto(eliahu.position),
  isOperational: eliahu.isOperational,
  showSightPresentation: eliahu.showSightPresentation,
  remoteId: eliahu.remoteId,
  remoteName: eliahu.remoteName
});

export const eliahuFromDto = (dto: EliahuDto, parentId: string): Eliahu => ({
  ...readBaseFields(dto, parentId),
  entityType: ENTITY_TYPES.ELIAHU,
  category: dto.category as never,
  color: dto.color,
  status: dto.status as never,
  radiusNm: dto.radiusNm,
  position: fromGeoDto(dto.position),
  isOperational: dto.isOperational,
  showSightPresentation: dto.showSightPresentation,
  isFilled: dto.isFilled,
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});

export const createIslandFromDto = (dto: CreateIslandDto): Island => ({
  ...createBaseFields({ ...dto, source: ENTITY_SOURCES.UNIVERSE }),
  entityType: ENTITY_TYPES.ISLAND,
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  radiusNm: dto.radiusNm,
  secondaryRadiusNm: dto.secondaryRadiusNm,
  position: fromGeoDto(dto.position),
  secondaryPosition: fromGeoDto(dto.circleCenterPosition),
  showLamine: dto.showLamine,
  showSecondaryCircle: dto.showSecondaryCircle,
  isFilled: dto.isFilled
});

export const applyIslandUpdate = (
  currentIsland: Island,
  incomingIsland: UpdateIslandDto,
  now: Date = new Date()
): Island => ({
  ...currentIsland,
  timeInfo: { ...currentIsland.timeInfo, lastUpdateTime: now },
  category: incomingIsland.category,
  altitudeFeet: incomingIsland.altitudeFeet,
  name: incomingIsland.name,
  remark: incomingIsland.remark,
  isVisible: incomingIsland.isVisible,
  isFilled: incomingIsland.isFilled,
  radiusNm: incomingIsland.radiusNm,
  secondaryRadiusNm: incomingIsland.secondaryRadiusNm,
  position: fromGeoDto(incomingIsland.position),
  secondaryPosition: fromGeoDto(incomingIsland.circleCenterPosition),
  showLamine: incomingIsland.showLamine,
  showSecondaryCircle: incomingIsland.showSecondaryCircle
});

export const islandToDto = (island: Island): IslandDto => ({
  general: toGeneralInfo(island),
  entityType: island.entityType,
  source: island.source,
  category: island.category,
  altitudeFeet: island.altitudeFeet,
  isVisible: island.isVisible,
  isFilled: island.isFilled,
  radiusNm: island.radiusNm,
  secondaryRadius: island.secondaryRadiusNm,
  position: toGeoDto(island.position),
  circleCenterPosition: toGeoDto(island.secondaryPosition),
  showLamine: island.showLamine,
  showSecondaryCircle: island.showSecondaryCircle
});

export const islandFromDto = (dto: IslandDto, parentId: string): Island => ({
  ...readBaseFields({ ...dto, source: ENTITY_SOURCES.UNIVERSE }, parentId),
  entityType: ENTITY_TYPES.ISLAND,
  category: dto.category as never,
  altitudeFeet: dto.altitudeFeet,
  radiusNm: dto.radiusNm,
  secondaryRadiusNm: dto.secondaryRadius,
  position: fromGeoDto(dto.position),
  secondaryPosition: fromGeoDto(dto.circleCenterPosition),
  showLamine: dto.showLamine,
  showSecondaryCircle: dto.showSecondaryCircle,
  isFilled: dto.isFilled
});

export const createLamineFromDto = (dto: CreateLamineDto): Lamine => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.LAMINE,
  category: dto.category,
  color: dto.color,
  altitudeFeet: dto.altitudeFeet,
  radiusNm: dto.radiusNm,
  position: fromGeoDto(dto.position),
  isOperational: dto.isOperational,
  showSightPresentation: dto.showSightPresentation,
  isFilled: dto.isFilled
});

export const applyLamineUpdate = (
  currentLamine: Lamine,
  incomingLamine: UpdateLamineDto,
  now: Date = new Date()
): Lamine => ({
  ...currentLamine,
  timeInfo: { ...currentLamine.timeInfo, lastUpdateTime: now },
  category: incomingLamine.category,
  altitudeFeet: incomingLamine.altitudeFeet,
  name: incomingLamine.name,
  remark: incomingLamine.remark,
  isVisible: incomingLamine.isVisible,
  color: incomingLamine.color,
  isFilled: incomingLamine.isFilled,
  radiusNm: incomingLamine.radiusNm,
  position: fromGeoDto(incomingLamine.position),
  isOperational: incomingLamine.isOperational,
  showSightPresentation: incomingLamine.showSightPresentation,
  remoteId: incomingLamine.remoteId,
  remoteName: incomingLamine.remoteName
});

export const lamineToDto = (lamine: Lamine): LamineDto => ({
  general: toGeneralInfo(lamine),
  entityType: lamine.entityType,
  source: lamine.source,
  category: lamine.category,
  altitudeFeet: lamine.altitudeFeet,
  isVisible: lamine.isVisible,
  color: lamine.color,
  isFilled: lamine.isFilled,
  radiusNm: lamine.radiusNm,
  position: toGeoDto(lamine.position),
  isOperational: lamine.isOperational,
  showSightPresentation: lamine.showSightPresentation,
  remoteId: lamine.remoteId,
  remoteName: lamine.remoteName
});

export const lamineFromDto = (dto: LamineDto, parentId: string): Lamine => ({
  ...readBaseFields(dto, parentId),
  entityType: ENTITY_TYPES.LAMINE,
  category: dto.category as never,
  color: dto.color,
  altitudeFeet: dto.altitudeFeet,
  radiusNm: dto.radiusNm,
  position: fromGeoDto(dto.position),
  isOperational: dto.isOperational,
  showSightPresentation: dto.showSightPresentation,
  isFilled: dto.isFilled,
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});

export const createMessiFromDto = (
  dto: CreateMessiDto
): Messi => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.MESSI,
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  position: fromGeoDto(dto.position),
  isOperational: dto.isOperational,
  showSightPresentation: dto.showSightPresentation,
  isFilled: dto.isFilled
});

export const applyMessiUpdate = (
  currentMessi: Messi,
  incomingMessi: UpdateMessiDto,
  now: Date = new Date()
): Messi => ({
  ...currentMessi,
  timeInfo: { ...currentMessi.timeInfo, lastUpdateTime: now },
  category: incomingMessi.category,
  altitudeFeet: incomingMessi.altitudeFeet,
  name: incomingMessi.name,
  remark: incomingMessi.remark,
  isVisible: incomingMessi.isVisible,
  position: fromGeoDto(incomingMessi.position),
  isOperational: incomingMessi.isOperational,
  showSightPresentation: incomingMessi.showSightPresentation,
  isFilled: incomingMessi.isFilled,
  remoteId: incomingMessi.remoteId,
  remoteName: incomingMessi.remoteName
});

export const messiToDto = (
  messi: Messi
): MessiDto => ({
  general: toGeneralInfo(messi),
  entityType: messi.entityType,
  source: messi.source,
  category: messi.category,
  altitudeFeet: messi.altitudeFeet,
  isVisible: messi.isVisible,
  isFilled: messi.isFilled,
  position: toGeoDto(messi.position),
  isOperational: messi.isOperational,
  showSightPresentation: messi.showSightPresentation,
  remoteId: messi.remoteId,
  remoteName: messi.remoteName
});

export const messiFromDto = (
  dto: MessiDto,
  parentId: string
): Messi => ({
  ...readBaseFields(dto, parentId),
  entityType: ENTITY_TYPES.MESSI,
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  position: fromGeoDto(dto.position),
  isOperational: dto.isOperational,
  showSightPresentation: dto.showSightPresentation,
  isFilled: dto.isFilled,
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});
