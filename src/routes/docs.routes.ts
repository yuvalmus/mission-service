import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenApiDocument } from '@docs/openapi.docs';
import { DOCS_ROUTES } from '@constants/app.constants';

export const createDocsRoutes = (): Router => {
  const router = Router();
  const document = generateOpenApiDocument();

  router.get(DOCS_ROUTES.OPENAPI_JSON, (_req, res) => {
    res.json(document);
  });
  router.use(DOCS_ROUTES.UI, swaggerUi.serve, swaggerUi.setup(document));

  return router;
};
