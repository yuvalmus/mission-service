import { Request, Response } from 'express';
import { HTTP_STATUS } from 'constants/http.constants';
import { EntityDeltaQuery, SyncParentQuery } from 'dtos/sync.dtos';
import { SyncService } from 'services/sync.service';

export interface SyncController {
  getEntityDelta(req: Request, res: Response): Promise<void>;
  getRenderLayer(req: Request, res: Response): Promise<void>;
  getStatus(req: Request, res: Response): Promise<void>;
}

export const createSyncController = (syncService: SyncService): SyncController => ({
  getEntityDelta: async (req, res) => {
    const { parentId, sinceSeq, limit } = req.query as unknown as EntityDeltaQuery;
    res.status(HTTP_STATUS.OK).json(await syncService.getEntityDelta(parentId, sinceSeq, limit));
  },

  getRenderLayer: async (req, res) => {
    const { parentId } = req.query as unknown as SyncParentQuery;
    res.status(HTTP_STATUS.OK).json(await syncService.getRenderLayer(parentId));
  },

  getStatus: async (req, res) => {
    const { parentId } = req.query as unknown as SyncParentQuery;
    res.status(HTTP_STATUS.OK).json(await syncService.getStatus(parentId));
  },
});
