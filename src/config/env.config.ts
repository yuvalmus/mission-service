import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { SERVICE, STATIONS } from 'constants/app.constants';

const ENV_DEFAULTS = {
  PORT: 5000,
  MONGO_URI: 'mongodb://localhost:27017',
  MONGO_DB_NAME: 'Mission',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  LOG_LEVEL: 'info',
} as const;

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(ENV_DEFAULTS.PORT),
  SERVICE_NAME: z.string().min(1).default(SERVICE.NAME),
  STATION: z.enum([STATIONS.GROUND, STATIONS.AIR]).default(STATIONS.AIR),
  MONGO_URI: z.string().min(1).default(ENV_DEFAULTS.MONGO_URI),
  MONGO_DB_NAME: z.string().min(1).default(ENV_DEFAULTS.MONGO_DB_NAME),
  REDIS_HOST: z.string().min(1).default(ENV_DEFAULTS.REDIS_HOST),
  REDIS_PORT: z.coerce.number().int().positive().default(ENV_DEFAULTS.REDIS_PORT),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default(ENV_DEFAULTS.LOG_LEVEL),
});

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (): Env => {
  loadDotenv();
  return EnvSchema.parse(process.env);
};
