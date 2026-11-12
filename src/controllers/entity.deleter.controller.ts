import { Request, RequestHandler, Response } from 'express';
import { EntityType } from 'constants/entity.constants';
import { EntityDeleterService } from 'services/entity.deleter.service';
import { DeleteEntityParams } from 'dtos/commonEntity.dtos';
import { HTTP_STATUS } from 'constants/http.constants';
import { isStakePath } from 'utils/category.util';

export interface EntityDeleterController {
  deleteEntity(entityType: EntityType): RequestHandler<DeleteEntityParams>;
  deleteRoute(req: Request<DeleteEntityParams>, res: Response): Promise<void>;
}

export const createEntityDeleterController = (
  entityDeleter: EntityDeleterService
): EntityDeleterController => ({
  deleteEntity: entityType => async (req, res) => {
    const deleted = await entityDeleter.deleteEntity(
      entityType,
      req.params.mission,
      req.params.id,
      isStakePath(req)
    );
    res.status(deleted ? HTTP_STATUS.NO_CONTENT : HTTP_STATUS.NOT_FOUND).send();
  },

  deleteRoute: async (req, res) => {
    const deleted = await entityDeleter.deleteRoute(
      req.params.mission,
      req.params.id,
      isStakePath(req)
    );
    res.status(deleted ? HTTP_STATUS.NO_CONTENT : HTTP_STATUS.NOT_FOUND).send();
  }
});
