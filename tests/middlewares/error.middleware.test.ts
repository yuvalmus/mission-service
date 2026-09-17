import { createErrorMiddleware } from '@middlewares/error.middleware';
import { BadRequestError, DatabaseOperationError, NotFoundError } from '@errors/app.errors';
import { HTTP_STATUS } from '@constants/http.constants';
import { createHttpContext } from '../fixtures/express.fixtures';
import { createLoggerMock } from '../fixtures/mission.fixtures';

describe('error.middleware', () => {
  const logger = createLoggerMock();
  const middleware = createErrorMiddleware(logger);

  it.each([
    [new BadRequestError('bad input'), HTTP_STATUS.BAD_REQUEST],
    [new NotFoundError('missing'), HTTP_STATUS.NOT_FOUND],
    [new DatabaseOperationError('db failed'), HTTP_STATUS.UNPROCESSABLE_ENTITY],
  ])('maps %p to its status code with an ErrorDetails body', (error, expectedStatus) => {
    const { req, res, next } = createHttpContext();

    middleware(error, req, res, next);

    expect(res.statusCode).toBe(expectedStatus);
    expect(res._getJSONData()).toEqual({ statusCode: expectedStatus, message: error.message });
  });

  it('maps unknown errors to 500 and logs them as errors', () => {
    const { req, res, next } = createHttpContext();

    middleware(new Error('unexpected'), req, res, next);

    expect(res.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(res._getJSONData()).toEqual({
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: 'unexpected',
    });
    expect(logger.error).toHaveBeenCalled();
  });
});
