export const SYNC_LIMITS = {
  DEFAULT_SINCE_SEQ: 0,
  /** Edge hardware and a shared LAN — pages stay small by default. */
  DEFAULT_PAGE: 500,
  MAX_PAGE: 5000,
} as const;

export const SYNC_ROUTES = {
  ROOT: '/sync',
  ENTITY_DELTA: '/entities/delta',
  RENDER_LAYER: '/entities/render',
  STATUS: '/status',
  HISTORY: '/entities/:entityId/history',
  RESTORE: '/entities/:entityId/restore/:version',
  DUPLICATE: '/entities/:entityId/duplicate/:version',
} as const;

export const PARENT_KINDS = {
  MISSION: 'mission',
  INFRA: 'infra',
} as const;

export type ParentKind = (typeof PARENT_KINDS)[keyof typeof PARENT_KINDS];
