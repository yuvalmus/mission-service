import { DiscardPolicy, JetStreamManager, NatsConnection, RetentionPolicy, StorageType } from 'nats';
import { Env } from 'config/env.config';
import {
  buildJetStreamApiPrefix,
  buildMirrorStreamName,
  buildStationSubjectFilter,
  NATS_STREAMS,
  NATS_STREAM_LIMITS,
} from 'constants/nats.constants';
import { AppLogger } from 'utils/logger.util';

const STREAM_CONFIG_CONFLICT = 'different configuration';

const NO_MESSAGE_FOUND = 'no message found';

const upsertStream = async (
  jsm: JetStreamManager,
  config: Parameters<JetStreamManager['streams']['add']>[0],
  logger: AppLogger,
): Promise<void> => {
  try {
    await jsm.streams.add(config);
    logger.info({ stream: config.name }, 'JetStream stream ready');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(STREAM_CONFIG_CONFLICT)) {
      await jsm.streams.update(config.name as string, config);
      logger.info({ stream: config.name }, 'JetStream stream reconfigured');
      return;
    }
    if (!/already/i.test(message)) throw error;
  }
};

/**
 * Streams per station:
 *
 *  - a local stream holding the changes this station produced, and
 *  - one mirror per peer, pulling that peer's stream across the leaf-node links.
 *
 * The mirror is what makes a change durable across the mesh: it is written to the peer's disk
 * first, and copied here when the link returns. A message therefore survives a disconnection
 * instead of evaporating, which plain publish/subscribe cannot promise.
 *
 * Mirroring by station, rather than every bridge republishing everything, is also what keeps the
 * mesh from echoing: each change is published exactly once, by the station that made it.
 */
export const setupStreams = async (nc: NatsConnection, env: Env, logger: AppLogger): Promise<void> => {
  const jsm = await nc.jetstreamManager();

  await upsertStream(
    jsm,
    {
      name: NATS_STREAMS.LOCAL,
      subjects: [buildStationSubjectFilter(env.NODE_NAME)],
      retention: RetentionPolicy.Limits,
      discard: DiscardPolicy.Old,
      storage: StorageType.File,
      max_msgs: NATS_STREAM_LIMITS.MAX_MESSAGES,
      max_age: NATS_STREAM_LIMITS.MAX_AGE_NANOS,
      duplicate_window: NATS_STREAM_LIMITS.DUPLICATE_WINDOW_NANOS,
    },
    logger,
  );

  for (const peer of env.MESH_PEERS) {
    await upsertStream(
      jsm,
      {
        name: buildMirrorStreamName(peer.name),
        mirror: {
          name: NATS_STREAMS.LOCAL,
          external: { api: buildJetStreamApiPrefix(peer.name), deliver: '' },
        },
        retention: RetentionPolicy.Limits,
        discard: DiscardPolicy.Old,
        storage: StorageType.File,
        max_msgs: NATS_STREAM_LIMITS.MAX_MESSAGES,
        max_age: NATS_STREAM_LIMITS.MAX_AGE_NANOS,
      },
      logger,
    );
  }
};

/**
 * The number of the last change this station published for one parent. The Bridge keeps no cursor
 * of its own — the only durable state it needs already lives in the stream, which is what lets the
 * process be replaced or restarted without losing its place. A subject with no message yet (first
 * start, or aged out of the stream) counts as 0.
 */
export const readLastPublishedSeq = async (nc: NatsConnection, subject: string): Promise<number> => {
  try {
    const jsm = await nc.jetstreamManager();
    const message = await jsm.streams.getMessage(NATS_STREAMS.LOCAL, { last_by_subj: subject });
    const payload = JSON.parse(new TextDecoder().decode(message.data)) as { lastChangeSeq?: number };
    return typeof payload.lastChangeSeq === 'number' ? payload.lastChangeSeq : 0;
  } catch (error) {
    if (error instanceof Error && error.message.includes(NO_MESSAGE_FOUND)) return 0;
    throw error;
  }
};
