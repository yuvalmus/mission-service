export const ENTITY_TYPES = {
  CIRCLE: 'circle',
  POLYGON: 'polygon',
  CORRIDOR: 'corridor',
  POLYLINE: 'polyline',
  NAVIGATION_WAY_POINT: 'navigationWayPoint',
  ELIAHU: 'eliahu',
  LANDING_ZONE: 'landingZone',
  ISLAND: 'island',
  LAMINE: 'lamine',
  MESSI: 'messi',
  SYMBOL_POINT: 'symbolPoint',
  ROUTE: 'route',
  SECTOR: 'sector'
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export const ENTITY_SOURCES = ['universe', 'email', 'me', 'sonic', 'crd'] as const;

export const LINE_STYLES = ['thickLine', 'thinLine', 'dottedLine', 'thickDottedLine'] as const;

export const AREA_CATEGORIES = [
  'general',
  'onaviv',
  'daily',
  'alwaysClosed'
] as const;

export const POLYLINE_CATEGORIES = [
  'border',
  'alwaysClosed',
  'general',
  'me',
  'safety',
  'fence',
  'generalOnaviv',
] as const;

export const ISLAND_CATEGORIES = ['universe', 'me', 'active'] as const;

export const POINT_CATEGORIES = [
  'hexagon',
  'star',
  'octagon',
  'sun',
  'rhombus',
  'obstacle300',
  'obstacle500'
] as const;

export const LAMINE_CATEGORIES = ['other', 'local', 'reut'] as const;

export const WPT_CATEGORIES = ['user', 'luai', 'mri', 'cd', 'mark', 'linePoint'] as const;

export const ROUTE_CATEGORIES = ['vibucks', 'mri', 'nav'] as const;

export const LANDING_ZONE_CATEGORIES = ['a', 'b', 'p'] as const;

export const ELIAHU_CATEGORIES = ['UNKNOWN'] as const;

export type EliahuCategory = (typeof ELIAHU_CATEGORIES)[keyof typeof ELIAHU_CATEGORIES];

export const STAKE_CATEGORIES = [
  'a',
  'b',
  'mri',
  'vibucks',
  'cd',
  'border',
  'alwaysClosed',
  'fence',
] as const;

export const ELIAHU_STATUSES = ['hot', 'cold', 'mild', 'undefined'] as const;

export const LANDING_ZONE_STATUSES = [
  'active',
  'archive',
  'inTest',
  'tempCancelled',
  'permCancelled',
  'emergencyOnly',
  'emergencyOnlyLamine',
  'emergencyOnlyObstacles',
  'nightOnly',
  'trainings',
  'other'
] as const;

export const LZ_OPERATING_TYPES = ['operationalA', 'operationalB', 'operationalC'] as const;

export const LZ_REUT_TYPES = ['reutA', 'reutB', 'reutC'] as const;

export const TIME_ZONE_AREAS = ['none', 'day', 'night'] as const;

export const ROUTE_PROVIDERS = ['hair', 'usp'] as const;

export const ROUTE_VIEW_MODES = ['reduced', 'expanded', 'regular'] as const;

export const PATRICKS = [
  'patrick1',
] as const;

export const NAME_MAX_LENGTHS = {
  DEFAULT: 10,
  WPT: 5,
  LANDING_ZONE: 5,
  ELIAHU: 16,
  LAMINE: 15,
  MESSI: 12
} as const;

export const ROUTE_LIMITS = {
  REMOTE_NAME_MAX_LENGTH: 100,
  MIN_WPTS: 2
} as const;

export const RADIUS_LIMITS = {
  AREA: { MIN: 0.1, MAX: 199.9 },
  ELIAHU: { MIN: 0.1, MAX: 9999 },
  LAMINE: { MIN: 0.1, MAX: 500 }
} as const;

export const ALTITUDE_LIMITS = {
  TRAINING_BOUNDARY_FEET: 5000
} as const;

export const POLYGON_LIMITS = {
  MIN_COORDINATES: 3
} as const;

export const ANGLE_LIMITS = {
  MIN: 0,
  MAX: 360
} as const;

export const ENTITY_SEGMENTS = {
  [ENTITY_TYPES.CIRCLE]: 'circle',
  [ENTITY_TYPES.SECTOR]: 'sector',
  [ENTITY_TYPES.POLYGON]: 'polygon',
  [ENTITY_TYPES.CORRIDOR]: 'corridor',
  [ENTITY_TYPES.POLYLINE]: 'polyline',
  [ENTITY_TYPES.NAVIGATION_WAY_POINT]: 'wpt',
  [ENTITY_TYPES.LANDING_ZONE]: 'landingZone',
  [ENTITY_TYPES.ELIAHU]: 'eliahu',
  [ENTITY_TYPES.ISLAND]: 'island',
  [ENTITY_TYPES.LAMINE]: 'lamine',
  [ENTITY_TYPES.MESSI]: 'messi',
  [ENTITY_TYPES.SYMBOL_POINT]: 'symbolPoint',
  [ENTITY_TYPES.ROUTE]: 'route'
} as const;

export const ENTITY_NAME_PREFIXES = {
  [ENTITY_TYPES.CIRCLE]: 'C',
  [ENTITY_TYPES.SECTOR]: 'S',
  [ENTITY_TYPES.POLYGON]: 'AREA',
  [ENTITY_TYPES.CORRIDOR]: 'COR',
  [ENTITY_TYPES.POLYLINE]: 'LINE',
  [ENTITY_TYPES.NAVIGATION_WAY_POINT]: 'NV',
  [ENTITY_TYPES.LANDING_ZONE]: 'LZ',
  [ENTITY_TYPES.ELIAHU]: 'פ',
  [ENTITY_TYPES.ISLAND]: 'A',
  [ENTITY_TYPES.LAMINE]: 'א',
  [ENTITY_TYPES.MESSI]: 'א',
  [ENTITY_TYPES.SYMBOL_POINT]: 'PNT',
  [ENTITY_TYPES.ROUTE]: 'RTE'
} as const;

export const ROUTE_WPT_NAME_PREFIX = 'rt';

export const MISSION_LAYERS = {
  NAVIGATION: 'navigation',
  USER_ITEMS: 'userItems',
  STAKESTRUCTURE: 'stakestructure',
  REUT: 'reut',
  TRAINING_DAILY: 'trainingDaily',
  UTILITIES: 'utilities'
} as const;

export type MissionLayer = (typeof MISSION_LAYERS)[keyof typeof MISSION_LAYERS];

const STAKE_STRUCTURE_AREA_CATEGORIES = [
  'alwaysClosed',
] as const;

export const MISSION_LAYER_ENTITY_CATEGORIES: Record<
  MissionLayer,
  Partial<Record<EntityType, readonly string[]>>
> = {
  [MISSION_LAYERS.NAVIGATION]: {
    [ENTITY_TYPES.LANDING_ZONE]: ['a', 'b', 'p'],
    [ENTITY_TYPES.NAVIGATION_WAY_POINT]: ['user', 'mark', 'linePoint', 'cd', 'mri', 'luai'],
    [ENTITY_TYPES.ISLAND]: ['me', 'universe', 'active'],
    [ENTITY_TYPES.ROUTE]: ['mri', 'vibucks', 'nav']
  },
  [MISSION_LAYERS.USER_ITEMS]: {
    [ENTITY_TYPES.CIRCLE]: ['general'],
    [ENTITY_TYPES.NAVIGATION_WAY_POINT]: ['obstacle300', 'obstacle500', 'general'],
    [ENTITY_TYPES.POLYGON]: ['general'],
    [ENTITY_TYPES.POLYLINE]: ['me', 'general'],
    [ENTITY_TYPES.CORRIDOR]: ['general']
  },
  [MISSION_LAYERS.STAKESTRUCTURE]: {
    [ENTITY_TYPES.POLYGON]: STAKE_STRUCTURE_AREA_CATEGORIES,
    [ENTITY_TYPES.CIRCLE]: STAKE_STRUCTURE_AREA_CATEGORIES,
    [ENTITY_TYPES.POLYLINE]: [
      'mtBe',
      'safety',
      'border',
      'general',
      'fence',
      'alwaysClosed',
      'mib',
      ...STAKE_STRUCTURE_AREA_CATEGORIES
    ],
    [ENTITY_TYPES.CORRIDOR]: STAKE_STRUCTURE_AREA_CATEGORIES
  },
  [MISSION_LAYERS.REUT]: {
    [ENTITY_TYPES.CIRCLE]: ['onaviv'],
    [ENTITY_TYPES.POLYGON]: ['onaviv'],
    [ENTITY_TYPES.POLYLINE]: ['generalOnaviv', 'onaviv'],
    [ENTITY_TYPES.CORRIDOR]: ['onaviv'],
    [ENTITY_TYPES.LAMINE]: ['reut']
  },
  [MISSION_LAYERS.UTILITIES]: {},
  [MISSION_LAYERS.TRAINING_DAILY]: {
    [ENTITY_TYPES.CIRCLE]: ['daily'],
    [ENTITY_TYPES.POLYGON]: ['daily'],
    [ENTITY_TYPES.CORRIDOR]: ['daily']
  }
} as const;
