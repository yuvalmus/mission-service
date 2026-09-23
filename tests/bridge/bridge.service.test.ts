import { EventEmitter } from 'node:events';
import { Client } from 'pg';
import { NatsConnection } from 'nats';
import { Env } from 'config/env.config';
import { buildEntitySubject, buildLifecycleSubject, DELTA_TYPES } from 'constants/nats.constants';
import { PG_CHANNELS } from 'constants/postgres.constants';
import { SyncRepository } from 'repositories/postgres/sync.repository';
import { createBridgeService } from 'bridge/bridge.service';
import { MISSION_ID } from '../fixtures/mission.fixtures';
import { NODE_NAME } from '../fixtures/postgres.fixtures';

const PEER_NODE = 'station-b';
const ENTITY_ID = '11111111-2222-4333-8444-555555555555';

jest.mock('bridge/nats.streams', () => ({
  readLastPublishedSeq: jest.fn().mockResolvedValue(0),
  setupStreams: jest.fn(),
}));

import { readLastPublishedSeq } from 'bridge/nats.streams';

interface PublishedMessage {
  subject: string;
  payload: Record<string, unknown>;
  msgID?: string;
}

const buildLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
}) as never;

const buildEnv = (): Env =>
  ({ NODE_NAME, PEER_NODE_NAME: PEER_NODE }) as Env;

const buildRepository = (): jest.Mocked<SyncRepository> => ({
  getEntityDeltaSince: jest.fn(),
  getRenderLayer: jest.fn(),
  getSyncStatus: jest.fn(),
  getLocalChangesSince: jest.fn().mockResolvedValue([]),
});

const buildNats = (published: PublishedMessage[]): NatsConnection =>
  ({
    jetstream: () => ({
      publish: (subject: string, data: Uint8Array, options?: { msgID?: string }) => {
        published.push({
          subject,
          payload: JSON.parse(new TextDecoder().decode(data)),
          msgID: options?.msgID,
        });
        return Promise.resolve({});
      },
    }),
    drain: () => Promise.resolve(),
  }) as unknown as NatsConnection;

const buildPgClient = () => {
  const emitter = new EventEmitter() as EventEmitter & Client;
  Object.assign(emitter, {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined),
  });
  return emitter;
};

const entityNotification = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'changed',
    mission_id: MISSION_ID,
    infra_id: null,
    parent_id: MISSION_ID,
    entity_id: ENTITY_ID,
    entity_type: 'circle',
    version: 4,
    last_change_seq: 9,
    is_deleted: false,
    origin_node: NODE_NAME,
    ...overrides,
  });

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('bridge.service', () => {
  const ctx = {
    published: [] as PublishedMessage[],
    pgClient: buildPgClient(),
    repository: buildRepository(),
  };

  beforeEach(() => {
    ctx.published = [];
    ctx.pgClient = buildPgClient();
    ctx.repository = buildRepository();
    (readLastPublishedSeq as jest.Mock).mockResolvedValue(0);
  });

  const startBridge = async () => {
    const bridge = createBridgeService({
      pgClient: ctx.pgClient,
      nats: buildNats(ctx.published),
      syncRepository: ctx.repository,
      env: buildEnv(),
      logger: buildLogger(),
    });
    await bridge.start();
    return bridge;
  };

  const notify = async (channel: string, payload: string) => {
    ctx.pgClient.emit('notification', { channel, payload, processId: 1 });
    await flush();
  };

  it('subscribes to both database change channels', async () => {
    await startBridge();

    const listened = (ctx.pgClient.query as jest.Mock).mock.calls.map(([sql]) => sql);
    expect(listened).toContain(`LISTEN ${PG_CHANNELS.ENTITY_CHANGES}`);
    expect(listened).toContain(`LISTEN ${PG_CHANNELS.MISSION_CHANGES}`);
  });

  it('publishes a local change onto the mission-scoped subject', async () => {
    await startBridge();
    await notify(PG_CHANNELS.ENTITY_CHANGES, entityNotification());

    expect(ctx.published).toHaveLength(1);
    expect(ctx.published[0]?.subject).toBe(buildEntitySubject(NODE_NAME, MISSION_ID));
    expect(ctx.published[0]?.payload).toMatchObject({
      type: DELTA_TYPES.CHANGED,
      entityId: ENTITY_ID,
      lastChangeSeq: 9,
      isDeleted: false,
    });
  });

  it('uses entity and version as the deduplication id', async () => {
    await startBridge();
    await notify(PG_CHANNELS.ENTITY_CHANGES, entityNotification());

    expect(ctx.published[0]?.msgID).toBe(`${ENTITY_ID}-4`);
  });

  it('ignores a change that originated on the peer, which arrives through the mirror instead', async () => {
    await startBridge();
    await notify(PG_CHANNELS.ENTITY_CHANGES, entityNotification({ origin_node: PEER_NODE }));

    expect(ctx.published).toHaveLength(0);
  });

  it('publishes a tombstone so peers learn to remove the entity', async () => {
    await startBridge();
    await notify(PG_CHANNELS.ENTITY_CHANGES, entityNotification({ is_deleted: true }));

    expect(ctx.published[0]?.payload).toMatchObject({ isDeleted: true });
  });

  it('falls back to the infra parent for an entity that belongs to a stake', async () => {
    const stakeId = '9f8e7d6c-5555-4444-8333-222211110000';
    await startBridge();
    await notify(
      PG_CHANNELS.ENTITY_CHANGES,
      entityNotification({ mission_id: null, infra_id: stakeId, parent_id: stakeId }),
    );

    expect(ctx.published[0]?.subject).toBe(buildEntitySubject(NODE_NAME, stakeId));
  });

  it('publishes mission lifecycle changes on their own subject', async () => {
    await startBridge();
    await notify(
      PG_CHANNELS.MISSION_CHANGES,
      JSON.stringify({
        id: MISSION_ID,
        name: 'Operation Alpha',
        version_number: 2,
        created_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
        origin_node: NODE_NAME,
        operation: 'updated',
      }),
    );

    expect(ctx.published[0]?.subject).toBe(buildLifecycleSubject(NODE_NAME, MISSION_ID));
    expect(ctx.published[0]?.payload).toMatchObject({ missionId: MISSION_ID, operation: 'updated' });
  });

  describe('catch-up after downtime', () => {
    it('replays local changes above the last sequence that reached the stream', async () => {
      (readLastPublishedSeq as jest.Mock).mockResolvedValue(5);
      ctx.repository.getLocalChangesSince.mockResolvedValueOnce([
        {
          entity_id: ENTITY_ID,
          parent_id: MISSION_ID,
          entity_type: 'circle',
          version: '3',
          mission_change_seq: '7',
          is_deleted: false,
          origin_node: NODE_NAME,
        },
      ]);

      await startBridge();

      expect(ctx.repository.getLocalChangesSince).toHaveBeenCalledWith(5, NODE_NAME, expect.any(Number));
      expect(ctx.published).toHaveLength(1);
      expect(ctx.published[0]?.payload).toMatchObject({ lastChangeSeq: 7 });
    });

    it('publishes nothing when the stream is already up to date', async () => {
      (readLastPublishedSeq as jest.Mock).mockResolvedValue(12);

      await startBridge();

      expect(ctx.published).toHaveLength(0);
    });
  });
});
