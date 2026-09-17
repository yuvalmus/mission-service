import { RequestHandler } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { BadRequestError } from '@errors/app.errors';
import { ERROR_MESSAGES } from '@constants/error.constants';

const REQUEST_PARTS = ['params', 'query', 'body'] as const;

type RequestPart = (typeof REQUEST_PARTS)[number];

export type ValidationSchemas = Partial<Record<RequestPart, ZodTypeAny>>;

const formatZodError = (part: RequestPart, error: ZodError): string =>
  error.issues
    .map((issue) => `${part}${issue.path.length ? `.${issue.path.join('.')}` : ''}: ${issue.message}`)
    .join('; ');

export const validate = (schemas: ValidationSchemas): RequestHandler => (req, _res, next) => {
  REQUEST_PARTS.forEach((part) => {
    const schema = schemas[part];
    if (!schema) return;

    const result = schema.safeParse(req[part]);
    if (!result.success) {
      throw new BadRequestError(`${ERROR_MESSAGES.VALIDATION_FAILED}: ${formatZodError(part, result.error)}`);
    }
    Object.assign(req, { [part]: result.data });
  });

  next();
};
