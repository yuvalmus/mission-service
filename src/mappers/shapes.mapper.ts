import { randomUUID } from 'node:crypto';
import { ENTITY_TYPES } from 'constants/entity.constants';
import { createTimeInfo } from 'models/time.models';
import { Circle, Corridor, Polygon, Polyline, Sector } from 'models/shapes.models';
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
  UpdateSectorDto
} from 'dtos/shapes.dtos';
import {
  activeTimeFromDto,
  activeTimeFromWindow,
  fromGeoDto,
  fromTimeInfoDto,
  toActiveTimeDto,
  toGeneralInfo,
  toGeoDto
} from 'mappers/entity.mapper';

const createBaseFields = (dto: {
  parentId: string;
  source: string;
  name: string;
  remark: string;
  isVisible: boolean;
  remoteId?: number | null;
  remoteName?: string | null;
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

export const circleFromCreateDto = (dto: CreateCircleDto): Circle => ({
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
  circle: Circle,
  dto: UpdateCircleDto,
  now: Date = new Date()
): Circle => ({
  ...circle,
  timeInfo: { ...circle.timeInfo, lastUpdateTime: now },
  category: dto.category,
  activeTime: activeTimeFromWindow(dto.beginTime, dto.endTime),
  altitudeRange: { minAltitudeFeet: dto.minAltitudeFeet, maxAltitudeFeet: dto.maxAltitudeFeet },
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  lineStyle: dto.lineStyle,
  color: dto.color,
  isFilled: dto.isFilled,
  radiusNm: dto.radiusNm,
  position: fromGeoDto(dto.position),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
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

export const sectorFromCreateDto = (dto: CreateSectorDto): Sector => ({
  ...circleFromCreateDto({ ...dto } as unknown as CreateCircleDto),
  entityType: ENTITY_TYPES.SECTOR,
  startAngle: dto.startAngle,
  endAngle: dto.endAngle
});

export const applySectorUpdate = (
  sector: Sector,
  dto: UpdateSectorDto,
  now: Date = new Date()
): Sector => ({
  ...sector,
  ...applyCircleUpdate(sector as unknown as Circle, { ...dto } as unknown as UpdateCircleDto, now),
  entityType: ENTITY_TYPES.SECTOR,
  startAngle: dto.startAngle,
  endAngle: dto.endAngle
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

export const polygonFromCreateDto = (dto: CreatePolygonDto): Polygon => ({
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
  polygon: Polygon,
  dto: UpdatePolygonDto,
  now: Date = new Date()
): Polygon => ({
  ...polygon,
  timeInfo: { ...polygon.timeInfo, lastUpdateTime: now },
  category: dto.category,
  activeTime: activeTimeFromWindow(dto.beginTime, dto.endTime),
  altitudeRange: { minAltitudeFeet: dto.minAltitudeFeet, maxAltitudeFeet: dto.maxAltitudeFeet },
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  lineStyle: dto.lineStyle,
  color: dto.color,
  isFilled: dto.isFilled,
  zone: dto.zone,
  coordinates: dto.coordinates.map(fromGeoDto),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
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

export const corridorFromCreateDto = (dto: CreateCorridorDto): Corridor => ({
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
  corridor: Corridor,
  dto: UpdateCorridorDto,
  now: Date = new Date()
): Corridor => ({
  ...corridor,
  timeInfo: { ...corridor.timeInfo, lastUpdateTime: now },
  category: dto.category,
  activeTime: activeTimeFromWindow(dto.beginTime, dto.endTime),
  altitudeRange: { minAltitudeFeet: dto.minAltitudeFeet, maxAltitudeFeet: dto.maxAltitudeFeet },
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  lineStyle: dto.lineStyle,
  color: dto.color,
  isFilled: dto.isFilled,
  radiusNm: dto.radiusNm,
  coordinates: dto.coordinates.map(fromGeoDto),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
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

export const polylineFromCreateDto = (dto: CreatePolylineDto): Polyline => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.POLYLINE,
  category: dto.category,
  color: dto.color,
  lineStyle: dto.lineStyle,
  activeTime: activeTimeFromWindow(dto.beginTime, dto.endTime),
  coordinates: dto.coordinates.map(fromGeoDto)
});

export const applyPolylineUpdate = (
  polyline: Polyline,
  dto: UpdatePolylineDto,
  now: Date = new Date()
): Polyline => ({
  ...polyline,
  timeInfo: { ...polyline.timeInfo, lastUpdateTime: now },
  category: dto.category,
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  lineStyle: dto.lineStyle,
  color: dto.color,
  coordinates: dto.coordinates.map(fromGeoDto),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
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
