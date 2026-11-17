import { Env } from 'config/env.config';
import { createTombstoneCollector } from 'database/postgres/tombstone.gc';
import { normalizeSql } from '../fixtures/postgres.fixtures';

const buildLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
}) as never;

const env = { TOMBSTONE_RETENTION_MINUTES: 10, GC_INTERVAL_SECONDS: 120, ROUTE_BACKUP_LIMIT: 10 } as Env;

describe('tombstone collector', () => {
  const client = { query: jest.fn(), release: jest.fn() };
  const pool = { connect: jest.fn() };
  const collector = () => createTombstoneCollector({ pool: pool as never, env, logger: buildLogger() });
  const sqls = (): string[] => client.query.mock.calls.map(([sql]) => normalizeSql(sql));

  beforeEach(() => {
    client.query.mockReset().mockResolvedValue({ rowCount: 0 });
    client.release.mockReset();
    pool.connect.mockReset().mockResolvedValue(client);
  });

  it('drops counters whose parent mission or stake has been purged', async () => {
    const report = await collector().collectOnce();

    expect(sqls()).toContainEqual(
      expect.stringContaining(
        'DELETE FROM change_counters c WHERE NOT EXISTS (SELECT 1 FROM missions m WHERE m.id = c.parent_id) AND NOT EXISTS (SELECT 1 FROM infra i WHERE i.id = c.parent_id)',
      ),
    );
    expect(report.counters).toBe(0);
  });
});
