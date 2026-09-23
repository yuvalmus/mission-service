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

describe('sync.service', () => {
  const deps = { repository: buildRepository() };

  beforeEach(() => {
    deps.repository = buildRepository();
  });

  const service = () =>
    createSyncService({ syncRepository: deps.repository, nodeName: NODE_NAME, logger: buildLogger() });

  describe('getEntityDelta', () => {
    it('returns the highest sequence seen as the cursor to resume from', async () => {
      deps.repository.getEntityDeltaSince.mockResolvedValue([buildDeltaRow(3), buildDeltaRow(7)] as never);

      const delta = await service().getEntityDelta(MISSION_ID, 1, 500);

      expect(delta.sinceSeq).toBe(1);
      expect(delta.nextSeq).toBe(7);
      expect(delta.entities).toHaveLength(2);
    });

    it('keeps the caller cursor unchanged when nothing has changed', async () => {
      deps.repository.getEntityDeltaSince.mockResolvedValue([]);

      const delta = await service().getEntityDelta(MISSION_ID, 42, 500);

      expect(delta.nextSeq).toBe(42);
      expect(delta.hasMore).toBe(false);
    });

    it('signals more pages when the result fills the limit exactly', async () => {
      deps.repository.getEntityDeltaSince.mockResolvedValue([buildDeltaRow(3), buildDeltaRow(5)] as never);

      expect((await service().getEntityDelta(MISSION_ID, 0, 2)).hasMore).toBe(true);
    });

    it('converts BIGINT columns arriving as strings into numbers', async () => {
      deps.repository.getEntityDeltaSince.mockResolvedValue([buildDeltaRow(9)] as never);

      const [entity] = (await service().getEntityDelta(MISSION_ID, 0, 500)).entities;

      expect(entity?.changeSeq).toBe(9);
      expect(entity?.version).toBe(2);
    });

    it('marks an entity hidden by its parent being masked, not only by its own tombstone', async () => {
      deps.repository.getEntityDeltaSince.mockResolvedValue([
        buildDeltaRow(4, { is_deleted: false, is_hidden: true }),
      ] as never);

      const [entity] = (await service().getEntityDelta(MISSION_ID, 0, 500)).entities;

      expect(entity?.isDeleted).toBe(false);
      expect(entity?.isHidden).toBe(true);
    });
  });

  describe('getRenderLayer', () => {
    it('reports the sequence the snapshot is current as of, so polling can start from it', async () => {
      deps.repository.getRenderLayer.mockResolvedValue([buildDeltaRow(2), buildDeltaRow(11)] as never);

      expect((await service().getRenderLayer(MISSION_ID)).changeSeq).toBe(11);
    });

    it('reports sequence zero for an empty mission', async () => {
      deps.repository.getRenderLayer.mockResolvedValue([]);

      expect((await service().getRenderLayer(MISSION_ID)).changeSeq).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('reports the parent kind and high-water mark for this station', async () => {
      deps.repository.getSyncStatus.mockResolvedValue({
        parent_id: MISSION_ID,
        parent_kind: 'mission',
        is_deleted: false,
        last_change_seq: '17',
        entity_count: '4',
      });

      expect(await service().getStatus(MISSION_ID)).toEqual({
        parentId: MISSION_ID,
        parentKind: 'mission',
        isDeleted: false,
        lastChangeSeq: 17,
        entityCount: 4,
        node: NODE_NAME,
      });
    });

    it('reports zero rather than null for a parent that has no entities yet', async () => {
      deps.repository.getSyncStatus.mockResolvedValue({
        parent_id: MISSION_ID,
        parent_kind: 'mission',
        is_deleted: false,
        last_change_seq: null,
        entity_count: '0',
      });

      expect((await service().getStatus(MISSION_ID)).lastChangeSeq).toBe(0);
    });

    it('raises a not-found for an unknown parent', async () => {
      deps.repository.getSyncStatus.mockResolvedValue(null);

      await expect(service().getStatus(MISSION_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
