export const ENTITY_TYPES = {
  CIRCLE: 'Circle',
  POLYGON: 'Polygon',
  CORRIDOR: 'Corridor',
  POLYLINE: 'Polyline',
  NAVIGATION_WAY_POINT: 'NavigationWayPoint',
  ELIAHU: 'Eliahu',
  LANDING_ZONE: 'LandingZone',
  RECON: 'Recon',
  LAMINE: 'Lamine',
  MESSI: 'Messi',
  SYMBOL_POINT: 'SymbolPoint',
  ROUTE: 'Route',
  SECTOR: 'Sector',
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export const ENTITY_SOURCES = ['Globus', 'Email', 'PM', 'Sonic'] as const;

export const LINE_STYLES = ['ThickLine', 'ThinLine', 'DottedLine', 'ThickDottedLine'] as const;

export const AREA_CATEGORIES = [
  'General',
  'TrainingLow',
  'TrainingHigh',
  'Onaviv',
  'Inspection',
  'FiringRangeEntrance',
  'FiringRange',
  'Daily',
  'AlwaysClosed',
] as const;

export const POLYLINE_CATEGORIES = [
  'Border',
  'AlwaysClosed',
  'General',
  'Me',
  'Safety',
  'Fence',
  'GeneralOnaviv',
  'MIB',
  'MTBe',
] as const;

export const RECON_CATEGORIES = ['Globus', 'Me', 'Active'] as const;

export const POINT_CATEGORIES = [
  'Hexagon',
  'Star',
  'Octagon',
  'Sun',
  'Rhombus',
  'Obstacle300',
  'Obstacle500',
] as const;

export const LAMINE_CATEGORIES = ['Other', 'Local', 'Reut'] as const;

export const WPT_CATEGORIES = ['User', 'LUAI', 'MRI', 'CD', 'Mark', 'LinePoint'] as const;

export const ROUTE_CATEGORIES = ['MRI', 'NAV'] as const;

export const LANDING_ZONE_CATEGORIES = ['A', 'PM', 'B', 'Eli'] as const;

export const ELIAHU_CATEGORIES = ['Eli', 'UNKNOWN'] as const;

export const STAKE_CATEGORIES = [
  'A',
  'B',
  'MRI',
  'VIBUCKS',
  'CD',
  'Border',
  'AlwaysClosed',
  'Fence',
  'TrainingLow',
  'TrainingHigh',
  'Inspection',
  'FiringRangeEntrance',
  'FiringRange',
] as const;

export const ELIAHU_STATUSES = ['Hot', 'Cold', 'Mild', 'Undefined'] as const;

export const LANDING_ZONE_STATUSES = [
  'Active',
  'Archive',
  'InTest',
  'TempCancelled',
  'PermCancelled',
  'EmergencyOnly',
  'EmergencyOnlyLamine',
  'EmergencyOnlyObstancles',
  'NightOnly',
  'Trainings',
  'Other',
] as const;

export const LZ_OPERATING_TYPES = ['OperationalA', 'OperationalB', 'OperationalC'] as const;

export const LZ_REUT_TYPES = ['ReutA'] as const;

export const TIME_ZONE_AREAS = ['None', 'Day', 'Night'] as const;

export const ROUTE_PROVIDERS = ['SAMSON', 'FMS'] as const;

export const ROUTE_VIEW_MODES = ['Reduced', 'Expanded', 'Regular'] as const;

export const SQUADRONS = [
  'Squadron100',
  'Squadron103',
  'Squadron120',
  'Squadron131',
  'Squadron135',
] as const;

export const NAME_MAX_LENGTHS = {
  DEFAULT: 10,
  WPT: 5,
  LANDING_ZONE: 5,
  ELIAHU: 16,
  LAMINE: 15,
  MESSI: 12,
} as const;

export const ROUTE_LIMITS = {
  REMOTE_NAME_MAX_LENGTH: 100,
  MIN_WPTS: 2,
} as const;

export const RADIUS_LIMITS = {
  AREA: { MIN: 0.1, MAX: 199.9 },
  ELIAHU: { MIN: 0.1, MAX: 9999 },
  LAMINE: { MIN: 0.1, MAX: 500 },
} as const;

export const ALTITUDE_LIMITS = {
  TRAINING_BOUNDARY_FEET: 5000,
} as const;

export const POLYGON_LIMITS = {
  MIN_COORDINATES: 3,
} as const;

export const ANGLE_LIMITS = {
  MIN: 0,
  MAX: 360,
} as const;

export const ENTITY_SEGMENTS = {
  [ENTITY_TYPES.CIRCLE]: 'circle',
  [ENTITY_TYPES.SECTOR]: 'sector',
  [ENTITY_TYPES.POLYGON]: 'polygon',
  [ENTITY_TYPES.CORRIDOR]: 'corridor',
  [ENTITY_TYPES.POLYLINE]: 'polyline',
  [ENTITY_TYPES.NAVIGATION_WAY_POINT]: 'wpt',
  [ENTITY_TYPES.LANDING_ZONE]: 'landingzone',
  [ENTITY_TYPES.ELIAHU]: 'eliahu',
  [ENTITY_TYPES.RECON]: 'recon',
  [ENTITY_TYPES.LAMINE]: 'lamine',
  [ENTITY_TYPES.MESSI]: 'messi',
  [ENTITY_TYPES.SYMBOL_POINT]: 'symbol-point',
  [ENTITY_TYPES.ROUTE]: 'route',
} as const;

export const ENTITY_NAME_PREFIXES = {
  [ENTITY_TYPES.CIRCLE]: 'C',
  [ENTITY_TYPES.SECTOR]: 'S',
  [ENTITY_TYPES.POLYGON]: 'AREA',
  [ENTITY_TYPES.CORRIDOR]: 'COR',
  [ENTITY_TYPES.POLYLINE]: 'LINE',
  [ENTITY_TYPES.NAVIGATION_WAY_POINT]: 'NV',
  [ENTITY_TYPES.LANDING_ZONE]: 'LZ',
  [ENTITY_TYPES.ELIAHU]: 'אלי',
  [ENTITY_TYPES.RECON]: 'A',
  [ENTITY_TYPES.LAMINE]: 'א',
  [ENTITY_TYPES.MESSI]: 'א',
  [ENTITY_TYPES.SYMBOL_POINT]: 'PNT',
  [ENTITY_TYPES.ROUTE]: 'RTE',
} as const;

export const ROUTE_WPT_NAME_PREFIX = 'RT';

export const MISSION_LAYERS = {
  NAVIGATION: 'Navigation',
  USER_ITEMS: 'UserItems',
  STAKESTRUCTURE: 'Stakestructure',
  REUT: 'Reut',
  TRAINING_DAILY: 'TrainingDaily',
  UTILITIES: 'Utilities',
} as const;

export type MissionLayer = (typeof MISSION_LAYERS)[keyof typeof MISSION_LAYERS];

const STAKE_STRUCTURE_AREA_CATEGORIES = [
  'TrainingHigh',
  'TrainingLow',
  'AlwaysClosed',
  'FiringRange',
  'FiringRangeEntrance',
  'Inspection',
] as const;

export const MISSION_LAYER_ENTITY_CATEGORIES: Record<
  MissionLayer,
  Partial<Record<EntityType, readonly string[]>>
> = {
  [MISSION_LAYERS.NAVIGATION]: {
    [ENTITY_TYPES.LANDING_ZONE]: ['PM', 'A', 'B', 'Eli'],
    [ENTITY_TYPES.NAVIGATION_WAY_POINT]: ['User', 'Mark', 'LinePoint', 'CD', 'MRI', 'LUAI'],
    [ENTITY_TYPES.RECON]: ['Me', 'Globus', 'Active'],
    [ENTITY_TYPES.ROUTE]: ['MRI'],
  },
  [MISSION_LAYERS.USER_ITEMS]: {
    [ENTITY_TYPES.CIRCLE]: ['General'],
    [ENTITY_TYPES.NAVIGATION_WAY_POINT]: ['Obstacle300', 'Obstacle500', 'General'],
    [ENTITY_TYPES.POLYGON]: ['General'],
    [ENTITY_TYPES.POLYLINE]: ['Me', 'GeneralPmLine', 'GeneralPm', 'General'],
    [ENTITY_TYPES.CORRIDOR]: ['General'],
  },
  [MISSION_LAYERS.STAKESTRUCTURE]: {
    [ENTITY_TYPES.POLYGON]: STAKE_STRUCTURE_AREA_CATEGORIES,
    [ENTITY_TYPES.CIRCLE]: STAKE_STRUCTURE_AREA_CATEGORIES,
    [ENTITY_TYPES.POLYLINE]: [
      'MTBe',
      'Safety',
      'Border',
      'General',
      'Fence',
      'AlwaysClosed',
      'MIB',
      ...STAKE_STRUCTURE_AREA_CATEGORIES,
    ],
    [ENTITY_TYPES.CORRIDOR]: STAKE_STRUCTURE_AREA_CATEGORIES,
  },
  [MISSION_LAYERS.REUT]: {
    [ENTITY_TYPES.CIRCLE]: ['Onaviv'],
    [ENTITY_TYPES.POLYGON]: ['Onaviv'],
    [ENTITY_TYPES.POLYLINE]: ['GeneralOnaviv', 'Onaviv'],
    [ENTITY_TYPES.CORRIDOR]: ['Onaviv'],
    [ENTITY_TYPES.LAMINE]: ['Reut'],
  },
  [MISSION_LAYERS.UTILITIES]: {},
  [MISSION_LAYERS.TRAINING_DAILY]: {
    [ENTITY_TYPES.CIRCLE]: ['Daily'],
    [ENTITY_TYPES.POLYGON]: ['Daily'],
    [ENTITY_TYPES.CORRIDOR]: ['Daily'],
  },
} as const;
