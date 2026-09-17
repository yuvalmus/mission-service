import { Request, RequestHandler, Response } from 'express';
import { EntityDefinition } from '@mappers/entity.registry';
import { routeToRetrieveDto, routeToRetrieveNavigationDto } from '@mappers/route.mapper';
import { EntityRetrieverService } from '@services/entity-retriever.service';
import { RouteService } from '@services/route.service';
import { EntityIdParams } from '@dtos/entity.dtos';
import { HTTP_STATUS } from '@constants/http.constants';

export interface EntityRetrieverController {
  getFor(definition: EntityDefinition): RequestHandler<EntityIdParams>;
  getRoute(req: Request<EntityIdParams>, res: Response): Promise<void>;
  getNavigationRoute(req: Request<EntityIdParams>, res: Response): Promise<void>;
}

export const createEntityRetrieverController = (
  entityRetriever: EntityRetrieverService,
  routeService: RouteService,
): EntityRetrieverController => ({
  getFor: (definition) => async (req, res) => {
    const entity = await entityRetriever.findEntityOfType(definition.entityType, req.params.id);
    if (!entity) {
      res.status(HTTP_STATUS.NOT_FOUND).send();
      return;
    }
    res.status(HTTP_STATUS.OK).json(definition.toDto(entity));
  },

  getRoute: async (req, res) => {
    const fullRoute = await routeService.getFullRoute(req.params.id);
    if (!fullRoute) {
      res.status(HTTP_STATUS.NOT_FOUND).send();
      return;
    }
    res.status(HTTP_STATUS.OK).json(routeToRetrieveDto(fullRoute.route, fullRoute.routeWpts));
  },

  getNavigationRoute: async (req, res) => {
    const fullRoute = await routeService.getFullRoute(req.params.id);
    if (!fullRoute) {
      res.status(HTTP_STATUS.NOT_FOUND).send();
      return;
    }
    res.status(HTTP_STATUS.OK).json(routeToRetrieveNavigationDto(fullRoute.route, fullRoute.routeWpts));
  },
});
