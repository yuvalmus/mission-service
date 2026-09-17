import { HTTP_STATUS, HttpStatus } from '@constants/http.constants';

export class AppError extends Error {
  readonly statusCode: HttpStatus;

  constructor(message: string, statusCode: HttpStatus) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, HTTP_STATUS.BAD_REQUEST);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, HTTP_STATUS.NOT_FOUND);
  }
}

export class RequestTimeoutError extends AppError {
  constructor(message: string) {
    super(message, HTTP_STATUS.REQUEST_TIMEOUT);
  }
}

export class DatabaseOperationError extends AppError {
  constructor(message: string) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }
}
