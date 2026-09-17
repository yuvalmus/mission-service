import { Request, RequestHandler, Response } from 'express';
import { EntityDefinition } from '@mappers/entity.registry';
import { routeToDto } from '@mappers/route.mapper';
import { EntityAdderService } from '@services/entity-adder.service';
import { RouteService } from '@services/route.service';
import { CreateOrUpdateRouteDto } from '@dtos/route.dtos';
import { HTTP_STATUS } from '@constants/http.constants';
import { validateCategoryPath } from '@utils/category.util';

export interface EntityCreatorController {
  createFor(definition: EntityDefinition): RequestHandler;
  createRoute(req: Request<unknown, unknown, CreateOrUpdateRouteDto>, res: Response): Promise<void>;
}

export const createEntityCreatorController = (
  entityAdder: EntityAdderService,
  routeService: RouteService,
): EntityCreatorController => ({
  createFor: (definition) => async (req, res) => {
    const dto = req.body as { category: string; parentId: string };
    validateCategoryPath(dto.category, req);
    const entity = definition.fromCreateDto(req.body);
    await entityAdder.addEntity(entity, dto.parentId);
    res.status(HTTP_STATUS.OK).json(definition.toDto(entity));
  },

  createRoute: async (req, res) => {
    validateCategoryPath(req.body.category, req);
    const route = await routeService.addRoute(req.body, req.body.parentId);
    res.status(HTTP_STATUS.OK).json(routeToDto(route));
  },
});
