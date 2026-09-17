import { ZodTypeAny } from 'zod';
import { registry } from 'config/openapi.config';
import { ROUTES } from 'constants/app.constants';
import { HTTP_STATUS } from 'constants/http.constants';
import { CreateStakeDtoSchema, StakeDtoSchema } from 'dtos/stake.dtos';
import { ErrorDetailsDtoSchema } from 'dtos/mission.dtos';

const TAGS = { STAKES: 'Stakes' } as const;

const jsonContent = (schema: ZodTypeAny) => ({ 'application/json': { schema } });

const badRequestResponse = {
  [HTTP_STATUS.BAD_REQUEST]: {
    description: 'Validation or domain error',
    content: jsonContent(ErrorDetailsDtoSchema),
  },
} as const;

registry.registerPath({
  method: 'get',
  path: `${ROUTES.STAKES}/{patrickName}`,
  tags: [TAGS.STAKES],
  summary: 'Get (or initialize) the stake of a patrick',
  responses: {
    [HTTP_STATUS.OK]: { description: 'The stake', content: jsonContent(StakeDtoSchema) },
    ...badRequestResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: ROUTES.STAKES,
  tags: [TAGS.STAKES],
  summary: 'Create a stake with entities',
  request: { body: { content: jsonContent(CreateStakeDtoSchema) } },
  responses: {
    [HTTP_STATUS.OK]: { description: 'The created stake', content: jsonContent(StakeDtoSchema) },
    ...badRequestResponse,
  },
});

registry.registerPath({
  method: 'delete',
  path: `${ROUTES.STAKES}/{patrickName}`,
  tags: [TAGS.STAKES],
  summary: 'Delete all entities of a patrick stake',
  responses: {
    [HTTP_STATUS.OK]: { description: 'Stake entities deleted' },
    [HTTP_STATUS.NOT_FOUND]: { description: 'Stake not found' },
    ...badRequestResponse,
  },
});
