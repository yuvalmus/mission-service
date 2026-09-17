import { Request, RequestHandler, Response } from 'express';
import { EntityDefinition } from '@mappers/entity.registry';
import { routeToDto } from '@mappers/route.mapper';
import { EntityUpdaterService } from '@services/entity-updater.service';
import { RouteService } from '@services/route.service';
import { CreateOrUpdateRouteDto } from '@dtos/route.dtos';
import { UpdateBasicEntitiesDto, UpdateBasicEntityDto } from '@dtos/entity.dtos';
import { HTTP_STATUS } from '@constants/http.constants';
import { validateCategoryPath } from '@utils/category.util';

export interface EntityUpdaterController {
  updateFor(definition: EntityDefinition, validateCategory: boolean): RequestHandler;
  updateRoute(req: Request<unknown, unknown, CreateOrUpdateRouteDto>, res: Response): Promise<void>;
  changeEntityVisibility(req: Request<unknown, unknown, UpdateBasicEntityDto>, res: Response): Promise<void>;
  changeEntitiesVisibility(req: Request<unknown, unknown, UpdateBasicEntitiesDto>, res: Response): Promise<void>;
}

export const createEntityUpdaterController = (
  entityUpdater: EntityUpdaterService,
  routeService: RouteService,
): EntityUpdaterController => ({
  updateFor: (definition, validateCategory) => async (req, res) => {
    const dto = req.body as { id: string; parentId: string; category: string };
    if (validateCategory) {
      validateCategoryPath(dto.category, req);
    }
    const updated = await entityUpdater.updateByType(definition.entityType, dto);
    res.status(HTTP_STATUS.OK).json(definition.toDto(updated));
  },

  updateRoute: async (req, res) => {
    validateCategoryPath(req.body.category, req);
    const route = await routeService.updateRoute(req.body);
    res.status(HTTP_STATUS.OK).json(routeToDto(route));
  },

  changeEntityVisibility: async (req, res) => {
    const changed = await entityUpdater.changeEntityVisibility(req.body);
    res.status(HTTP_STATUS.OK).json(changed);
  },

  changeEntitiesVisibility: async (req, res) => {
    const changed = await entityUpdater.changeEntitiesVisibility(req.body);
    res.status(HTTP_STATUS.OK).json(changed);
  },
});
