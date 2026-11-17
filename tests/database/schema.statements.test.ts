import { Env } from 'config/env.config';
import { buildSchemaStatements } from 'database/postgres/schema.statements';
import { NODE_NAME, normalizeSql } from '../fixtures/postgres.fixtures';

describe('buildSchemaStatements', () => {
  const statements = buildSchemaStatements({ NODE_NAME } as Env).map(normalizeSql);
  const all = statements.join('\n');

  it('keeps the change counter in a local table keyed by parent', () => {
    expect(all).toContain(
      'CREATE TABLE IF NOT EXISTS change_counters ( parent_id UUID PRIMARY KEY, last_seq BIGINT NOT NULL )',
    );
  });

  it('numbers each write from the per-parent counter instead of a global sequence', () => {
    expect(all).toContain(
      'INSERT INTO change_counters (parent_id, last_seq) VALUES (COALESCE(NEW.mission_id, NEW.infra_id), 1) ON CONFLICT (parent_id) DO UPDATE SET last_seq = change_counters.last_seq + 1 RETURNING last_seq',
    );
    expect(all).not.toContain('nextval(');
    expect(all).not.toContain('CREATE SEQUENCE');
  });

  it('leaves an unresolved parent to the belongs_to_one check instead of failing on the counter', () => {
    expect(all).toContain('IF COALESCE(NEW.mission_id, NEW.infra_id) IS NOT NULL THEN INSERT INTO change_counters');
  });

  it('indexes the delta by parent, origin station and number', () => {
    expect(all).toContain('ON entities (mission_id, origin_node, mission_change_seq)');
    expect(all).toContain('ON entities (infra_id, origin_node, mission_change_seq)');
  });
});
