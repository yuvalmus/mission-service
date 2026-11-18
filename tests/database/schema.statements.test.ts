import { Env } from 'config/env.config';
import { ENTITY_COLUMNS } from 'constants/postgres.constants';
import { buildSchemaStatements } from 'database/postgres/schema.statements';
import { NODE_NAME, normalizeSql } from '../fixtures/postgres.fixtures';

describe('buildSchemaStatements', () => {
  const statements = buildSchemaStatements({ NODE_NAME } as Env).map(normalizeSql);
  const all = statements.join('\n');
  const createBackups = statements.find((s) => s.startsWith('CREATE TABLE IF NOT EXISTS route_backups')) ?? '';

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

  it('gives every history row its own event id and the full entity columns', () => {
    expect(createBackups).toContain('event_id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    Object.values(ENTITY_COLUMNS).forEach((column) => expect(createBackups).toContain(`${column} `));
    expect(createBackups).not.toContain('REFERENCES');
  });

  it('records the new version after every local insert or update', () => {
    expect(all).toContain('AFTER INSERT OR UPDATE ON entities FOR EACH ROW EXECUTE FUNCTION record_entity_version()');
    const fn = statements.find((s) => s.includes('FUNCTION record_entity_version()')) ?? '';
    expect(fn).toContain('INSERT INTO route_backups');
    expect(fn).toContain('NEW.entity_id');
    expect(fn).not.toContain('OLD.');
  });

  it('does not record rows applied by replication', () => {
    expect(all).not.toContain('ENABLE ALWAYS TRIGGER trg_entities_record_version');
    expect(all).toContain('ENABLE ALWAYS TRIGGER trg_entities_notify');
  });

  it('keeps the newer row when a first copy from a peer meets a row this station already has', () => {
    const fn = statements.find((s) => s.includes('FUNCTION keep_newer_on_copy()')) ?? '';
    expect(fn).toContain('IF has_row IS NOT TRUE THEN RETURN NEW;');
    expect(fn).toContain('IF NEW.last_update_time > existing_time THEN');
    expect(fn).toContain('RETURN NULL;');
    expect(all).toContain(
      "BEFORE INSERT ON missions FOR EACH ROW EXECUTE FUNCTION keep_newer_on_copy('id')",
    );
    expect(all).toContain("BEFORE INSERT ON infra FOR EACH ROW EXECUTE FUNCTION keep_newer_on_copy('id')");
    expect(all).toContain(
      "BEFORE INSERT ON entities FOR EACH ROW EXECUTE FUNCTION keep_newer_on_copy('entity_id')",
    );
    expect(all).not.toContain('BEFORE INSERT ON route_backups');
  });

  it('runs the copy check only for rows written by replication', () => {
    expect(all).toContain('ALTER TABLE missions ENABLE REPLICA TRIGGER trg_missions_keep_newer_on_copy');
    expect(all).toContain('ALTER TABLE infra ENABLE REPLICA TRIGGER trg_infra_keep_newer_on_copy');
    expect(all).toContain('ALTER TABLE entities ENABLE REPLICA TRIGGER trg_entities_keep_newer_on_copy');
  });

  it('indexes the history by entity time, parent number and entity origin number', () => {
    expect(all).toContain('idx_route_backups_entity_time ON route_backups (entity_id, last_update_time DESC)');
    expect(all).toContain('idx_route_backups_mission_seq ON route_backups (mission_id, mission_change_seq DESC)');
    expect(all).toContain(
      'idx_route_backups_entity_origin_seq ON route_backups (entity_id, origin_node, mission_change_seq DESC)',
    );
  });
});
