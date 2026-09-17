import { z, registry } from 'config/openapi.config';
import { ROUTES } from 'constants/app.constants';
import { HTTP_STATUS } from 'constants/http.constants';

const TAGS = { HEALTH: 'Health' } as const;

const HealthReportSchema = z
  .object({
    status: z.string(),
    service: z.string(),
    uptimeSeconds: z.number().int(),
    checks: z.object({ database: z.boolean() }).optional(),
  })
  .openapi('HealthReport');

registry.registerPath({
  method: 'get',
  path: ROUTES.HEALTHZ,
  tags: [TAGS.HEALTH],
  summary: 'Liveness probe',
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'Service is alive',
      content: { 'application/json': { schema: HealthReportSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: ROUTES.READYZ,
  tags: [TAGS.HEALTH],
  summary: 'Readiness probe (verifies database connectivity)',
  responses: {
    [HTTP_STATUS.OK]: {
      description: 'Service is ready',
      content: { 'application/json': { schema: HealthReportSchema } },
    },
    [HTTP_STATUS.SERVICE_UNAVAILABLE]: {
      description: 'A dependency is unavailable',
      content: { 'application/json': { schema: HealthReportSchema } },
    },
  },
});
