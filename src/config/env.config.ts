import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { SERVICE, STATIONS } from 'constants/app.constants';
import { MESH_DEFAULTS } from 'constants/postgres.constants';

const ENV_DEFAULTS = {
  PORT: 5000,
  MONGO_URI: 'mongodb://localhost:27017',
  MONGO_DB_NAME: 'Mission',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  LOG_LEVEL: 'info',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: 5432,
  POSTGRES_USER: 'mesh',
  POSTGRES_PASSWORD: 'mesh_pass',
  POSTGRES_DB: 'meshdb',
  POSTGRES_POOL_MAX: 5,
  PEER_POSTGRES_PORT: 5432,
  NATS_URL: 'nats://localhost:4222',
  TOMBSTONE_RETENTION_MINUTES: 10,
  GC_INTERVAL_SECONDS: 120,
  ROUTE_BACKUP_LIMIT: 10,
} as const;

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(ENV_DEFAULTS.PORT),
  SERVICE_NAME: z.string().min(1).default(SERVICE.NAME),
  STATION: z.enum([STATIONS.GROUND, STATIONS.AIR, STATIONS.EDGE]).default(STATIONS.AIR),
  MONGO_URI: z.string().min(1).default(ENV_DEFAULTS.MONGO_URI),
  MONGO_DB_NAME: z.string().min(1).default(ENV_DEFAULTS.MONGO_DB_NAME),
  REDIS_HOST: z.string().min(1).default(ENV_DEFAULTS.REDIS_HOST),
  REDIS_PORT: z.coerce.number().int().positive().default(ENV_DEFAULTS.REDIS_PORT),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default(ENV_DEFAULTS.LOG_LEVEL),

  POSTGRES_HOST: z.string().min(1).default(ENV_DEFAULTS.POSTGRES_HOST),
  POSTGRES_PORT: z.coerce.number().int().positive().default(ENV_DEFAULTS.POSTGRES_PORT),
  POSTGRES_USER: z.string().min(1).default(ENV_DEFAULTS.POSTGRES_USER),
  POSTGRES_PASSWORD: z.string().min(1).default(ENV_DEFAULTS.POSTGRES_PASSWORD),
  POSTGRES_DB: z.string().min(1).default(ENV_DEFAULTS.POSTGRES_DB),
  POSTGRES_POOL_MAX: z.coerce.number().int().positive().default(ENV_DEFAULTS.POSTGRES_POOL_MAX),

  /** Identity of this station inside the mesh. Stamped on every row as `origin_node`. */
  NODE_NAME: z.string().min(1).default(MESH_DEFAULTS.NODE_NAME),
  PEER_NODE_NAME: z.string().min(1).default(MESH_DEFAULTS.PEER_NODE_NAME),
  PEER_POSTGRES_HOST: z.string().min(1).optional(),
  PEER_POSTGRES_PORT: z.coerce.number().int().positive().default(ENV_DEFAULTS.PEER_POSTGRES_PORT),

  /**
   * Change-sequence interleaving. Each station draws `mission_change_seq` from its own local
   * sequence, so the sequences must not overlap: station i emits i, i+N, i+2N, ... Without this
   * two stations would hand the same sequence number to different entities and a reconnecting
   * client could skip one. Same reasoning as the UUID-only primary key rule.
   */
  MESH_NODE_INDEX: z.coerce.number().int().positive().default(MESH_DEFAULTS.NODE_INDEX),
  MESH_NODE_COUNT: z.coerce.number().int().positive().default(MESH_DEFAULTS.NODE_COUNT),

  NATS_URL: z.string().min(1).default(ENV_DEFAULTS.NATS_URL),

  TOMBSTONE_RETENTION_MINUTES: z.coerce.number().int().nonnegative().default(ENV_DEFAULTS.TOMBSTONE_RETENTION_MINUTES),
  GC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(ENV_DEFAULTS.GC_INTERVAL_SECONDS),
  ROUTE_BACKUP_LIMIT: z.coerce.number().int().positive().default(ENV_DEFAULTS.ROUTE_BACKUP_LIMIT),
});

const MESH_INDEX_MESSAGE = 'MESH_NODE_INDEX must be between 1 and MESH_NODE_COUNT';

const CheckedEnvSchema = EnvSchema.refine(
  ({ MESH_NODE_INDEX, MESH_NODE_COUNT }) => MESH_NODE_INDEX <= MESH_NODE_COUNT,
  { message: MESH_INDEX_MESSAGE, path: ['MESH_NODE_INDEX'] },
);

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (): Env => {
  loadDotenv();
  return CheckedEnvSchema.parse(process.env);
};
