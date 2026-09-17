import { Router } from 'express';
import { StakeController } from '@controllers/stake.controller';
import { validate } from '@middlewares/validation.middleware';
import { CreateStakeDtoSchema, SquadronParamsSchema } from '@dtos/stake.dtos';

const STAKE_ROUTES = {
  ROOT: '/',
  BY_SQUADRON: '/:squadronName',
} as const;

export const createStakeRoutes = (controller: StakeController): Router => {
  const router = Router();

  router.get(STAKE_ROUTES.BY_SQUADRON, validate({ params: SquadronParamsSchema }), controller.getStakeOfSquadron);
  router.post(STAKE_ROUTES.ROOT, validate({ body: CreateStakeDtoSchema }), controller.createStake);
  router.delete(STAKE_ROUTES.BY_SQUADRON, validate({ params: SquadronParamsSchema }), controller.deleteStakeEntities);

  return router;
};
