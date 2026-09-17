import { createHealthController } from 'controllers/health.controller';
import { HealthService } from 'services/health.service';
import { HTTP_STATUS } from 'constants/http.constants';
import { HEALTH_STATUS, SERVICE } from 'constants/app.constants';
import { createHttpContext } from '../fixtures/express.fixtures';

describe('health.controller', () => {
  const healthService: jest.Mocked<HealthService> = {
    liveness: jest.fn(),
    readiness: jest.fn(),
  };
  const controller = createHealthController(healthService);

  describe('healthz', () => {
    it('returns 200 with the liveness report', () => {
      healthService.liveness.mockReturnValue({
        status: HEALTH_STATUS.OK,
        service: SERVICE.NAME,
        uptimeSeconds: 12,
      });
      const { req, res } = createHttpContext();

      controller.healthz(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData()).toEqual({ status: HEALTH_STATUS.OK, service: SERVICE.NAME, uptimeSeconds: 12 });
    });
  });

  describe('readyz', () => {
    it('returns 200 when the database is reachable', async () => {
      healthService.readiness.mockResolvedValue({
        status: HEALTH_STATUS.OK,
        service: SERVICE.NAME,
        uptimeSeconds: 12,
        checks: { database: true },
      });
      const { req, res } = createHttpContext();

      await controller.readyz(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.OK);
      expect(res._getJSONData().checks).toEqual({ database: true });
    });

    it('returns 503 when the database is unreachable', async () => {
      healthService.readiness.mockResolvedValue({
        status: HEALTH_STATUS.UNAVAILABLE,
        service: SERVICE.NAME,
        uptimeSeconds: 12,
        checks: { database: false },
      });
      const { req, res } = createHttpContext();

      await controller.readyz(req, res);

      expect(res.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    });
  });
});
