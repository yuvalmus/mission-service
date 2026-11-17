import { Request, Response } from 'express';
import { HTTP_STATUS } from 'constants/http.constants';
import { EntityHistoryService } from 'services/entity-history.service';

export interface EntityHistoryController {
  listVersions(req: Request, res: Response): Promise<void>;
  restoreVersion(req: Request, res: Response): Promise<void>;
  duplicateFromVersion(req: Request, res: Response): Promise<void>;
}

const readName = (body: unknown): string | null => {
  const name = (body as { name?: unknown } | undefined)?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
};

export const createEntityHistoryController = (
  historyService: EntityHistoryService,
): EntityHistoryController => ({
  listVersions: async (req, res) => {
    const versions = await historyService.listVersions(req.params.entityId as string);
    res.status(HTTP_STATUS.OK).json(versions);
  },

  restoreVersion: async (req, res) => {
    const entityId = req.params.entityId as string;
    const eventId = req.params.eventId as string;
    await historyService.restoreVersion(entityId, eventId);
    res.status(HTTP_STATUS.OK).json({ entityId, eventId });
  },

  duplicateFromVersion: async (req, res) => {
    const entityId = req.params.entityId as string;
    const eventId = req.params.eventId as string;
    const createdId = await historyService.duplicateFromVersion(entityId, eventId, readName(req.body));
    res.status(HTTP_STATUS.CREATED).json({ entityId: createdId, sourceEntityId: entityId, eventId });
  },
});
