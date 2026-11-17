import { NotFoundError } from 'errors/app.errors';
import { SyncRepository } from 'repositories/postgres/sync.repository';
import { createSyncService } from 'services/sync.service';
import { MISSION_ID } from '../fixtures/mission.fixtures';
import { NODE_NAME } from '../fixtures/postgres.fixtures';

const buildLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
}) as never;

const buildRepository = (): jest.Mocked<SyncRepository> => ({
  getEntityDeltaSince: jest.fn(),
  getRenderLayer: jest.fn(),
  getSyncStatus: jest.fn(),
  getLocalChangesSince: jest.fn(),
});

const buildDeltaRow = (seq: number, overrides: Record<string, unknown> = {}) => ({
  entity_id: `00000000-0000-4000-8000-00000000000${seq}`,
  parent_id: MISSION_ID,
  entity_type: 'circle',
  name: 'C001',
  category: 'general',
  geometry: { type: 'Point', coordinates: [34, 32] },
  properties: {},
  version: '2',
  mission_change_seq: String(seq),
  schema_version: 1,
  is_deleted: false,
  is_hidden: false,
  origin_node: NODE_NAME,
  last_update_time: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildStatusRow = (clock: Record<string, string | number> | null) => ({
  parent_id: MISSION_ID,
  parent_kind: 'mission',
  is_deleted: false,
  clock,
  entity_count: '4',
});

describe('sync.service', () => {
  const deps = { repository: buildRepository() };

  beforeEach(() => {
    deps.repository = buildRepository();
  });

  const service = () =>
    createSyncService({ syncRepository: deps.repository, nodeName: NODE_NAME, logger: buildLogger() });

  describe('getEntityDelta', () => {
    it('raises each station in the clock to the highest number returned for it', async () => {
      deps.repository.getEntityDeltaSince.mockResolvedValue([
        buildDeltaRow(3, { origin_node: 'station-a' }),
        buildDeltaRow(7, { origin_node: 'station-a' }),
        buildDeltaRow(2, { origin_node: 'station-b' }),
      ] as never);

      const delta = await service().getEntityDelta(MISSION_ID, { 'station-a': 1, 'station-c': 9 }, 500);

      expect(deps.repository.getEntityDeltaSince).toHaveBeenCalledWith(
        MISSION_ID,
        { 'station-a': 1, 'station-c': 9 },
        500,
      );
      expect(delta.clock).toEqual({ 'station-a': 7, 'station-b': 2, 'station-c': 9 });
    });

    it('keeps the caller clock unchanged when nothing has changed', async () => {
      deps.repository.getEntityDeltaSince.mockResolvedValue([]);

      const delta = await service().getEntityDelta(MISSION_ID, { 'station-a': 42 }, 500);

      expect(delta.clock).toEqual({ 'station-a': 42 });
      expect(delta.hasMore).toBe(false);
    });

    it('reports another page when the page is full', async () => {
      deps.repository.getEntityDeltaSince.mockResolvedValue([buildDeltaRow(1), buildDeltaRow(2)] as never);

      expect((await service().getEntityDelta(MISSION_ID, {}, 2)).hasMore).toBe(true);
    });

    it('converts BIGINT columns arriving as strings into numbers', async () => {
      deps.repository.getEntityDeltaSince.mockResolvedValue([buildDeltaRow(9)] as never);

      const [entity] = (await service().getEntityDelta(MISSION_ID, {}, 500)).entities;

      expect(entity?.changeSeq).toBe(9);
      expect(entity?.version).toBe(2);
    });

    it('marks an entity hidden by its parent being masked, not only by its own tombstone', async () => {
      deps.repository.getEntityDeltaSince.mockResolvedValue([
        buildDeltaRow(4, { is_deleted: false, is_hidden: true }),
      ] as never);

      const [entity] = (await service().getEntityDelta(MISSION_ID, {}, 500)).entities;

      expect(entity?.isDeleted).toBe(false);
      expect(entity?.isHidden).toBe(true);
    });
  });

  describe('getRenderLayer', () => {
    it('takes the render clock from the same rows it returns', async () => {
      deps.repository.getRenderLayer.mockResolvedValue([
        buildDeltaRow(4, { origin_node: 'station-a' }),
        buildDeltaRow(6, { origin_node: 'station-b' }),
      ] as never);

      expect((await service().getRenderLayer(MISSION_ID)).clock).toEqual({ 'station-a': 4, 'station-b': 6 });
    });

    it('reports an empty render clock for an empty mission', async () => {
      deps.repository.getRenderLayer.mockResolvedValue([]);

      expect((await service().getRenderLayer(MISSION_ID)).clock).toEqual({});
    });
  });

  describe('getStatus', () => {
    it('reports the database clock per station in the status', async () => {
      deps.repository.getSyncStatus.mockResolvedValue(buildStatusRow({ 'station-a': '12', 'station-b': 3 }));

      expect(await service().getStatus(MISSION_ID)).toEqual({
        parentId: MISSION_ID,
        parentKind: 'mission',
        isDeleted: false,
        clock: { 'station-a': 12, 'station-b': 3 },
        entityCount: 4,
        node: NODE_NAME,
      });
    });

    it('reports an empty clock for a parent with no entities', async () => {
      deps.repository.getSyncStatus.mockResolvedValue(buildStatusRow(null));

      expect((await service().getStatus(MISSION_ID)).clock).toEqual({});
    });

    it('raises a not-found for an unknown parent', async () => {
      deps.repository.getSyncStatus.mockResolvedValue(null);

      await expect(service().getStatus(MISSION_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
