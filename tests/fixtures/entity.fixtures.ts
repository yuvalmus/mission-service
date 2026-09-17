import { Circle } from '@models/shapes.models';
import { Wpt } from '@models/points.models';
import { Route, RouteLeg } from '@models/route.models';
import { CreateOrUpdateRouteDto } from '@dtos/route.dtos';
import { CreateRouteWptDto } from '@dtos/points.dtos';
import { CreateCircleDto } from '@dtos/shapes.dtos';
import { EntityRetrieverService } from '@services/entity-retriever.service';
import { EntityAdderService } from '@services/entity-adder.service';
import { EntityUpdaterService } from '@services/entity-updater.service';
import { EntityDeleterService } from '@services/entity-deleter.service';
import { RouteWptService } from '@services/route-wpt.service';
import { MISSION_ID, FIXED_DATE } from './mission.fixtures';

export const CIRCLE_ID = '0a1b2c3d-1111-4222-8333-444455556666';
export const WPT_ID = '1b2c3d4e-2222-4333-8444-555566667777';
export const SECOND_WPT_ID = '2c3d4e5f-3333-4444-8555-666677778888';
export const ROUTE_ID = '3d4e5f60-4444-4555-8666-777788889999';
export const OTHER_ROUTE_ID = '4e5f6071-5555-4666-8777-88889999aaaa';

export const buildCircle = (overrides: Partial<Circle> = {}): Circle => ({
  id: CIRCLE_ID,
  parentId: MISSION_ID,
  entityType: 'Circle',
  name: 'C001',
  remark: '',
  source: 'Globus',
  category: 'General',
  timeInfo: { dateCreated: FIXED_DATE, lastUpdateTime: FIXED_DATE },
  isVisible: true,
  remoteId: 0,
  remoteName: '',
  color: 'Red',
  lineStyle: 'ThickLine',
  activeTime: { beginTime: null, endTime: null },
  altitudeRange: { minAltitudeFeet: 0, maxAltitudeFeet: 1000 },
  isFilled: false,
  radiusNm: 5,
  position: { latitude: 32, longitude: 34, datum: 'WGS84' },
  ...overrides,
});

export const buildCreateCircleDto = (overrides: Partial<CreateCircleDto> = {}): CreateCircleDto => ({
  parentId: MISSION_ID,
  source: 'Globus',
  category: 'General',
  beginTime: null,
  endTime: null,
  minAltitudeFeet: 0,
  maxAltitudeFeet: 1000,
  name: 'C001',
  remark: '',
  isVisible: true,
  color: 'Red',
  lineStyle: 'ThickLine',
  isFilled: false,
  radiusNm: 5,
  position: { latitude: 32, longitude: 34, datum: 'WGS84' },
  remoteId: null,
  remoteName: null,
  ...overrides,
});

export const buildWpt = (overrides: Partial<Wpt> = {}): Wpt => ({
  id: WPT_ID,
  parentId: MISSION_ID,
  entityType: 'NavigationWayPoint',
  name: 'NV001',
  remark: '',
  source: 'Globus',
  category: 'User',
  timeInfo: { dateCreated: FIXED_DATE, lastUpdateTime: FIXED_DATE },
  isVisible: true,
  remoteId: 0,
  remoteName: '',
  altitudeFeet: 100,
  position: { latitude: 32, longitude: 34, datum: 'WGS84' },
  connectedRoutes: [],
  ...overrides,
});

export const buildRouteLeg = (overrides: Partial<RouteLeg> = {}): RouteLeg => ({
  startWpt: WPT_ID,
  endWpt: SECOND_WPT_ID,
  distanceNm: 10,
  angle: 90,
  legTimeMs: 60000,
  isManualLegTime: false,
  tas: 120,
  zmmTime: null,
  highestPoint: null,
  safetyAltitudeFeet: 500,
  legOffsets: null,
  turnPoint: null,
  ...overrides,
});

export const buildRoute = (overrides: Partial<Route> = {}): Route => ({
  id: ROUTE_ID,
  parentId: MISSION_ID,
  entityType: 'Route',
  name: 'RTE001',
  remark: '',
  source: 'Globus',
  category: 'NAV',
  timeInfo: { dateCreated: FIXED_DATE, lastUpdateTime: FIXED_DATE },
  isVisible: true,
  remoteId: 0,
  remoteName: '',
  color: 'Blue',
  lineStyle: 'ThinLine',
  wptsIds: [WPT_ID, SECOND_WPT_ID],
  legs: [buildRouteLeg()],
  defaultTas: 120,
  isActive: false,
  routeSource: 'SAMSON',
  viewMode: 'Regular',
  zmmWptId: null,
  ...overrides,
});

export const buildCreateRouteWptDto = (overrides: Partial<CreateRouteWptDto> = {}): CreateRouteWptDto => ({
  id: WPT_ID,
  parentId: MISSION_ID,
  name: 'NV001',
  source: 'Globus',
  category: 'LinePoint',
  altitudeFeet: 100,
  remark: '',
  isVisible: true,
  position: { latitude: 32, longitude: 34, datum: 'WGS84' },
  remoteId: null,
  remoteName: null,
  ...overrides,
});

export const buildCreateOrUpdateRouteDto = (
  overrides: Partial<CreateOrUpdateRouteDto> = {},
): CreateOrUpdateRouteDto => ({
  id: ROUTE_ID,
  parentId: MISSION_ID,
  name: 'RTE001',
  remark: '',
  isActive: false,
  source: 'Globus',
  category: 'NAV',
  routeSource: 'SAMSON',
  viewMode: 'Regular',
  color: 'Blue',
  lineStyle: 'ThinLine',
  legs: [],
  isVisible: true,
  wpts: [
    buildCreateRouteWptDto(),
    buildCreateRouteWptDto({ id: SECOND_WPT_ID, name: 'NV002' }),
  ],
  defaultTas: 120,
  remoteId: null,
  remoteName: null,
  zmmWptId: null,
  ...overrides,
});

export const createEntityRetrieverMock = (): jest.Mocked<EntityRetrieverService> =>
  ({
    findEntity: jest.fn(),
    findEntityOfType: jest.fn(),
  }) as unknown as jest.Mocked<EntityRetrieverService>;

export const createEntityAdderMock = (): jest.Mocked<EntityAdderService> =>
  ({
    addEntity: jest.fn(),
  }) as unknown as jest.Mocked<EntityAdderService>;

export const createEntityUpdaterMock = (): jest.Mocked<EntityUpdaterService> =>
  ({
    updateEntity: jest.fn(),
    updateByType: jest.fn(),
    changeEntityVisibility: jest.fn(),
    changeEntitiesVisibility: jest.fn(),
  }) as unknown as jest.Mocked<EntityUpdaterService>;

export const createEntityDeleterMock = (): jest.Mocked<EntityDeleterService> => ({
  deleteEntity: jest.fn(),
  deleteRoute: jest.fn(),
});

export const createRouteWptServiceMock = (): jest.Mocked<RouteWptService> => ({
  getRouteWpts: jest.fn(),
  getRouteWptsAsBasicDtos: jest.fn(),
  removeWpts: jest.fn(),
  createWptsForRoute: jest.fn(),
  updateExistingWpt: jest.fn(),
});
