import { Request, Response } from 'express';
import { HealthService } from '@services/health.service';
import { HTTP_STATUS } from '@constants/http.constants';
import { HEALTH_STATUS } from '@constants/app.constants';

export interface HealthController {
  healthz(req: Request, res: Response): void;
  readyz(req: Request, res: Response): Promise<void>;
}

export const createHealthController = (healthService: HealthService): HealthController => ({
  healthz: (_req, res) => {
    res.status(HTTP_STATUS.OK).json(healthService.liveness());
  },

  readyz: async (_req, res) => {
    const report = await healthService.readiness();
    const statusCode = report.status === HEALTH_STATUS.OK ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
    res.status(statusCode).json(report);
  },
});
