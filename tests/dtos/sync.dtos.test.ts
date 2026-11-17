import { EntityDeltaQuerySchema } from 'dtos/sync.dtos';
import { MISSION_ID } from '../fixtures/mission.fixtures';

describe('EntityDeltaQuerySchema', () => {
  const parse = (clock?: string) =>
    EntityDeltaQuerySchema.safeParse({ parentId: MISSION_ID, ...(clock === undefined ? {} : { clock }) });

  it('treats a missing clock as empty', () => {
    expect(parse().data?.clock).toEqual({});
  });

  it('reads a JSON clock', () => {
    expect(parse('{"station-a":10}').data?.clock).toEqual({ 'station-a': 10 });
  });

  it.each(['not json', '[1]', 'null', '{"station-a":-1}', '{"station-a":1.5}', '{"station-a":"10"}', '{"":1}'])(
    'rejects %s',
    (clock) => {
      expect(parse(clock).success).toBe(false);
    },
  );
});
