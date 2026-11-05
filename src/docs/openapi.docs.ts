import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from 'config/openapi.config';
import { SERVICE } from 'constants/app.constants';
import 'docs/mission.docs';
import 'docs/health.docs';
import 'docs/entity.docs';
import 'docs/stake.docs';
import { readFileSync } from 'fs';
import { join } from 'node:path';

interface PackageInfo {
  description?: string;
  version: string;
}

const readPackageInfo = (): PackageInfo =>
  JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as PackageInfo;

const OPENAPI_INFO = {
  OPENAPI_VERSION: '3.0.0',
  DESCRIPTION: 'A service for managing Missions and Entities'
} as const;

export const generateOpenApiDocument = () => {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const packageInfo = readPackageInfo();
  return generator.generateDocument({
    openapi: OPENAPI_INFO.OPENAPI_VERSION,
    info: {
      title: SERVICE.TITLE,
      version: packageInfo.version,
      description: packageInfo.description || OPENAPI_INFO.DESCRIPTION
    }
  });
};
