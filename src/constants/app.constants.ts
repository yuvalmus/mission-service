export const SERVICE = {
  NAME: 'mission-service',
  TITLE: 'Globus Mission Service',
} as const;

export const STATIONS = {
  GROUND: 'Ground',
  AIR: 'Air',
} as const;

export const COLLECTIONS = {
  MISSIONS: 'missions',
  ENTITIES: 'entities',
  STAKES: 'stakes',
} as const;

export const MODEL_NAMES = {
  MISSION: 'Mission',
  ENTITY: 'Entity',
} as const;

export const ROUTES = {
  MISSIONS: '/missions',
  CREATE: '/create',
  CREATE_STAKE: '/createStake',
  UPDATE: '/update',
  UPDATE_STAKE: '/updateStake',
  DELETE: '/delete',
  DELETE_STAKE: '/deleteStake',
  ENTITIES: '/entities',
  STAKES: '/stakes',
  NAMES: '/names',
  DOCS: '/docs',
  HEALTHZ: '/healthz',
  READYZ: '/readyz',
} as const;

export const STAKE_PATH_MARKER = 'Stake';

export const MISSION_ROUTES = {
  ROOT: '/',
  BY_ID: '/:id',
  AS_BASIC: '/as-basic',
  FROM_IDS: '/from-ids',
  FROM_IDS_AS_BASIC: '/from-ids/as-basic',
  CLONE: '/clone/:id',
  SEARCH: '/search/:name',
  MERGE: '/merge',
  LIST: '/list',
} as const;

export const DOCS_ROUTES = {
  OPENAPI_JSON: '/openapi.json',
  UI: '/',
} as const;

export const NAME_GENERATION = {
  MISSION_PREFIX: 'משימה ',
  DEFAULT_PAD_LENGTH: 3,
} as const;

export const HEALTH_STATUS = {
  OK: 'ok',
  UNAVAILABLE: 'unavailable',
} as const;
