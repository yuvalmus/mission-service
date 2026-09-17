import httpMocks, { MockRequest, MockResponse, RequestOptions } from 'node-mocks-http';
import { NextFunction, Request, Response } from 'express';

export interface MockHttpContext<TReq extends Request> {
  req: MockRequest<TReq>;
  res: MockResponse<Response>;
  next: NextFunction & jest.Mock;
}

export const createHttpContext = <TReq extends Request = Request>(
  options: RequestOptions = {},
): MockHttpContext<TReq> => ({
  req: httpMocks.createRequest<TReq>(options),
  res: httpMocks.createResponse<Response>(),
  next: jest.fn(),
});
