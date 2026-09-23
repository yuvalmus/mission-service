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
 * Two streams per station:
 *
 *  - a local stream holding the changes this station produced, and
 *  - a mirror that pulls the peer's stream across the leaf-node link.
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

  if (!env.PEER_NODE_NAME || env.PEER_NODE_NAME === env.NODE_NAME) return;

  await upsertStream(
    jsm,
    {
      name: buildMirrorStreamName(env.PEER_NODE_NAME),
      mirror: {
        name: NATS_STREAMS.LOCAL,
        external: { api: buildJetStreamApiPrefix(env.PEER_NODE_NAME), deliver: '' },
      },
      retention: RetentionPolicy.Limits,
      discard: DiscardPolicy.Old,
      storage: StorageType.File,
      max_msgs: NATS_STREAM_LIMITS.MAX_MESSAGES,
      max_age: NATS_STREAM_LIMITS.MAX_AGE_NANOS,
    },
    logger,
  );
};

/**
 * The sequence of the last change this station published. On restart the Bridge resumes from here
 * rather than from a cursor of its own — the only durable state it needs already lives in the
 * stream, which is what lets the process be replaced or restarted without losing its place.
 */
export const readLastPublishedSeq = async (nc: NatsConnection, logger: AppLogger): Promise<number> => {
  try {
    const jsm = await nc.jetstreamManager();
    const info = await jsm.streams.info(NATS_STREAMS.LOCAL);
    const lastSeq = info.state.last_seq;
    if (!lastSeq) return 0;

    const message = await jsm.streams.getMessage(NATS_STREAMS.LOCAL, { seq: lastSeq });
    const payload = JSON.parse(new TextDecoder().decode(message.data)) as { lastChangeSeq?: number };
    return typeof payload.lastChangeSeq === 'number' ? payload.lastChangeSeq : 0;
  } catch (error) {
    logger.warn({ err: error }, 'Could not read the last published sequence — starting from zero');
    return 0;
  }
};
