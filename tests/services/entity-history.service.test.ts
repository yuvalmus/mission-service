import { ERROR_MESSAGES } from 'constants/error.constants';
import { NotFoundError } from 'errors/app.errors';
import { createEntityHistoryService } from 'services/entity-history.service';

const ENTITY_ID = '1a2b3c4d-1111-4222-8333-444455556666';
const EVENT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const TIME = new Date('2026-11-17T10:00:00.000Z');

const buildLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
}) as never;

describe('entity history service', () => {
  const repo = { listVersions: jest.fn(), restoreVersion: jest.fn(), duplicateFromVersion: jest.fn() };

  const service = () =>
    createEntityHistoryService({
      historyRepository: repo,
      unitOfWork: { run: (work) => work({ raw: {} } as never) },
      nodeName: 'station-a',
      logger: buildLogger(),
    });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('maps a stored version to its dto', async () => {
    repo.listVersions.mockResolvedValue([
      {
        event_id: EVENT_ID,
        entity_id: ENTITY_ID,
        version: '5',
        entity_type: 'circle',
        origin_node: 'station-b',
        mission_change_seq: '12',
        last_update_time: TIME,
        is_deleted: false,
        is_current: true,
        geometry: null,
        properties: {},
      },
    ]);

    expect(await service().listVersions(ENTITY_ID)).toEqual([
      {
        eventId: EVENT_ID,
        entityId: ENTITY_ID,
        version: 5,
        entityType: 'circle',
        originNode: 'station-b',
        changeSeq: 12,
        lastUpdateTime: TIME,
        isDeleted: false,
        isCurrent: true,
        geometry: null,
        properties: {},
      },
    ]);
  });

  it('answers 404 when the event is not a version of the entity', async () => {
    repo.restoreVersion.mockResolvedValue(false);

    await expect(service().restoreVersion(ENTITY_ID, EVENT_ID)).rejects.toThrow(
      new NotFoundError(ERROR_MESSAGES.ENTITY_BACKUP_NOT_FOUND(ENTITY_ID, EVENT_ID)),
    );
  });
});
