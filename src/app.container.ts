import { Env } from 'config/env.config';
import { STATIONS } from 'constants/app.constants';
import { DatabaseClient, UnitOfWork } from 'database/database.types';
import { createPostgresDatabase, PostgresDatabase } from 'database/postgres.database';
import { createMongoDatabase } from 'database/mongo.database';
import { createRedisDatabase } from 'database/redis.database';
import { MissionRepository } from 'repositories/mission.repository.interface';
import { EntityRepository } from 'repositories/entity.repository.interface';
import { StakeRepository } from 'repositories/stake.repository.interface';
import { createEntityModel, createMissionModel } from 'repositories/mongo/mission.schema';
import { createStakeModel } from 'repositories/mongo/stake.schema';
import { createMongoMissionDbOperations } from 'repositories/mongo/mongo.mission.dbOperations';
import { createMongoEntityDbOperations } from 'repositories/mongo/mongo.entity.dbOperations';
import { createMongoStakeDbOperations } from 'repositories/mongo/mongo.stake.dbOperations';
import { createRedisMissionDbOperations } from 'repositories/redis/redis.mission.dbOperations';
import { createRedisEntityDbOperations } from 'repositories/redis/redis.entity.dbOperations';
import { createRedisStakeDbOperations } from 'repositories/redis/redis.stake.dbOperations';
import { createCommonActionsService } from 'services/common.actions.service';
import { createEntityRetrieverService } from 'services/entity.retriever.service';
import { createEntityAdderService } from 'services/entity.adder.service';
import { createEntityUpdaterService } from 'services/entity.updater.service';
import { createEntityDeleterService } from 'services/entity.deleter.service';
import { createRouteWptService } from 'services/route.wpt.service';
import { createRouteService } from 'services/route.service';
import { createMissionService } from 'services/mission.service';
import { createStakeService } from 'services/stake.service';
import { createHealthService } from 'services/health.service';
import { createMissionController, MissionController } from 'controllers/mission.controller';
import { createHealthController, HealthController } from 'controllers/health.controller';
import {
  createEntityCreatorController,
  EntityCreatorController,
} from 'controllers/entity.creator.controller';
import {
  createEntityUpdaterController,
  EntityUpdaterController,
} from 'controllers/entity.updater.controller';
import {
  createEntityDeleterController,
  EntityDeleterController,
} from 'controllers/entity.deleter.controller';
import {
  createEntityRetrieverController,
  EntityRetrieverController,
} from 'controllers/entity.retriever.controller';
import {
  createDefaultNamesController,
  DefaultNamesController,
} from 'controllers/default.names.controller';
import { createStakeController, StakeController } from 'controllers/stake.controller';
import { createSyncController, SyncController } from 'controllers/sync.controller';
import {
  createEntityHistoryController,
  EntityHistoryController,
} from 'controllers/entity-history.controller';
import { createPostgresSyncRepository } from 'repositories/postgres/sync.repository';
import { createPostgresHistoryRepository } from 'repositories/postgres/history.repository';
import { createSyncService } from 'services/sync.service';
import { createEntityHistoryService } from 'services/entity-history.service';
import { createTombstoneCollector, TombstoneCollector } from 'database/postgres/tombstone.gc';
import { createPglogicalMesh, PglogicalMesh } from 'database/postgres/pglogical.setup';
import { AppLogger, createLogger } from 'utils/logger.util';
import { createPostgresEntityRepository } from 'repositories/postgres/entity.repository';
import { createPostgresMissionRepository } from 'repositories/postgres/mission.repository';
import { createPostgresStakeRepository } from 'repositories/postgres/stake.repository';

export interface AppContainer {
  env: Env;
  logger: AppLogger;
  databaseClient: DatabaseClient;
  /** Present only on the Edge station; the mesh bootstrap and sync layer need the pool. */
  postgres?: PostgresDatabase;
  missionController: MissionController;
  healthController: HealthController;
  entityCreatorController: EntityCreatorController;
  entityUpdaterController: EntityUpdaterController;
  entityDeleterController: EntityDeleterController;
  entityRetrieverController: EntityRetrieverController;
  defaultNamesController: DefaultNamesController;
  stakeController: StakeController;
  /** Mesh-only surface, wired only on the Edge station. */
  syncController?: SyncController;
  entityHistoryController?: EntityHistoryController;
  tombstoneCollector?: TombstoneCollector;
  pglogicalMesh?: PglogicalMesh;
}

interface MeshLayer {
  syncController: SyncController;
  entityHistoryController: EntityHistoryController;
  tombstoneCollector: TombstoneCollector;
  pglogicalMesh: PglogicalMesh;
}

const createMeshLayer = (
  env: Env,
  logger: AppLogger,
  postgres: PostgresDatabase,
  unitOfWork: UnitOfWork,
): MeshLayer => {
  const syncService = createSyncService({
    syncRepository: createPostgresSyncRepository({ database: postgres }),
    nodeName: env.NODE_NAME,
    logger,
  });

  const historyService = createEntityHistoryService({
    historyRepository: createPostgresHistoryRepository({ database: postgres }),
    unitOfWork,
    nodeName: env.NODE_NAME,
    backupLimit: env.ROUTE_BACKUP_LIMIT,
    logger,
  });

  return {
    syncController: createSyncController(syncService),
    entityHistoryController: createEntityHistoryController(historyService),
    tombstoneCollector: createTombstoneCollector({ pool: postgres.pool, env, logger }),
    pglogicalMesh: createPglogicalMesh({ pool: postgres.pool, env, logger }),
  };
};

interface DataLayer {
  client: DatabaseClient;
  unitOfWork: UnitOfWork;
  missionRepository: MissionRepository;
  entityRepository: EntityRepository;
  stakeRepository: StakeRepository;
  postgres?: PostgresDatabase;
}

const createPostgresDataLayer = (env: Env, logger: AppLogger): DataLayer => {
  const database = createPostgresDatabase(env, logger);
  const nodeName = env.NODE_NAME;

  return {
    client: database.client,
    unitOfWork: database.unitOfWork,
    postgres: database,
    missionRepository: createPostgresMissionRepository({ database, nodeName }),
    entityRepository: createPostgresEntityRepository({ database, nodeName, logger }),
    stakeRepository: createPostgresStakeRepository({ database, nodeName }),
  };
};

const createDataLayer = (env: Env, logger: AppLogger): DataLayer => {
  if (env.STATION === STATIONS.EDGE) {
    return createPostgresDataLayer(env, logger);
  }

  if (env.STATION === STATIONS.GROUND) {
    const { client, unitOfWork, connection } = createMongoDatabase(env);
    return {
      client,
      unitOfWork,
      missionRepository: createMongoMissionDbOperations({
        missionModel: createMissionModel(connection),
      }),
      entityRepository: createMongoEntityDbOperations({
        entityModel: createEntityModel(connection),
      }),
      stakeRepository: createMongoStakeDbOperations({ stakeModel: createStakeModel(connection) }),
    };
  }

  const { client, unitOfWork, redis } = createRedisDatabase(env);
  return {
    client,
    unitOfWork,
    missionRepository: createRedisMissionDbOperations({ redis }),
    entityRepository: createRedisEntityDbOperations({ redis, logger }),
    stakeRepository: createRedisStakeDbOperations({ redis }),
  };
};

export const createContainer = (env: Env): AppContainer => {
  const logger = createLogger(env.LOG_LEVEL, env.SERVICE_NAME);
  const { client, unitOfWork, missionRepository, entityRepository, stakeRepository, postgres } =
    createDataLayer(env, logger);

  const commonActions = createCommonActionsService({ missionRepository, stakeRepository, logger });
  const entityRetriever = createEntityRetrieverService({ entityRepository, logger });
  const entityAdder = createEntityAdderService({ entityRepository, commonActions, logger });
  const routeWptService = createRouteWptService({ entityRepository, entityAdder, commonActions });
  const entityUpdater = createEntityUpdaterService({
    entityRepository,
    entityRetriever,
    commonActions,
    routeWptService,
    logger,
  });
  const routeService = createRouteService({
    entityRepository,
    entityRetriever,
    entityAdder,
    entityUpdater,
    routeWptService,
    unitOfWork,
    logger,
  });
  const entityDeleter = createEntityDeleterService({
    entityRepository,
    entityRetriever,
    entityAdder,
    commonActions,
    unitOfWork,
    logger,
  });
  const missionService = createMissionService({
    missionRepository,
    entityRepository,
    routeService,
    commonActions,
    unitOfWork,
    logger,
  });
  const stakeService = createStakeService({
    stakeRepository,
    entityRepository,
    missionService,
    unitOfWork,
    logger,
  });
  const healthService = createHealthService({
    databaseClient: client,
    serviceName: env.SERVICE_NAME,
  });

  const mesh = postgres ? createMeshLayer(env, logger, postgres, unitOfWork) : undefined;

  return {
    env,
    logger,
    databaseClient: client,
    postgres,
    missionController: createMissionController(missionService),
    healthController: createHealthController(healthService),
    entityCreatorController: createEntityCreatorController(entityAdder, routeService),
    entityUpdaterController: createEntityUpdaterController(entityUpdater, routeService),
    entityDeleterController: createEntityDeleterController(entityDeleter),
    entityRetrieverController: createEntityRetrieverController(entityRetriever, routeService),
    defaultNamesController: createDefaultNamesController(missionService),
    stakeController: createStakeController(stakeService),
    syncController: mesh?.syncController,
    entityHistoryController: mesh?.entityHistoryController,
    tombstoneCollector: mesh?.tombstoneCollector,
    pglogicalMesh: mesh?.pglogicalMesh,
  };
};
