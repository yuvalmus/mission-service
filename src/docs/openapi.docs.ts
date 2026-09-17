import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from '@config/openapi.config';
import { SERVICE } from '@constants/app.constants';
import '@docs/mission.docs';
import '@docs/health.docs';
import '@docs/entity.docs';
import '@docs/stake.docs';

const OPENAPI_INFO = {
  OPENAPI_VERSION: '3.0.0',
  VERSION: '1.0.0',
  DESCRIPTION: 'A service for managing Missions and Entities',
} as const;

export const generateOpenApiDocument = () => {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: OPENAPI_INFO.OPENAPI_VERSION,
    info: {
      title: SERVICE.TITLE,
      version: OPENAPI_INFO.VERSION,
      description: OPENAPI_INFO.DESCRIPTION,
    },
  });
};
