import { Client, Notification } from 'pg';
import { Events, JetStreamClient, NatsConnection, StringCodec } from 'nats';
import { Env } from 'config/env.config';
import {
  BRIDGE_LIMITS,
  buildEntitySubject,
  buildLifecycleSubject,
  DELTA_TYPES,
} from 'constants/nats.constants';
import { PG_CHANNELS } from 'constants/postgres.constants';
import { SyncRepository } from 'repositories/postgres/sync.repository';
import { readLastPublishedSeq } from 'bridge/nats.streams';
import { AppLogger } from 'utils/logger.util';

export interface BridgeService {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface BridgeServiceDeps {
  pgClient: Client;
  nats: NatsConnection;
  syncRepository: SyncRepository;
  env: Env;
  logger: AppLogger;
}

interface EntityChangeNotification {
  mission_id: string | null;
  infra_id: string | null;
  parent_id: string | null;
  entity_id: string;
  entity_type: string;
  version: number;
  last_change_seq: number;
  is_deleted: boolean;
  origin_node: string;
}

interface MissionChangeNotification {
  id: string;
  name: string;
  version_number: number;
  created_at: string;
  deleted_at: string | null;
  origin_node: string;
  operation: string;
}

export interface EntityDeltaEvent {
  type: string;
  parentId: string;
  entityId: string;
  entityType: string;
  version: number;
  lastChangeSeq: number;
  isDeleted: boolean;
  originNode: string;
}

export interface EntityReloadEvent {
  type: typeof DELTA_TYPES.RELOAD;
  parentId: string;
  originNode: string;
  lastChangeSeq: number;
}

const codec = StringCodec();

/**
 * Deterministic message id, so the broker can collapse a repeat rather than letting a duplicate
 * reach the map. An entity at a given version is one immutable fact, which makes
 * `<entity>-<version>` the natural identity.
 */
const buildMessageId = (entityId: string, version: number): string => `${entityId}-${version}`;

const buildReloadMessageId = (parentId: string, lastChangeSeq: number): string =>
  `reload-${parentId}-${lastChangeSeq}`;

export const createBridgeService = ({
  pgClient,
  nats,
  syncRepository,
  env,
  logger,
}: BridgeServiceDeps): BridgeService => {
  const js: JetStreamClient = nats.jetstream();
  const retry: { handle: NodeJS.Timeout | null; delayMs: number; stopped: boolean } = {
    handle: null,
    delayMs: BRIDGE_LIMITS.REFILL_RETRY_MIN_MS,
    stopped: false,
  };

  const publishEntityChange = async (event: EntityDeltaEvent): Promise<void> => {
    await js.publish(
      buildEntitySubject(env.NODE_NAME, event.parentId),
      codec.encode(JSON.stringify(event)),
      { msgID: buildMessageId(event.entityId, event.version) },
    );
  };

  const handleEntityChange = async (raw: string): Promise<void> => {
    const payload = JSON.parse(raw) as EntityChangeNotification;
    const parentId = payload.parent_id ?? payload.mission_id ?? payload.infra_id;
    if (!parentId) return;

    /**
     * Only changes authored here are published. The notify trigger fires for rows applied by
     * pglogical too, so without this filter both stations would announce the same change and the
     * mesh would carry every event twice.
     */
    if (payload.origin_node !== env.NODE_NAME) return;

    await publishEntityChange({
      type: DELTA_TYPES.CHANGED,
      parentId,
      entityId: payload.entity_id,
      entityType: payload.entity_type,
      version: payload.version,
      lastChangeSeq: payload.last_change_seq,
      isDeleted: payload.is_deleted,
      originNode: payload.origin_node,
    });
  };

  const handleMissionChange = async (raw: string): Promise<void> => {
    const payload = JSON.parse(raw) as MissionChangeNotification;
    if (payload.origin_node !== env.NODE_NAME) return;

    await js.publish(
      buildLifecycleSubject(env.NODE_NAME, payload.id),
      codec.encode(
        JSON.stringify({
          missionId: payload.id,
          name: payload.name,
          versionNumber: payload.version_number,
          createdAt: payload.created_at,
          deletedAt: payload.deleted_at,
          operation: payload.operation,
          originNode: payload.origin_node,
        }),
      ),
      { msgID: `mission-${payload.id}-${payload.version_number}-${payload.deleted_at ?? 'active'}` },
    );
  };

  const onNotification = (message: Notification): void => {
    if (!message.payload) return;

    const handler =
      message.channel === PG_CHANNELS.ENTITY_CHANGES
        ? handleEntityChange
        : message.channel === PG_CHANNELS.MISSION_CHANGES
          ? handleMissionChange
          : null;

    handler?.(message.payload).catch((error) => {
      logger.error({ err: error, channel: message.channel }, 'Failed to relay a database notification');
      scheduleRefill();
    });
  };

  /**
   * LISTEN/NOTIFY is atomic with the transaction but not durable: a notification raised while the
   * Bridge or NATS was down is simply gone. The database still holds the truth, so whenever the
   * stream may have missed something each parent's local counter is compared with the last number
   * on that parent's subject, and where the stream is behind one reload pulse is published. A client
   * answers it with a delta call.
   */
  const refill = async (): Promise<void> => {
    const counters = await syncRepository.getLocalCounters();
    const published = { count: 0 };

    for (const counter of counters) {
      const subject = buildEntitySubject(env.NODE_NAME, counter.parent_id);
      const lastChangeSeq = Number(counter.last_seq);
      if ((await readLastPublishedSeq(nats, subject)) >= lastChangeSeq) continue;

      const event: EntityReloadEvent = {
        type: DELTA_TYPES.RELOAD,
        parentId: counter.parent_id,
        originNode: env.NODE_NAME,
        lastChangeSeq,
      };
      await js.publish(subject, codec.encode(JSON.stringify(event)), {
        msgID: buildReloadMessageId(counter.parent_id, lastChangeSeq),
      });
      published.count += 1;
    }

    if (published.count > 0) {
      logger.info({ parents: published.count }, 'Bridge refill published reload pulses');
    }
  };

  const runRefill = async (): Promise<void> => {
    try {
      await refill();
      retry.delayMs = BRIDGE_LIMITS.REFILL_RETRY_MIN_MS;
    } catch (error) {
      logger.warn({ err: error, retryMs: retry.delayMs }, 'Bridge refill failed — will retry');
      scheduleRefill();
    }
  };

  const scheduleRefill = (): void => {
    if (retry.handle || retry.stopped) return;
    const delayMs = retry.delayMs;
    retry.delayMs = Math.min(delayMs * 2, BRIDGE_LIMITS.REFILL_RETRY_MAX_MS);
    retry.handle = setTimeout(() => {
      retry.handle = null;
      void runRefill();
    }, delayMs);
    retry.handle.unref?.();
  };

  const watchReconnects = async (): Promise<void> => {
    for await (const status of nats.status()) {
      if (status.type === Events.Reconnect) await runRefill();
    }
  };

  return {
    start: async () => {
      pgClient.on('notification', onNotification);
      await pgClient.query(`LISTEN ${PG_CHANNELS.ENTITY_CHANGES}`);
      await pgClient.query(`LISTEN ${PG_CHANNELS.MISSION_CHANGES}`);

      await runRefill();

      logger.info(
        { node: env.NODE_NAME, channels: Object.values(PG_CHANNELS) },
        'Bridge is listening for database change notifications',
      );

      watchReconnects().catch((error: unknown) => {
        logger.warn({ err: error }, 'Stopped watching NATS connection status');
      });
    },

    stop: async () => {
      retry.stopped = true;
      if (retry.handle) clearTimeout(retry.handle);
      pgClient.removeListener('notification', onNotification);
      await pgClient.end().catch(() => undefined);
      await nats.drain().catch(() => undefined);
    },
  };
};
