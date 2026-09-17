import { Router } from 'express';
import { StakeController } from 'controllers/stake.controller';
import { validate } from 'middlewares/validation.middleware';
import { CreateStakeDtoSchema, PatrickParamsSchema } from 'dtos/stake.dtos';

const STAKE_ROUTES = {
  ROOT: '/',
  BY_PATRICK: '/:patrickName',
} as const;

export const createStakeRoutes = (controller: StakeController): Router => {
  const router = Router();

  router.get(STAKE_ROUTES.BY_PATRICK, validate({ params: PatrickParamsSchema }), controller.getStakeOfPatrick);
  router.post(STAKE_ROUTES.ROOT, validate({ body: CreateStakeDtoSchema }), controller.createStake);
  router.delete(STAKE_ROUTES.BY_PATRICK, validate({ params: PatrickParamsSchema }), controller.deleteStakeEntities);

  return router;
};
