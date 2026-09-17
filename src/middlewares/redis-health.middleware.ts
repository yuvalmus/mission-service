import { RequestHandler } from 'express';
import { DatabaseClient } from '@database/database.types';
import { ROUTES } from '@constants/app.constants';
import { ERROR_MESSAGES } from '@constants/error.constants';
import { HTTP_STATUS } from '@constants/http.constants';
import { AppLogger } from '@utils/logger.util';

const EXEMPT_PREFIXES = [ROUTES.HEALTHZ, ROUTES.READYZ, ROUTES.DOCS] as const;

export const createRedisHealthMiddleware = (databaseClient: DatabaseClient, logger: AppLogger): RequestHandler =>
  (req, res, next) => {
    const isExempt = EXEMPT_PREFIXES.some((prefix) => req.path.toLowerCase().startsWith(prefix.toLowerCase()));
    if (isExempt) {
      next();
      return;
    }

    if (!databaseClient.isConnected()) {
      logger.warn('Redis is not connected - blocking request.');
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).send(ERROR_MESSAGES.REDIS_UNAVAILABLE);
      return;
    }

    next();
  };
