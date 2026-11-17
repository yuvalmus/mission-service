import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { SERVICE, STATIONS } from 'constants/app.constants';
import { MESH_DEFAULTS } from 'constants/postgres.constants';

const logTypes = {
  FATAL: 'fatal',
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

const ENV_DEFAULTS = {
  PORT: 5000,
  MONGO_URL: 'mongodb://localhost:27017',
  MONGO_DB_NAME: 'Mission',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  LOG_LEVEL: logTypes.INFO,
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: 5432,
  POSTGRES_USER: 'mesh',
  POSTGRES_PASSWORD: 'mesh_pass',
  POSTGRES_DB: 'meshdb',
  POSTGRES_POOL_MAX: 5,
  MESH_PEER_PORT: 5432,
  NATS_URL: 'nats://localhost:4222',
  TOMBSTONE_RETENTION_MINUTES: 10,
  GC_INTERVAL_SECONDS: 120,
  ROUTE_BACKUP_LIMIT: 10,
} as const;

export interface MeshPeer {
  name: string;
  host: string;
  port: number;
}

const MESH_PEER_PATTERN = /^([^@\s]+)@([^:\s]+)(?::(\d+))?$/;

const MAX_MESH_PEERS = 2;

const MESH_PEERS_MESSAGES = {
  FORMAT: 'MESH_PEERS entries must look like name@host:port',
  TOO_MANY: `MESH_PEERS must list at most ${MAX_MESH_PEERS} peers`,
  SELF: "MESH_PEERS must not include this station's NODE_NAME",
} as const;

const MeshPeersSchema = z
  .string()
  .default('')
  .transform((value, ctx): MeshPeer[] => {
    const matches = value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => MESH_PEER_PATTERN.exec(entry));

    if (matches.some((match) => !match)) {
      ctx.addIssue({ code: 'custom', message: MESH_PEERS_MESSAGES.FORMAT });
      return z.NEVER;
    }

    return matches.map((match) => ({
      name: match?.[1] ?? '',
      host: match?.[2] ?? '',
      port: match?.[3] ? Number(match[3]) : ENV_DEFAULTS.MESH_PEER_PORT,
    }));
  });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(ENV_DEFAULTS.PORT),
  SERVICE_NAME: z.string().min(1).default(SERVICE.NAME),
  STATION: z.enum([STATIONS.GROUND, STATIONS.AIR, STATIONS.EDGE]).default(STATIONS.AIR),
  MONGO_URL: z.string().min(1).default(ENV_DEFAULTS.MONGO_URL),
  MONGO_DB_NAME: z.string().min(1).default(ENV_DEFAULTS.MONGO_DB_NAME),
  REDIS_HOST: z.string().min(1).default(ENV_DEFAULTS.REDIS_HOST),
  REDIS_PORT: z.coerce.number().int().positive().default(ENV_DEFAULTS.REDIS_PORT),
  LOG_LEVEL: z.enum(Object.values(logTypes)).default(ENV_DEFAULTS.LOG_LEVEL),

  POSTGRES_HOST: z.string().min(1).default(ENV_DEFAULTS.POSTGRES_HOST),
  POSTGRES_PORT: z.coerce.number().int().positive().default(ENV_DEFAULTS.POSTGRES_PORT),
  POSTGRES_USER: z.string().min(1).default(ENV_DEFAULTS.POSTGRES_USER),
  POSTGRES_PASSWORD: z.string().min(1).default(ENV_DEFAULTS.POSTGRES_PASSWORD),
  POSTGRES_DB: z.string().min(1).default(ENV_DEFAULTS.POSTGRES_DB),
  POSTGRES_POOL_MAX: z.coerce.number().int().positive().default(ENV_DEFAULTS.POSTGRES_POOL_MAX),

  /** Identity of this station inside the mesh. Stamped on every row as `origin_node`. */
  NODE_NAME: z.string().min(1).default(MESH_DEFAULTS.NODE_NAME),
  MESH_PEERS: MeshPeersSchema,

  NATS_URL: z.string().min(1).default(ENV_DEFAULTS.NATS_URL),

  TOMBSTONE_RETENTION_MINUTES: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(ENV_DEFAULTS.TOMBSTONE_RETENTION_MINUTES),
  GC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(ENV_DEFAULTS.GC_INTERVAL_SECONDS),
  ROUTE_BACKUP_LIMIT: z.coerce.number().int().positive().default(ENV_DEFAULTS.ROUTE_BACKUP_LIMIT),
});

const CheckedEnvSchema = EnvSchema.superRefine(({ NODE_NAME, MESH_PEERS }, ctx) => {
  if (MESH_PEERS.length > MAX_MESH_PEERS) {
    ctx.addIssue({ code: 'custom', message: MESH_PEERS_MESSAGES.TOO_MANY, path: ['MESH_PEERS'] });
  }
  if (MESH_PEERS.some((peer) => peer.name === NODE_NAME)) {
    ctx.addIssue({ code: 'custom', message: MESH_PEERS_MESSAGES.SELF, path: ['MESH_PEERS'] });
  }
});

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (): Env => {
  loadDotenv();
  return CheckedEnvSchema.parse(process.env);
};
