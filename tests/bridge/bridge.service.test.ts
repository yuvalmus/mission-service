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
  ({ NODE_NAME, MESH_PEERS: [{ name: PEER_NODE, host: 'station-b-postgres', port: 5432 }] }) as Env;

const buildRepository = (): jest.Mocked<SyncRepository> => ({
  getEntityDeltaSince: jest.fn(),
  getRenderLayer: jest.fn(),
  getSyncStatus: jest.fn(),
  getLocalCounters: jest.fn().mockResolvedValue([]),
});

interface StatusFeed {
  push(status: { type: string }): void;
  iterable: AsyncIterable<{ type: string }>;
}

const buildStatusFeed = (): StatusFeed => {
  const queued: Array<{ type: string }> = [];
  const waiting: Array<(result: IteratorResult<{ type: string }>) => void> = [];
  return {
    push: (status) => {
      const waiter = waiting.shift();
      if (waiter) waiter({ value: status, done: false });
      else queued.push(status);
    },
    iterable: {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          const status = queued.shift();
          return status
            ? Promise.resolve({ value: status, done: false })
            : new Promise<IteratorResult<{ type: string }>>((resolve) => waiting.push(resolve));
        },
      }),
    },
  };
};

interface NatsControls {
  published: PublishedMessage[];
  failNextPublish: boolean;
  status: StatusFeed;
}

const buildNats = (controls: NatsControls): NatsConnection =>
  ({
    jetstream: () => ({
      publish: (subject: string, data: Uint8Array, options?: { msgID?: string }) => {
        if (controls.failNextPublish) {
          controls.failNextPublish = false;
          return Promise.reject(new Error('nats down'));
        }
        controls.published.push({
          subject,
          payload: JSON.parse(new TextDecoder().decode(data)),
          msgID: options?.msgID,
        });
        return Promise.resolve({});
      },
    }),
    status: () => controls.status.iterable,
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
    nats: { published: [], failNextPublish: false, status: buildStatusFeed() } as NatsControls,
    bridges: [] as Array<{ stop(): Promise<void> }>,
  };

  beforeEach(() => {
    ctx.published = [];
    ctx.pgClient = buildPgClient();
    ctx.repository = buildRepository();
    ctx.nats = { published: ctx.published, failNextPublish: false, status: buildStatusFeed() };
    (readLastPublishedSeq as jest.Mock).mockResolvedValue(0);
  });

  afterEach(async () => {
    await Promise.all(ctx.bridges.splice(0).map((bridge) => bridge.stop()));
    jest.useRealTimers();
  });

  const startBridge = async () => {
    const bridge = createBridgeService({
      pgClient: ctx.pgClient,
      nats: buildNats(ctx.nats),
      syncRepository: ctx.repository,
      env: buildEnv(),
      logger: buildLogger(),
    });
    ctx.bridges.push(bridge);
    await bridge.start();
    return bridge;
  };

  const listened = () => (ctx.pgClient.query as jest.Mock).mock.calls.map(([sql]) => sql);

  const notify = async (channel: string, payload: string) => {
    ctx.pgClient.emit('notification', { channel, payload, processId: 1 });
    await flush();
  };

  it('subscribes to both database change channels', async () => {
    await startBridge();

    expect(listened()).toContain(`LISTEN ${PG_CHANNELS.ENTITY_CHANGES}`);
    expect(listened()).toContain(`LISTEN ${PG_CHANNELS.MISSION_CHANGES}`);
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

  describe('refill after an outage', () => {
    it('publishes one reload pulse for a parent the stream is behind on', async () => {
      ctx.repository.getLocalCounters.mockResolvedValue([{ parent_id: MISSION_ID, last_seq: '9' }]);
      (readLastPublishedSeq as jest.Mock).mockResolvedValue(5);

      await startBridge();

      expect(readLastPublishedSeq).toHaveBeenCalledWith(expect.anything(), buildEntitySubject(NODE_NAME, MISSION_ID));
      expect(ctx.published).toEqual([
        {
          subject: buildEntitySubject(NODE_NAME, MISSION_ID),
          payload: { type: DELTA_TYPES.RELOAD, parentId: MISSION_ID, originNode: NODE_NAME, lastChangeSeq: 9 },
          msgID: `reload-${MISSION_ID}-9`,
        },
      ]);
    });

    it('publishes nothing for a parent the stream already covers', async () => {
      ctx.repository.getLocalCounters.mockResolvedValue([{ parent_id: MISSION_ID, last_seq: '9' }]);
      (readLastPublishedSeq as jest.Mock).mockResolvedValue(9);

      await startBridge();

      expect(ctx.published).toHaveLength(0);
    });

    it('refills again when NATS reconnects', async () => {
      await startBridge();

      ctx.nats.status.push({ type: 'reconnect' });
      await flush();

      expect(ctx.repository.getLocalCounters).toHaveBeenCalledTimes(2);
    });

    it('ignores NATS status events other than a reconnect', async () => {
      await startBridge();

      ctx.nats.status.push({ type: 'disconnect' });
      await flush();

      expect(ctx.repository.getLocalCounters).toHaveBeenCalledTimes(1);
    });

    it('retries the refill with growing delays after a failed publish', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] });
      await startBridge();

      ctx.nats.failNextPublish = true;
      await notify(PG_CHANNELS.ENTITY_CHANGES, entityNotification());
      ctx.repository.getLocalCounters.mockRejectedValueOnce(new Error('nats down'));

      await jest.advanceTimersByTimeAsync(1_000);
      expect(ctx.repository.getLocalCounters).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1_999);
      expect(ctx.repository.getLocalCounters).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1);
      expect(ctx.repository.getLocalCounters).toHaveBeenCalledTimes(3);
    });

    it('resets the retry delay after a refill succeeds', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate'] });
      await startBridge();

      ctx.nats.failNextPublish = true;
      await notify(PG_CHANNELS.ENTITY_CHANGES, entityNotification());
      await jest.advanceTimersByTimeAsync(1_000);
      expect(ctx.repository.getLocalCounters).toHaveBeenCalledTimes(2);

      ctx.nats.failNextPublish = true;
      await notify(PG_CHANNELS.ENTITY_CHANGES, entityNotification());
      await jest.advanceTimersByTimeAsync(1_000);
      expect(ctx.repository.getLocalCounters).toHaveBeenCalledTimes(3);
    });

    it('listens before reading the counters, so a write during the refill still raises an event', async () => {
      await startBridge();

      const firstListen = (ctx.pgClient.query as jest.Mock).mock.invocationCallOrder[0] ?? Infinity;
      const firstCounterRead = ctx.repository.getLocalCounters.mock.invocationCallOrder[0] ?? -Infinity;
      expect(firstListen).toBeLessThan(firstCounterRead);
    });

    it('still starts listening when the first refill fails', async () => {
      ctx.repository.getLocalCounters.mockRejectedValueOnce(new Error('nats down'));

      await startBridge();

      expect(listened()).toContain(`LISTEN ${PG_CHANNELS.ENTITY_CHANGES}`);
    });
  });
});
