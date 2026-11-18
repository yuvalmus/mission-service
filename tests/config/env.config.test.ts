import { loadEnv } from 'config/env.config';

describe('loadEnv', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  const load = (vars: Record<string, string>) => {
    Object.assign(process.env, { NODE_NAME: 'station-a', ...vars });
    return loadEnv();
  };

  it('reads peers as name@host:port', () => {
    expect(load({ MESH_PEERS: 'station-b@station-b-postgres:5432,station-c@pc3:6543' }).MESH_PEERS).toEqual([
      { name: 'station-b', host: 'station-b-postgres', port: 5432 },
      { name: 'station-c', host: 'pc3', port: 6543 },
    ]);
  });

  it('defaults the peer port to 5432', () => {
    expect(load({ MESH_PEERS: 'station-b@pc2' }).MESH_PEERS[0]?.port).toBe(5432);
  });

  it('ignores blanks around and between entries', () => {
    expect(load({ MESH_PEERS: ' station-b@pc2 , ,station-c@pc3 ' }).MESH_PEERS.map((peer) => peer.name)).toEqual([
      'station-b',
      'station-c',
    ]);
  });

  it('runs as a single station when no peers are listed', () => {
    expect(load({ MESH_PEERS: '' }).MESH_PEERS).toEqual([]);
  });

  it('rejects an entry that is not name@host:port', () => {
    expect(() => load({ MESH_PEERS: 'station-b' })).toThrow(/name@host:port/);
  });

  it('rejects more than two peers', () => {
    expect(() => load({ MESH_PEERS: 'b@h,c@h,d@h' })).toThrow(/at most 2 peers/);
  });

  it('rejects this station listed as its own peer', () => {
    expect(() => load({ NODE_NAME: 'station-a', MESH_PEERS: 'station-a@h' })).toThrow(/NODE_NAME/);
  });
});
