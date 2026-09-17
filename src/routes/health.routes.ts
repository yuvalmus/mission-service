import { Router } from 'express';
import { HealthController } from '@controllers/health.controller';
import { ROUTES } from '@constants/app.constants';

export const createHealthRoutes = (controller: HealthController): Router => {
  const router = Router();

  router.get(ROUTES.HEALTHZ, controller.healthz);
  router.get(ROUTES.READYZ, controller.readyz);

  return router;
};
