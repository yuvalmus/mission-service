import { Client, Notification } from 'pg';
import { JetStreamClient, NatsConnection, StringCodec } from 'nats';
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

const codec = StringCodec();

/**
 * Deterministic message id, so the broker can collapse a repeat rather than letting a duplicate
 * reach the map. An entity at a given version is one immutable fact, which makes
 * `<entity>-<version>` the natural identity — and makes republishing during catch-up safe.
 */
const buildMessageId = (entityId: string, version: number): string => `${entityId}-${version}`;

export const createBridgeService = ({
  pgClient,
  nats,
  syncRepository,
  env,
  logger,
}: BridgeServiceDeps): BridgeService => {
  const js: JetStreamClient = nats.jetstream();

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
    });
  };

  /**
   * LISTEN/NOTIFY is atomic with the transaction but not durable: a notification raised while the
   * Bridge was down is simply gone. The database still holds the truth, so on start-up the gap is
   * closed by replaying every local change above the last sequence that reached the stream.
   */
  const catchUp = async (): Promise<void> => {
    const startSeq = await readLastPublishedSeq(nats, logger);
    const cursor = { seq: startSeq, published: 0 };

    for (let page = 0; page < BRIDGE_LIMITS.MAX_CATCH_UP_PAGES; page += 1) {
      const rows = await syncRepository.getLocalChangesSince(
        cursor.seq,
        env.NODE_NAME,
        BRIDGE_LIMITS.CATCH_UP_PAGE,
      );
      if (rows.length === 0) break;

      for (const row of rows) {
        await publishEntityChange({
          type: DELTA_TYPES.CHANGED,
          parentId: row.parent_id,
          entityId: row.entity_id,
          entityType: row.entity_type,
          version: Number(row.version),
          lastChangeSeq: Number(row.mission_change_seq),
          isDeleted: row.is_deleted,
          originNode: row.origin_node,
        });
        cursor.seq = Number(row.mission_change_seq);
        cursor.published += 1;
      }

      if (rows.length < BRIDGE_LIMITS.CATCH_UP_PAGE) break;
    }

    if (cursor.published > 0) {
      logger.info({ from: startSeq, to: cursor.seq, published: cursor.published }, 'Bridge catch-up complete');
    }
  };

  return {
    start: async () => {
      await catchUp();

      pgClient.on('notification', onNotification);
      await pgClient.query(`LISTEN ${PG_CHANNELS.ENTITY_CHANGES}`);
      await pgClient.query(`LISTEN ${PG_CHANNELS.MISSION_CHANGES}`);

      logger.info(
        { node: env.NODE_NAME, channels: Object.values(PG_CHANNELS) },
        'Bridge is listening for database change notifications',
      );
    },

    stop: async () => {
      pgClient.removeListener('notification', onNotification);
      await pgClient.end().catch(() => undefined);
      await nats.drain().catch(() => undefined);
    },
  };
};
