import { HTTP_STATUS } from 'constants/http.constants';
import { createSyncController } from 'controllers/sync.controller';
import { EntityDeltaDto } from 'dtos/sync.dtos';
import { createHttpContext } from '../fixtures/express.fixtures';
import { MISSION_ID } from '../fixtures/mission.fixtures';

const ENTITY_ID = '1a2b3c4d-1111-4222-8333-444455556666';

const buildDelta = (entities: EntityDeltaDto['entities']): EntityDeltaDto => ({
  parentId: MISSION_ID,
  clock: { 'station-a': 3 },
  hasMore: false,
  entities,
});

describe('sync.controller', () => {
  const service = { getEntityDelta: jest.fn(), getRenderLayer: jest.fn(), getStatus: jest.fn() };
  const controller = createSyncController(service);

  const request = () => {
    const context = createHttpContext({ query: { parentId: MISSION_ID, clock: { 'station-a': 3 }, limit: 500 } as never });
    jest.spyOn(context.res, 'json');
    return context;
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('answers 304 with no body when nothing changed', async () => {
    service.getEntityDelta.mockResolvedValue(buildDelta([]));
    const { req, res } = request();

    await controller.getEntityDelta(req, res);

    expect(service.getEntityDelta).toHaveBeenCalledWith(MISSION_ID, { 'station-a': 3 }, 500);
    expect(res.statusCode).toBe(HTTP_STATUS.NOT_MODIFIED);
    expect(res._isEndCalled()).toBe(true);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('answers 200 with the page when something changed', async () => {
    const delta = buildDelta([
      {
        entityId: ENTITY_ID,
        parentId: MISSION_ID,
        entityType: 'circle',
        name: 'C001',
        category: null,
        geometry: null,
        properties: {},
        version: 2,
        changeSeq: 4,
        schemaVersion: 1,
        isDeleted: false,
        isHidden: false,
        originNode: 'station-a',
        lastUpdateTime: new Date('2026-11-17T10:00:00.000Z'),
      },
    ]);
    service.getEntityDelta.mockResolvedValue(delta);
    const { req, res } = request();

    await controller.getEntityDelta(req, res);

    expect(res.statusCode).toBe(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith(delta);
  });
});
