import { DatabaseClient } from 'database/database.types';
import { HEALTH_STATUS } from 'constants/app.constants';

export interface HealthReport {
  status: (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];
  service: string;
  uptimeSeconds: number;
  checks: {
    database: boolean;
  };
}

export interface HealthService {
  liveness(): Pick<HealthReport, 'status' | 'service' | 'uptimeSeconds'>;
  readiness(): Promise<HealthReport>;
}

export interface HealthServiceDeps {
  databaseClient: DatabaseClient;
  serviceName: string;
}

export const createHealthService = ({
  databaseClient,
  serviceName
}: HealthServiceDeps): HealthService => {
  const liveness = (): Pick<HealthReport, 'status' | 'service' | 'uptimeSeconds'> => ({
    status: HEALTH_STATUS.OK,
    service: serviceName,
    uptimeSeconds: Math.round(process.uptime())
  });

  const readiness = async (): Promise<HealthReport> => {
    const databaseHealthy = await databaseClient.ping();
    return {
      status: databaseHealthy ? HEALTH_STATUS.OK : HEALTH_STATUS.UNAVAILABLE,
      service: serviceName,
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        database: databaseHealthy
      }
    };
  };

  return {
    liveness,
    readiness
  };
};
