export const ERROR_MESSAGES = {
  EMPTY_MISSION_NAME: 'Empty mission name is not allowed.',
  MISSION_NOT_FOUND: 'Mission does not exist.',
  MISSION_NAME_EXISTS: (name: string) => `A mission named '${name}' already exists in the database.`,
  MISSION_UPDATE_FAILED: 'The mission has not been updated.',
  VALIDATION_FAILED: 'Request validation failed',
  DATABASE_NOT_CONNECTED: 'Database is not connected.',
  UNKNOWN_ERROR: 'Something went wrong.',
  REDIS_UNAVAILABLE: 'Redis is unavailable',
  DUPLICATE_MISSIONS_IN_LIST: 'Two or more missions have the same Id or Name',
  EMPTY_ENTITY_NAME: (entityType: string, id: string) =>
    `Creating entity of type ${entityType} failed: empty entity name is not allowed for entity with Id of ${id}`,
  ENTITY_NAME_EXISTS: (entityType: string, name: string, parentId: string) =>
    `Creating entity of type ${entityType} failed: the entity name '${name}' already exists in mission with id of ${parentId}`,
  ENTITY_UPDATE_NAME_EXISTS: (entityType: string, name: string, parentId: string) =>
    `Updating entity of type ${entityType} failed: the entity name '${name}' already exists in the mission with id of ${parentId}`,
  ENTITY_NOT_FOUND: (entityType: string, id: string, parentId: string) =>
    `The ${entityType} ${id} does not exist in the mission ${parentId}.`,
  ENTITY_UPDATE_NOT_FOUND: (entityType: string, id: string, parentId: string) =>
    `Updating ${entityType} failed: the ${entityType} with id of ${id} does not exist in the mission with id of ${parentId}.`,
  STAKE_CATEGORY_ON_NON_STAKE_PATH: 'Cannot create a non-stake entity with an stake category.',
  NON_STAKE_CATEGORY_ON_STAKE_PATH: 'Cannot create an stake entity with a non-stake category.',
  MISSING_REQUEST_PATH: "The path doesn't exist.",
  WPT_CONNECTED_TO_ROUTES: (routeNames: readonly string[]) =>
    `Deleting wpt failed: cannot delete a user point that is connected to routes: ${routeNames.join(', ')}`,
  ROUTE_MIN_WPTS: 'The route has to contain at least 2 points.',
  ROUTE_ALREADY_EXISTS: (id: string) =>
    `Creating route failed: route with id ${id} already exists in the database`,
  ROUTE_CREATE_INVALID_LEGS: 'Create route failed: some wpts ids referenced in the legs could not be found.',
  ROUTE_UPDATE_INVALID_LEGS: 'Updating route failed: some wpts ids referenced in the legs could not be found.',
  ROUTE_WPTS_DUPLICATED: 'Creating wpts for route failed: cannot create wpts with the same name or same id',
  ROUTE_WPT_IN_OTHER_ROUTE: (id: string) =>
    `Creating wpts for route failed: the Wpt with id ${id} is part of a different Route and is not a permanent point.`,
  ROUTE_WPT_NOT_UPDATABLE: (category: string) =>
    `Creating wpts for route failed: wpt with type of ${category} cannot be updated`,
  ROUTE_CLONE_WPT_ID_MISSING: (wptId: string, missionId: string) =>
    `Cloning route failed: waypoint with id ${wptId} does not exist in mission ${missionId}.`,
  ROUTE_CLONE_WPT_NAME_MISSING: (name: string, missionId: string) =>
    `Cloning route failed: a waypoint named '${name}' does not exist in mission ${missionId}.`,
  CHANGE_VISIBILITY_ENTITY_FAILED: (name: string) => `Failed to change visibility for entity ${name}`,
  CHANGE_VISIBILITY_LIST_FAILED: 'Failed to change visibility for the entity list',
  CHANGE_VISIBILITY_MISSING_ENTITY: (id: string) =>
    `Failed to change visibility: Entity with ID ${id} does not exist in the mission.`,
  INVALID_PATRICK: (name: string) => `Invalid stake name: ${name}`,
  STAKE_NOT_FOUND: "Stake doesn't exist",
  ENTITY_PARENT_NOT_FOUND: (parentId: string) =>
    `The parent ${parentId} does not exist as a mission or a stake.`,
  ENTITY_INTEGRITY_VIOLATION: (entityType: string, id: string) =>
    `The ${entityType} ${id} was rejected by the database integrity rules.`,
  ENTITY_BACKUP_NOT_FOUND: (entityId: string, version: number) =>
    `No backup of version ${version} exists for entity ${entityId}.`,
  SYNC_PARENT_REQUIRED: 'parentId is required.',
  SYNC_SINCE_SEQ_INVALID: 'sinceSeq must be a non-negative integer.',
} as const;
