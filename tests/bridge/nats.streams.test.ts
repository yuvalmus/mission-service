import { NatsConnection } from 'nats';
import { Env, MeshPeer } from 'config/env.config';
import { readLastPublishedSeq, setupStreams } from 'bridge/nats.streams';

const buildLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
}) as never;

const SUBJECT = 'events.station-a.mission.4f3c2b1a-0000-4000-8000-000000000001.entities';

const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

const twoPeers: MeshPeer[] = [
  { name: 'station-b', host: 'station-b-postgres', port: 5432 },
  { name: 'station-c', host: 'station-c-postgres', port: 5432 },
];

describe('nats.streams', () => {
  const jsm = { streams: { add: jest.fn(), update: jest.fn(), info: jest.fn(), getMessage: jest.fn() } };
  const nc = { jetstreamManager: () => Promise.resolve(jsm) } as unknown as NatsConnection;

  beforeEach(() => {
    jsm.streams.add.mockResolvedValue({});
  });

  it("mirrors every peer's stream through its JetStream domain", async () => {
    await setupStreams(nc, { NODE_NAME: 'station-a', MESH_PEERS: twoPeers } as Env, buildLogger());

    expect(jsm.streams.add.mock.calls.map(([config]) => config.name)).toEqual([
      'MESH_EVENTS',
      'MESH_EVENTS_MIRROR_STATION_B',
      'MESH_EVENTS_MIRROR_STATION_C',
    ]);
    expect(jsm.streams.add.mock.calls[1]?.[0].mirror.external.api).toBe('$JS.station-b.API');
    expect(jsm.streams.add.mock.calls[2]?.[0].mirror.external.api).toBe('$JS.station-c.API');
  });

  it('creates only the local stream for a single station', async () => {
    await setupStreams(nc, { NODE_NAME: 'station-a', MESH_PEERS: [] as MeshPeer[] } as Env, buildLogger());

    expect(jsm.streams.add.mock.calls.map(([config]) => config.name)).toEqual(['MESH_EVENTS']);
  });

  it('reads lastChangeSeq from the last message on the subject', async () => {
    jsm.streams.getMessage.mockResolvedValue({ data: encode({ lastChangeSeq: 7 }) });

    expect(await readLastPublishedSeq(nc, SUBJECT)).toBe(7);
    expect(jsm.streams.getMessage).toHaveBeenCalledWith('MESH_EVENTS', { last_by_subj: SUBJECT });
  });

  it('treats a subject with no message as 0', async () => {
    jsm.streams.getMessage.mockRejectedValue(new Error('no message found'));

    expect(await readLastPublishedSeq(nc, SUBJECT)).toBe(0);
  });

  it('passes any other failure up', async () => {
    jsm.streams.getMessage.mockRejectedValue(new Error('timeout'));

    await expect(readLastPublishedSeq(nc, SUBJECT)).rejects.toThrow('timeout');
  });
});
