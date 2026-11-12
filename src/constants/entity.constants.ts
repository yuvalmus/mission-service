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

export const ENTITY_SOURCES = {
  UNIVERSE: 'universe',
  EMAIL: 'email',
  PM: 'pm',
  ME: 'me',
  SONIC: 'sonic',
  CRD: 'crd'
} as const;
export type EntitySources = (typeof ENTITY_SOURCES)[keyof typeof ENTITY_SOURCES];

export const LINE_STYLES = {
  THICK_LINE: 'thickLine',
  THIN_LINE: 'thinLine',
  DOTTED_LINE: 'dottedLine',
  THICK_DOTTED_LINE: 'thickDottedLine'
} as const;

export const AREA_CATEGORIES = {
  GENERAL: 'general',
  TRAINING_LOW: 'trainingLow',
  TRAINING_HIGH: 'trainingHigh',
  ONAVIV: 'onaviv',
  INSPECTION: 'inspection',
  FIRING_RANGE_ENTRANCE: 'firingRangeEntrance',
  FIRING_RANGE: 'firingRange',
  DAILY: 'daily',
  ALWAYS_CLOSED: 'alwaysClosed'
} as const;

export const POLYLINE_CATEGORIES = {
  BORDER: 'border',
  ALWAYS_CLOSED: 'alwaysClosed',
  GENERAL: 'general',
  ME: 'me',
  SAFETY: 'safety',
  FENCE: 'fence',
  GENERAL_ONAVIV: 'generalOnaviv',
  MIB: 'mib',
  MTBE: 'mtbe'
} as const;

export const ISLAND_CATEGORIES = {
  UNIVERSE: 'universe',
  ME: 'me',
  ACTIVE: 'active'
} as const;

export const POINT_CATEGORIES = {
  HEXAGON: 'hexagon',
  STAR: 'star',
  OCTAGON: 'octagon',
  SUN: 'sun',
  RHOMBUS: 'rhombus',
  OBSTACLE_300: 'obstacle300',
  OBSTACLE_500: 'obstacle500'
} as const;

export const LAMINE_CATEGORIES = {
  OTHER: 'other',
  LOCAL: 'local',
  REUT: 'reut'
} as const;

export const WPT_CATEGORIES = {
  USER: 'user',
  LUAI: 'luai',
  MRI: 'mri',
  CD: 'cd',
  MARK: 'mark',
  LINE_POINT: 'linePoint'
} as const;

export const ROUTE_CATEGORIES = {
  VIBUCKS: 'vibucks',
  MRI: 'mri',
  NAV: 'nav'
} as const;

export const LANDING_ZONE_CATEGORIES = {
  A: 'a',
  PM: 'pm',
  B: 'b',
  P: 'p'
} as const;

export const ELIAHU_CATEGORIES = {
  UNKNOWN: 'UNKNOWN'
} as const;

export type EliahuCategory = (typeof ELIAHU_CATEGORIES)[keyof typeof ELIAHU_CATEGORIES];

export const STAKE_CATEGORIES = {
  A: 'a',
  B: 'b',
  MRI: 'mri',
  VIBUCKS: 'vibucks',
  CD: 'cd',
  BORDER: 'border',
  ALWAYS_CLOSED: 'alwaysClosed',
  FENCE: 'fence',
  TRAINING_LOW: 'trainingLow',
  TRAINING_HIGH: 'trainingHigh',
  INSPECTION: 'inspection',
  FIRING_RANGE_ENTRANCE: 'firingRangeEntrance',
  FIRING_RANGE: 'firingRange'
} as const;

export const ELIAHU_STATUSES = {
  HOT: 'hot',
  COLD: 'cold',
  MILD: 'mild',
  UNDEFINED: 'undefined'
} as const;

export const LANDING_ZONE_STATUSES = {
  ACTIVE: 'active',
  ARCHIVE: 'archive',
  IN_TEST: 'inTest',
  TEMP_CANCELLED: 'tempCancelled',
  PERM_CANCELLED: 'permCancelled',
  EMERGENCY_ONLY: 'emergencyOnly',
  EMERGENCY_ONLY_LAMINE: 'emergencyOnlyLamine',
  EMERGENCY_ONLY_OBSTACLES: 'emergencyOnlyObstacles',
  NIGHT_ONLY: 'nightOnly',
  TRAININGS: 'trainings',
  OTHER: 'other'
} as const;

export const LZ_OPERATING_TYPES = {
  OPERATIONAL_A: 'operationalA',
  OPERATIONAL_B: 'operationalB',
  OPERATIONAL_C: 'operationalC'
} as const;

export const LZ_REUT_TYPES = {
  REUT_A: 'reutA',
  REUT_B: 'reutB',
  REUT_C: 'reutC'
} as const;

export const TIME_ZONE_AREAS = {
  NONE: 'none',
  DAY: 'day',
  NIGHT: 'night'
} as const;

export const ROUTE_PROVIDERS = {
  HAIR: 'hair',
  USP: 'usp'
} as const;

export const ROUTE_VIEW_MODES = {
  REDUCED: 'reduced',
  EXPANDED: 'expanded',
  REGULAR: 'regular'
} as const;

export const PATRICKS = {
  PATRICK_100: 'patrick100',
  PATRICK_103: 'patrick103',
  PATRICK_120: 'patrick120',
  PATRICK_131: 'patrick131',
  PATRICK_135: 'patrick135'
} as const;

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

const STAKESTRUCTURE_AREA_CATEGORIES = [
  AREA_CATEGORIES.TRAINING_HIGH,
  AREA_CATEGORIES.TRAINING_LOW,
  AREA_CATEGORIES.ALWAYS_CLOSED,
  AREA_CATEGORIES.FIRING_RANGE,
  AREA_CATEGORIES.FIRING_RANGE_ENTRANCE,
  AREA_CATEGORIES.INSPECTION
] as const;

export const MISSION_LAYER_ENTITY_CATEGORIES: Record<
  MissionLayer,
  Partial<Record<EntityType, readonly string[]>>
> = {
  [MISSION_LAYERS.NAVIGATION]: {
    [ENTITY_TYPES.LANDING_ZONE]: Object.values(LANDING_ZONE_CATEGORIES),
    [ENTITY_TYPES.NAVIGATION_WAY_POINT]: Object.values(WPT_CATEGORIES),
    [ENTITY_TYPES.ISLAND]: Object.values(ISLAND_CATEGORIES),
    [ENTITY_TYPES.ROUTE]: Object.values(ROUTE_CATEGORIES)
  },
  [MISSION_LAYERS.USER_ITEMS]: {
    [ENTITY_TYPES.CIRCLE]: [AREA_CATEGORIES.GENERAL],
    [ENTITY_TYPES.NAVIGATION_WAY_POINT]: [
      POINT_CATEGORIES.OBSTACLE_300,
      POINT_CATEGORIES.OBSTACLE_500,
      AREA_CATEGORIES.GENERAL
    ],
    [ENTITY_TYPES.POLYGON]: [AREA_CATEGORIES.GENERAL],
    [ENTITY_TYPES.POLYLINE]: [
      POLYLINE_CATEGORIES.ME,
      'generalPmLine',
      'generalPm',
      POLYLINE_CATEGORIES.GENERAL
    ],
    [ENTITY_TYPES.CORRIDOR]: [AREA_CATEGORIES.GENERAL]
  },
  [MISSION_LAYERS.STAKESTRUCTURE]: {
    [ENTITY_TYPES.POLYGON]: STAKESTRUCTURE_AREA_CATEGORIES,
    [ENTITY_TYPES.CIRCLE]: STAKESTRUCTURE_AREA_CATEGORIES,
    [ENTITY_TYPES.POLYLINE]: [
      POLYLINE_CATEGORIES.MTBE,
      POLYLINE_CATEGORIES.SAFETY,
      POLYLINE_CATEGORIES.BORDER,
      POLYLINE_CATEGORIES.GENERAL,
      POLYLINE_CATEGORIES.FENCE,
      POLYLINE_CATEGORIES.ALWAYS_CLOSED,
      POLYLINE_CATEGORIES.MIB,
      ...STAKESTRUCTURE_AREA_CATEGORIES
    ],
    [ENTITY_TYPES.CORRIDOR]: STAKESTRUCTURE_AREA_CATEGORIES
  },
  [MISSION_LAYERS.REUT]: {
    [ENTITY_TYPES.CIRCLE]: [AREA_CATEGORIES.ONAVIV],
    [ENTITY_TYPES.POLYGON]: [AREA_CATEGORIES.ONAVIV],
    [ENTITY_TYPES.POLYLINE]: [
      POLYLINE_CATEGORIES.GENERAL_ONAVIV,
      AREA_CATEGORIES.ONAVIV
    ],
    [ENTITY_TYPES.CORRIDOR]: [AREA_CATEGORIES.ONAVIV],
    [ENTITY_TYPES.LAMINE]: [LAMINE_CATEGORIES.REUT]
  },
  [MISSION_LAYERS.UTILITIES]: {},
  [MISSION_LAYERS.TRAINING_DAILY]: {
    [ENTITY_TYPES.CIRCLE]: [AREA_CATEGORIES.DAILY],
    [ENTITY_TYPES.POLYGON]: [AREA_CATEGORIES.DAILY],
    [ENTITY_TYPES.CORRIDOR]: [AREA_CATEGORIES.DAILY]
  }
} as const;
