/**
 * Subject layout: `events.<origin station>.mission.<parent id>.<kind>`
 *
 * The parent id sits in the subject so a client subscribed to one mission receives only that
 * mission's traffic — on a shared LAN with weak hardware, filtering in the broker rather than in
 * the browser is the difference between a usable map and a stalled one.
 *
 * The origin station sits in the subject because each station owns one stream and mirrors its
 * peer's; without that separation the mirrors would form a loop.
 */
export const NATS_SUBJECTS = {
  ROOT: 'events',
  ENTITIES: 'entities',
  LIFECYCLE: 'lifecycle',
} as const;

export const buildStationSubjectFilter = (node: string): string =>
  `${NATS_SUBJECTS.ROOT}.${node}.>`;

export const buildEntitySubject = (node: string, parentId: string): string =>
  `${NATS_SUBJECTS.ROOT}.${node}.mission.${parentId}.${NATS_SUBJECTS.ENTITIES}`;

export const buildLifecycleSubject = (node: string, missionId: string): string =>
  `${NATS_SUBJECTS.ROOT}.${node}.mission.${missionId}.${NATS_SUBJECTS.LIFECYCLE}`;

/** Subscribe across every station for one mission, local and mirrored alike. */
export const buildAnyStationEntitySubject = (parentId: string): string =>
  `${NATS_SUBJECTS.ROOT}.*.mission.${parentId}.${NATS_SUBJECTS.ENTITIES}`;

export const NATS_STREAMS = {
  LOCAL: 'MESH_EVENTS',
  MIRROR_PREFIX: 'MESH_EVENTS_MIRROR_',
} as const;

export const buildMirrorStreamName = (peerNode: string): string =>
  `${NATS_STREAMS.MIRROR_PREFIX}${peerNode.replace(/-/g, '_').toUpperCase()}`;

/** JetStream domain per station, so leaf nodes never need a quorum to accept a write. */
export const buildJetStreamApiPrefix = (node: string): string => `$JS.${node}.API`;

export const NATS_STREAM_LIMITS = {
  /**
   * Ring buffer with discard-old. The broker is for distributing what is happening now; Postgres
   * is the record of what happened. Capping the stream keeps memory bounded on 2014 hardware and
   * stops a client that reconnects after a long outage from chasing stale history — past the cap
   * it falls back to a delta query against the database.
   */
  MAX_MESSAGES: 10_000,
  MAX_AGE_NANOS: 60 * 60 * 1_000_000_000,
  /** Window in which a repeated Nats-Msg-Id is dropped by the broker. */
  DUPLICATE_WINDOW_NANOS: 5 * 1_000_000_000,
} as const;

export const NATS_CONNECTION = {
  RECONNECT_TIME_WAIT_MS: 2_000,
  MAX_RECONNECT_ATTEMPTS: -1,
} as const;

export const BRIDGE_LIMITS = {
  /** Upper bound on a single catch-up sweep after the Bridge has been down. */
  CATCH_UP_PAGE: 1_000,
  MAX_CATCH_UP_PAGES: 50,
  RECONNECT_DELAY_MS: 5_000,
} as const;

export const DELTA_TYPES = {
  CHANGED: 'changed',
  RELOAD: 'reload',
} as const;
