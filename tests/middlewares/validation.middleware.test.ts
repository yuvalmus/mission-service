import { z } from 'zod';
import { validate } from '@middlewares/validation.middleware';
import { BadRequestError } from '@errors/app.errors';
import { createHttpContext } from '../fixtures/express.fixtures';

describe('validation.middleware', () => {
  const BodySchema = z.object({ name: z.string().min(1), count: z.coerce.number().int() });
  const ParamsSchema = z.object({ id: z.string().uuid() });

  it('calls next and replaces the body with parsed data on success', () => {
    const { req, res, next } = createHttpContext({ body: { name: 'alpha', count: '5' } });

    validate({ body: BodySchema })(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'alpha', count: 5 });
  });

  it('validates multiple request parts in one call', () => {
    const { req, res, next } = createHttpContext({
      body: { name: 'alpha', count: 2 },
      params: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' },
    });

    validate({ body: BodySchema, params: ParamsSchema })(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('throws BadRequestError naming the invalid part and field', () => {
    const { req, res, next } = createHttpContext({ body: { name: '', count: 'not-a-number' } });

    expect(() => validate({ body: BodySchema })(req, res, next)).toThrow(BadRequestError);
    expect(next).not.toHaveBeenCalled();
  });

  it('reports the offending path inside the error message', () => {
    const { req, res, next } = createHttpContext({ params: { id: 'not-a-uuid' } });

    expect(() => validate({ params: ParamsSchema })(req, res, next)).toThrow(/params\.id/);
  });

  it('ignores request parts without a schema', () => {
    const { req, res, next } = createHttpContext({ body: { anything: true } });

    validate({})(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ anything: true });
  });
});
