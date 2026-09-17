import { randomUUID } from 'node:crypto';
import { ENTITY_TYPES } from 'constants/entity.constants';
import { createTimeInfo } from 'models/time.models';
import {
  Eliahu,
  Lamine,
  LandingZone,
  Messi,
  Island,
  SymbolPoint,
  Wpt
} from 'models/points.models';
import {
  CreateEliahuDto,
  CreateLamineDto,
  CreateLandingZoneDto,
  CreateMessiDto,
  CreateIslandDto,
  CreateRouteWptDto,
  CreateSymbolPointDto,
  CreateWptDto,
  EliahuDto,
  LamineDto,
  LandingZoneDto,
  MessiDto,
  IslandDto,
  SymbolPointDto,
  UpdateEliahuDto,
  UpdateLamineDto,
  UpdateLandingZoneDto,
  UpdateMessiDto,
  UpdateIslandDto,
  UpdateSymbolPointDto,
  UpdateWptDto,
  WptDto
} from 'dtos/points.dtos';
import { fromGeoDto, fromTimeInfoDto, toGeneralInfo, toGeoDto } from 'mappers/entity.mapper';
import { TimeInfoDto } from 'dtos/entity.dtos';

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

export const wptFromCreateDto = (dto: CreateWptDto): Wpt => ({
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

export const applyWptUpdate = (wpt: Wpt, dto: UpdateWptDto, now: Date = new Date()): Wpt => ({
  ...wpt,
  timeInfo: { ...wpt.timeInfo, lastUpdateTime: now },
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  position: fromGeoDto(dto.position),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
});

export const applyRouteWptUpdate = (wpt: Wpt, dto: CreateRouteWptDto): Wpt => ({
  ...wpt,
  category: dto.category,
  name: dto.name,
  position: fromGeoDto(dto.position),
  parentId: dto.parentId
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

export const symbolPointFromCreateDto = (dto: CreateSymbolPointDto): SymbolPoint => ({
  ...createBaseFields(dto),
  entityType: ENTITY_TYPES.SYMBOL_POINT,
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  position: fromGeoDto(dto.position)
});

export const applySymbolPointUpdate = (
  symbolPoint: SymbolPoint,
  dto: UpdateSymbolPointDto,
  now: Date = new Date()
): SymbolPoint => ({
  ...symbolPoint,
  timeInfo: { ...symbolPoint.timeInfo, lastUpdateTime: now },
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  position: fromGeoDto(dto.position),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
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

export const landingZoneFromCreateDto = (dto: CreateLandingZoneDto): LandingZone => ({
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
  landingZone: LandingZone,
  dto: UpdateLandingZoneDto,
  now: Date = new Date()
): LandingZone => ({
  ...landingZone,
  timeInfo: { ...landingZone.timeInfo, lastUpdateTime: now },
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  alias: dto.alias,
  code: dto.code,
  status: dto.status,
  operatingCategory: dto.operatingCategory,
  reutCategory: dto.reutCategory,
  dustRepair: dto.dustRepair,
  magneticVariable: dto.magneticVariable,
  position: fromGeoDto(dto.position),
  secondaryPosition: fromGeoDto(dto.secondaryPosition),
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
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

export const eliahuFromCreateDto = (dto: CreateEliahuDto): Eliahu => ({
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
  eliahu: Eliahu,
  dto: UpdateEliahuDto,
  now: Date = new Date()
): Eliahu => ({
  ...eliahu,
  timeInfo: { ...eliahu.timeInfo, lastUpdateTime: now },
  category: dto.category,
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  color: dto.color,
  isFilled: dto.isFilled,
  radiusNm: dto.radiusNm,
  status: dto.status,
  position: fromGeoDto(dto.position),
  isOperational: dto.isOperational,
  showSightPresentation: dto.showSightPresentation,
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
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

export const islandFromCreateDto = (dto: CreateIslandDto): Island => ({
  ...createBaseFields({ ...dto, source: 'universe' }),
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
  island: Island,
  dto: UpdateIslandDto,
  now: Date = new Date()
): Island => ({
  ...island,
  timeInfo: { ...island.timeInfo, lastUpdateTime: now },
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  isFilled: dto.isFilled,
  radiusNm: dto.radiusNm,
  secondaryRadiusNm: dto.secondaryRadiusNm,
  position: fromGeoDto(dto.position),
  secondaryPosition: fromGeoDto(dto.circleCenterPosition),
  showLamine: dto.showLamine,
  showSecondaryCircle: dto.showSecondaryCircle
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
  ...readBaseFields({ ...dto, source: 'universe' }, parentId),
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

export const lamineFromCreateDto = (dto: CreateLamineDto): Lamine => ({
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
  lamine: Lamine,
  dto: UpdateLamineDto,
  now: Date = new Date()
): Lamine => ({
  ...lamine,
  timeInfo: { ...lamine.timeInfo, lastUpdateTime: now },
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  color: dto.color,
  isFilled: dto.isFilled,
  radiusNm: dto.radiusNm,
  position: fromGeoDto(dto.position),
  isOperational: dto.isOperational,
  showSightPresentation: dto.showSightPresentation,
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
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

export const messiFromCreateDto = (
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
  messi: Messi,
  dto: UpdateMessiDto,
  now: Date = new Date()
): Messi => ({
  ...messi,
  timeInfo: { ...messi.timeInfo, lastUpdateTime: now },
  category: dto.category,
  altitudeFeet: dto.altitudeFeet,
  name: dto.name,
  remark: dto.remark,
  isVisible: dto.isVisible,
  position: fromGeoDto(dto.position),
  isOperational: dto.isOperational,
  showSightPresentation: dto.showSightPresentation,
  isFilled: dto.isFilled,
  remoteId: dto.remoteId,
  remoteName: dto.remoteName
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
