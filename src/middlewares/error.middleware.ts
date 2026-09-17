import { ErrorRequestHandler } from 'express';
import { AppError } from '@errors/app.errors';
import { HTTP_STATUS } from '@constants/http.constants';
import { ERROR_MESSAGES } from '@constants/error.constants';
import { AppLogger } from '@utils/logger.util';

export interface ErrorDetails {
  statusCode: number;
  message: string;
}

export const createErrorMiddleware = (logger: AppLogger): ErrorRequestHandler =>
  (error: Error, _req, res, _next) => {
    const statusCode = error instanceof AppError ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const message = error.message || ERROR_MESSAGES.UNKNOWN_ERROR;

    if (statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      logger.error({ err: error }, message);
    } else {
      logger.warn({ statusCode }, message);
    }

    const details: ErrorDetails = { statusCode, message };
    res.status(statusCode).json(details);
  };
