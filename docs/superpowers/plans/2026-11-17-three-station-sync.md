# Three-Station Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the Edge mesh on 1–3 stations. Every entity version is kept in a history that is shared by all stations and restorable, and clients sync with a per-station clock.

**Architecture:**
- Each station numbers its own writes per parent, using a local `change_counters` table.
- Each station logs every new version into a replicated `route_backups` on the station that wrote it.
- Clients send a per-station clock and get back only newer rows.
- pglogical subscribes to every peer, NATS mirrors every peer, and the Bridge refills one "reload" pulse per parent after any NATS outage.

**Tech Stack:** Node / TypeScript, Express 4, Zod 4, pg 8, PostgreSQL 16 + PostGIS + pglogical, nats.js 2 (JetStream leaf nodes), Jest + ts-jest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-17-three-station-sync-design.md`. Read it before any task.

## Global Constraints

- Only `STATION=Edge` code changes. Mongo (Ground) and Redis (Air) are untouched.
- No quorum anywhere: no Raft, no Postgres cluster, no clustered JetStream.
- The conflict rule stays pglogical `last_update_wins` with `track_commit_timestamp = on`. Row filter `origin_node = '<self>'`, `forward_origins := '{}'`, `replicate_delete := false`.
- Code style:
  - Add no new code comments.
  - Make minimal inline edits.
  - Add no new helper files, generic interfaces or extra try/catch beyond what a task names.
  - Delete comments that the change makes untrue.
- Path aliases have no `@` (`services/...`, `constants/...`).
- Fixed values:
  - `ROUTE_BACKUP_LIMIT` = 10.
  - Subscription retry every 15 s.
  - Refill retry 1 s doubling to 30 s.
  - NATS duplicate window 5 s, unchanged.
- Names:
  - table `change_counters (parent_id UUID PRIMARY KEY, last_seq BIGINT NOT NULL)`;
  - `route_backups` keyed by `event_id`;
  - env `MESH_PEERS=name@host:port,...`.
- Existing station volumes are recreated (`docker compose down -v`). Write no data migration.
- Commands:
  - single test file: `npx jest <path>`;
  - all tests: `npm test`;
  - types: `npm run typecheck`;
  - build: `npm run build`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Snapshot vs clock.** A change committed between the render snapshot and the clock that is returned with it must not be skipped. Take the render clock from the same rows the snapshot returns (Task 4: `takes the render clock from the same rows it returns`).
2. **Bad `clock` parameter.** Not JSON, an array, a negative number, a fraction or a string number must give 400, not 500 (Task 4: `rejects %s`).
3. **Bad `MESH_PEERS`.** An empty value means single station. A malformed entry, more than two peers, or a station listed as its own peer must fail at startup with a clear message (Task 5 env tests).
4. **Wrong `eventId`.** Restore or duplicate with an `eventId` that belongs to a different entity must give 404, never another entity's data (Task 3: `restores by event id and only from that entity's own history`).
5. **Empty stream on refill.** The stream may hold no message for a parent (first start, or aged out after 1 h). Treat that as 0 and publish one pulse; never crash (Task 6: `treats a subject with no message as 0`).

---

### Task 1: NATS leaf topology for three stations (verify first)

The spec (§5.8) makes this a gate. If a mirror can't read a peer's stream through a middle station, **stop and report to the user**. Do not start Task 2.

**Files:**
- Create: `deploy/nats/nats-c.conf`
- Test: live check only (Docker)

**Interfaces:**
- Produces: `nats-c.conf` with `server_name: nats-c`, JetStream `domain: station-c`, and a single leafnode remote `urls: ["nats-leaf://station-a-nats:7422", "nats-leaf://station-b-nats:7422"]`. `nats-a.conf` and `nats-b.conf` are unchanged.

- [ ] **Step 1: Ask the user before pulling images.** Pulling `natsio/nats-box` (and `nats:2.10-alpine` if it isn't local) is a download.
- [ ] **Step 2: Write `deploy/nats/nats-c.conf`.** Copy `nats-b.conf` and change only `server_name`, `domain` and the remote, as in Interfaces. Use one remote with two URLs.
- [ ] **Step 3: Chain check.** On network `mesh-net`, start `station-a-nats` and `station-b-nats` with their confs. Start `station-c-nats` from a temporary conf outside the repo that is identical to `nats-c.conf` but lists only `station-b`, so A–B–C is forced.
  - On A: `nats stream add MESH_EVENTS --subjects 'events.station-a.>' --defaults`.
  - On C: `nats stream add --config <json>` with `{"name":"MESH_EVENTS_MIRROR_STATION_A","mirror":{"name":"MESH_EVENTS","external":{"api":"$JS.station-a.API","deliver":""}}}`.
  - Publish 3 messages on `events.station-a.mission.x.entities` at A.
  - Expected: within 30 s, `nats stream info MESH_EVENTS_MIRROR_STATION_A` on C shows `Messages: 3`.
  - Repeat in the reverse direction (stream on C, mirror on A). Expected: 3.
- [ ] **Step 4: Gate.** If either mirror stays at 0 after 30 s, stop. Report the command output to the user, and do not continue the plan.
- [ ] **Step 5: Failover check.** Restart `station-c-nats` with the real `nats-c.conf` and publish its monitor port, then stop `station-a-nats`. Expected: within 30 s, C's `/leafz` lists one leaf connection, to `station-b-nats`.
- [ ] **Step 6: Clean up.** Remove the spike containers and the temporary conf.
- [ ] **Step 7: Commit**

```bash
git add deploy/nats/nats-c.conf
git commit -m "feat(mesh): add third NATS leaf node"
```

---

### Task 2: Local per-parent change counter

**Files:**
- Modify:
  - `src/database/postgres/schema.statements.ts`: remove the sequence block (lines 53–63); add the `change_counters` table; replace `nextval` in the metadata trigger (line 172); change the indexes (lines 139–140).
  - `src/constants/postgres.constants.ts`: add `PG_TABLES.CHANGE_COUNTERS`; remove `PG_SEQUENCES` and `MESH_DEFAULTS.NODE_INDEX` / `NODE_COUNT`.
  - `src/config/env.config.ts`: remove `MESH_NODE_INDEX`, `MESH_NODE_COUNT` and the refine with `MESH_INDEX_MESSAGE`. `loadEnv` parses `EnvSchema` directly.
  - `src/database/postgres/tombstone.gc.ts`: purge orphan counters.
  - `.env.example`, `deploy/docker-compose.yml`, `deploy/station-a/values.env`, `deploy/station-b/values.env`: drop the `MESH_NODE_*` lines.
- Create: `tests/database/schema.statements.test.ts`, `tests/database/tombstone.gc.test.ts`

**Interfaces:**
- Produces:
  - `PG_TABLES.CHANGE_COUNTERS = 'change_counters'`.
  - `CollectionReport` gains `counters: number`.
  - `buildSchemaStatements(env)` reads only `env.NODE_NAME`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/database/schema.statements.test.ts
const statements = buildSchemaStatements({ NODE_NAME: NODE_NAME } as Env).map(normalizeSql);
const all = statements.join('\n');

it('keeps the change counter in a local table keyed by parent', () => {
  expect(all).toContain('CREATE TABLE IF NOT EXISTS change_counters ( parent_id UUID PRIMARY KEY, last_seq BIGINT NOT NULL )');
});
it('numbers each write from the per-parent counter instead of a global sequence', () => {
  expect(all).toContain('INSERT INTO change_counters (parent_id, last_seq) VALUES (COALESCE(NEW.mission_id, NEW.infra_id), 1) ON CONFLICT (parent_id) DO UPDATE SET last_seq = change_counters.last_seq + 1 RETURNING last_seq');
  expect(all).not.toContain('nextval(');
  expect(all).not.toContain('CREATE SEQUENCE');
});
it('indexes the delta by parent, origin station and number', () => {
  expect(all).toContain('ON entities (mission_id, origin_node, mission_change_seq)');
  expect(all).toContain('ON entities (infra_id, origin_node, mission_change_seq)');
});
```

```ts
// tests/database/tombstone.gc.test.ts — pool.connect() resolves { query: jest.fn().mockResolvedValue({ rowCount: 0 }), release: jest.fn() }
it('drops counters whose parent mission or stake has been purged', async () => {
  const report = await createTombstoneCollector({ pool, env, logger }).collectOnce();
  const sqls = client.query.mock.calls.map(([sql]) => normalizeSql(sql));
  expect(sqls).toContainEqual(expect.stringContaining('DELETE FROM change_counters c WHERE NOT EXISTS (SELECT 1 FROM missions m WHERE m.id = c.parent_id) AND NOT EXISTS (SELECT 1 FROM infra i WHERE i.id = c.parent_id)'));
  expect(report.counters).toBe(0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest tests/database/schema.statements.test.ts tests/database/tombstone.gc.test.ts`
Expected: FAIL, because the `change_counters` table and the `counters` report field are missing.

- [ ] **Step 3: Implement.**
  - In the metadata function, declare `v_seq BIGINT`, run the counter statement from the test, and set `NEW.mission_change_seq := v_seq`.
  - Name the new indexes `idx_entities_mission_origin_seq` and `idx_entities_infra_origin_seq`. They replace `idx_entities_mission_seq` and `idx_entities_infra_seq`.
  - In the GC, run the counter purge after the infra purge.
- [ ] **Step 4: Run to verify they pass.** Run the same command, then `npm run typecheck` and `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit**

```bash
git add -A src tests .env.example deploy
git commit -m "feat(sync): number changes per parent in a local counter table"
```

---

### Task 3: History records every version and is addressed by eventId

**Files:**
- Modify:
  - `src/database/postgres/schema.statements.ts`: rebuild `route_backups` (lines 121–135); replace the backup function and trigger (lines 212–236); remove the `ENABLE ALWAYS ... ENTITY_BACKUP` line (306) and its comment; change the index (line 145).
  - `src/constants/postgres.constants.ts`: `PG_FUNCTIONS.RECORD_ENTITY_VERSION = 'record_entity_version'` replaces `BACKUP_ENTITY_VERSION`; `PG_TRIGGERS.ENTITY_HISTORY = 'trg_entities_record_version'` replaces `ENTITY_BACKUP`.
  - `src/database/postgres/tombstone.gc.ts`: `PRUNE_BACKUPS`.
  - `src/repositories/postgres/history.repository.ts`
  - `src/services/entity-history.service.ts`
  - `src/controllers/entity-history.controller.ts`
  - `src/routes/sync.routes.ts`
  - `src/constants/sync.constants.ts`: `RESTORE` and `DUPLICATE` use `:eventId`.
  - `src/docs/sync.docs.ts`: history paths and `EntityVersionDto`.
  - `src/constants/error.constants.ts`: `ENTITY_BACKUP_NOT_FOUND(entityId: string, eventId: string)`.
  - `src/app.container.ts`: drop `backupLimit`.
- Test: `tests/database/schema.statements.test.ts`, `tests/database/tombstone.gc.test.ts`, `tests/repositories/postgres.repositories.test.ts`
- Create: `tests/services/entity-history.service.test.ts`

**Interfaces:**
- Consumes: `PG_TABLES.CHANGE_COUNTERS` and `mission_change_seq` semantics from Task 2.
- Produces:
  - `route_backups` = `event_id UUID PRIMARY KEY DEFAULT gen_random_uuid()` plus every `ENTITY_COLUMNS` column, with the same types as `entities`, no FKs, and no `DEFAULT`s besides `event_id`.
  - Indexes: `idx_route_backups_entity_time (entity_id, last_update_time DESC)`, `idx_route_backups_mission_seq (mission_id, mission_change_seq DESC)`, `idx_route_backups_entity_origin_seq (entity_id, origin_node, mission_change_seq DESC)`.
  - `HistoryRepository`:
    - `listVersions(entityId: string): Promise<EntityVersionRow[]>`
    - `restoreVersion(entityId: string, eventId: string, nodeName: string, context?: TransactionContext): Promise<boolean>`
    - `duplicateFromVersion(entityId: string, eventId: string, name: string | null, nodeName: string, context?: TransactionContext): Promise<string | null>`
  - `EntityVersionRow { event_id; entity_id; version: string; entity_type; origin_node; mission_change_seq: string; last_update_time: Date; is_deleted: boolean; is_current: boolean; geometry: unknown | null; properties: Record<string, unknown> | null }`
  - `EntityVersionDto { eventId; entityId; version: number; entityType; originNode; changeSeq: number; lastUpdateTime: Date; isDeleted; isCurrent; geometry; properties }`
  - `EntityHistoryService.restoreVersion(entityId: string, eventId: string)` and `duplicateFromVersion(entityId: string, eventId: string, name: string | null)`. The `backupLimit` dependency is removed.
  - Routes: `POST /sync/entities/:entityId/restore/:eventId` and `POST /sync/entities/:entityId/duplicate/:eventId`, with `eventId` validated as a uuid.
  - Responses: restore `{ entityId, eventId }`; duplicate `{ entityId: createdId, sourceEntityId, eventId }`.

- [ ] **Step 1: Write the failing tests**

```ts
// schema.statements.test.ts
const createBackups = statements.find((s) => s.startsWith('CREATE TABLE IF NOT EXISTS route_backups'))!;
it('gives every history row its own event id and the full entity columns', () => {
  expect(createBackups).toContain('event_id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
  Object.values(ENTITY_COLUMNS).forEach((column) => expect(createBackups).toContain(`${column} `));
  expect(createBackups).not.toContain('REFERENCES');
});
it('records the new version after every local insert or update', () => {
  expect(all).toContain('AFTER INSERT OR UPDATE ON entities FOR EACH ROW EXECUTE FUNCTION record_entity_version()');
  const fn = statements.find((s) => s.includes('FUNCTION record_entity_version()'))!;
  expect(fn).toContain('INSERT INTO route_backups');
  expect(fn).toContain('NEW.entity_id');
  expect(fn).not.toContain('OLD.');
});
it('does not record rows applied by replication', () => {
  expect(all).not.toContain('ENABLE ALWAYS TRIGGER trg_entities_record_version');
  expect(all).toContain('ENABLE ALWAYS TRIGGER trg_entities_notify');
});

// tombstone.gc.test.ts
it('keeps the newest versions per entity per origin station', async () => {
  await collector.collectOnce();
  const prune = client.query.mock.calls.find(([sql]) => sql.includes('DELETE FROM route_backups'))!;
  expect(normalizeSql(prune[0])).toContain('PARTITION BY entity_id, origin_node ORDER BY mission_change_seq DESC');
  expect(prune[1]).toEqual([10]);
});

// postgres.repositories.test.ts — describe('history repository'); EVENT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
it('lists every kept version newest first and flags the live one', async () => {
  await historyRepository().listVersions(ENTITY_ID);
  const sql = normalizeSql(mock.value.lastQuery()?.sql ?? '');
  expect(sql).toContain('FROM route_backups b LEFT JOIN entities e ON e.entity_id = b.entity_id');
  expect(sql).toContain('COALESCE(e.origin_node = b.origin_node AND e.mission_change_seq = b.mission_change_seq, false) AS is_current');
  expect(sql).toContain('ORDER BY b.last_update_time DESC');
  expect(sql).not.toContain('LIMIT');
  expect(mock.value.lastQuery()?.values).toEqual([ENTITY_ID]);
});
it("restores by event id and only from that entity's own history", async () => {
  await historyRepository().restoreVersion(ENTITY_ID, EVENT_ID, NODE_NAME);
  const sql = normalizeSql(mock.value.lastQuery()?.sql ?? '');
  expect(sql).toContain('b.entity_id = $1');
  expect(sql).toContain('b.event_id = $2');
  expect(mock.value.lastQuery()?.values.slice(0, 2)).toEqual([ENTITY_ID, EVENT_ID]);
});
it('reports nothing restored when the event is not a version of that entity', async () => {
  expect(await historyRepository().restoreVersion(ENTITY_ID, EVENT_ID, NODE_NAME)).toBe(false);
});
it('duplicates by event id into a fresh uuid', async () => {
  await historyRepository().duplicateFromVersion(ENTITY_ID, EVENT_ID, null, NODE_NAME);
  const sql = normalizeSql(mock.value.lastQuery()?.sql ?? '');
  expect(sql).toContain('gen_random_uuid()');
  expect(sql).toContain('b.event_id = $2');
});

// tests/services/entity-history.service.test.ts
it('maps a stored version to its dto', async () => {
  repo.listVersions.mockResolvedValue([{ event_id: EVENT_ID, entity_id: ENTITY_ID, version: '5', entity_type: 'circle', origin_node: 'station-b', mission_change_seq: '12', last_update_time: TIME, is_deleted: false, is_current: true, geometry: null, properties: {} }]);
  expect(await service().listVersions(ENTITY_ID)).toEqual([{ eventId: EVENT_ID, entityId: ENTITY_ID, version: 5, entityType: 'circle', originNode: 'station-b', changeSeq: 12, lastUpdateTime: TIME, isDeleted: false, isCurrent: true, geometry: null, properties: {} }]);
});
it('answers 404 when the event is not a version of the entity', async () => {
  repo.restoreVersion.mockResolvedValue(false);
  await expect(service().restoreVersion(ENTITY_ID, EVENT_ID)).rejects.toThrow(new NotFoundError(ERROR_MESSAGES.ENTITY_BACKUP_NOT_FOUND(ENTITY_ID, EVENT_ID)));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest tests/database tests/repositories/postgres.repositories.test.ts tests/services/entity-history.service.test.ts`
Expected: FAIL. The new table shape, trigger, prune order and repository signatures are missing.

- [ ] **Step 3: Implement.**
  - The trigger function inserts every `ENTITY_COLUMNS` column from `NEW.*` with an explicit column list, and returns `NEW`.
  - The trigger is created with plain `CREATE TRIGGER`, which is origin-only.
  - Restore: `UPDATE entities e SET geom = b.geom, properties = b.properties, is_deleted = false, origin_node = $3 FROM route_backups b WHERE e.entity_id = $1 AND b.entity_id = $1 AND b.event_id = $2 RETURNING e.entity_id`.
  - Duplicate keeps its current column list and filters on `b.entity_id = $1 AND b.event_id = $2`.
- [ ] **Step 4: Run to verify they pass.** Run the same command, then `npm run typecheck` and `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat(sync): keep every entity version in a replicated history addressed by event id"
```

---

### Task 4: Per-station clock for delta, render and status

**Files:**
- Modify:
  - `src/constants/sync.constants.ts`: add `VectorClock`; remove `SYNC_LIMITS.DEFAULT_SINCE_SEQ`.
  - `src/dtos/sync.dtos.ts`
  - `src/repositories/postgres/sync.repository.ts`: `ENTITY_DELTA`, `SYNC_STATUS`, interface.
  - `src/services/sync.service.ts`
  - `src/controllers/sync.controller.ts`
  - `src/constants/http.constants.ts`: `NOT_MODIFIED: 304`.
  - `src/constants/error.constants.ts`: `SYNC_CLOCK_INVALID` replaces `SYNC_SINCE_SEQ_INVALID`.
  - `src/docs/sync.docs.ts`: `clock` query param and the 304 response.
- Test: `tests/services/sync.service.test.ts`, `tests/repositories/postgres.repositories.test.ts`
- Create: `tests/dtos/sync.dtos.test.ts`, `tests/controllers/sync.controller.test.ts`

**Interfaces:**
- Produces:
  - `export type VectorClock = Record<string, number>` in `constants/sync.constants.ts`.
  - `EntityDeltaQuery { parentId: string; clock: VectorClock; limit: number }`. `clock` arrives as a JSON string query param; missing means `{}`.
  - `SyncRepository.getEntityDeltaSince(parentId: string, clock: VectorClock, limit: number)`. The clock is sent as `JSON.stringify(clock)` and read as `$2::jsonb`.
  - `SyncStatusRow.clock: Record<string, string | number> | null`, which replaces `last_change_seq`.
  - `SyncService.getEntityDelta(parentId: string, clock: VectorClock, limit: number): Promise<EntityDeltaDto>`
  - `EntityDeltaDto { parentId; clock: VectorClock; hasMore; entities }`, `RenderLayerDto { parentId; clock; entities }`, `SyncStatusDto { parentId; parentKind; isDeleted; clock; entityCount; node }`
  - `ERROR_MESSAGES.SYNC_CLOCK_INVALID = 'clock must be a JSON object of station names to non-negative integers.'`

- [ ] **Step 1: Write the failing tests**

```ts
// sync.service.test.ts (replace the sinceSeq cases)
it('raises each station in the clock to the highest number returned for it', async () => {
  repo.getEntityDeltaSince.mockResolvedValue([row(3, { origin_node: 'station-a' }), row(7, { origin_node: 'station-a' }), row(2, { origin_node: 'station-b' })] as never);
  const delta = await service().getEntityDelta(MISSION_ID, { 'station-a': 1, 'station-c': 9 }, 500);
  expect(repo.getEntityDeltaSince).toHaveBeenCalledWith(MISSION_ID, { 'station-a': 1, 'station-c': 9 }, 500);
  expect(delta.clock).toEqual({ 'station-a': 7, 'station-b': 2, 'station-c': 9 });
});
it('reports another page when the page is full', async () => {
  repo.getEntityDeltaSince.mockResolvedValue([row(1), row(2)] as never);
  expect((await service().getEntityDelta(MISSION_ID, {}, 2)).hasMore).toBe(true);
});
it('takes the render clock from the same rows it returns', async () => {
  repo.getRenderLayer.mockResolvedValue([renderRow(4, 'station-a'), renderRow(6, 'station-b')] as never);
  expect((await service().getRenderLayer(MISSION_ID)).clock).toEqual({ 'station-a': 4, 'station-b': 6 });
});
it('reports the database clock per station in the status', async () => {
  repo.getSyncStatus.mockResolvedValue({ ...statusRow, clock: { 'station-a': '12' } });
  expect((await service().getStatus(MISSION_ID)).clock).toEqual({ 'station-a': 12 });
});
it('reports an empty clock for a parent with no entities', async () => {
  repo.getSyncStatus.mockResolvedValue({ ...statusRow, clock: null });
  expect((await service().getStatus(MISSION_ID)).clock).toEqual({});
});

// postgres.repositories.test.ts — describe('sync repository')
it('asks each station only for numbers above what the caller has seen from it', async () => {
  await syncRepository().getEntityDeltaSince(MISSION_ID, { 'station-a': 4 }, 500);
  const sql = normalizeSql(mock.value.lastQuery()?.sql ?? '');
  expect(sql).toContain('e.mission_change_seq > COALESCE(($2::jsonb ->> e.origin_node)::bigint, 0)');
  expect(sql).toContain('ORDER BY e.origin_node, e.mission_change_seq');
  expect(mock.value.lastQuery()?.values).toEqual([MISSION_ID, '{"station-a":4}', 500]);
});
it('builds the status clock from the highest number per origin station', async () => {
  await syncRepository().getSyncStatus(MISSION_ID);
  expect(normalizeSql(mock.value.lastQuery()?.sql ?? '')).toContain('jsonb_object_agg(');
});

// tests/dtos/sync.dtos.test.ts
const parse = (clock?: string) => EntityDeltaQuerySchema.safeParse({ parentId: MISSION_ID, ...(clock === undefined ? {} : { clock }) });
it('treats a missing clock as empty', () => expect(parse().data?.clock).toEqual({}));
it('reads a JSON clock', () => expect(parse('{"station-a":10}').data?.clock).toEqual({ 'station-a': 10 }));
it.each(['not json', '[1]', '{"station-a":-1}', '{"station-a":1.5}', '{"station-a":"10"}'])('rejects %s', (clock) => {
  expect(parse(clock).success).toBe(false);
});

// tests/controllers/sync.controller.test.ts (use tests/fixtures/express.fixtures.ts)
it('answers 304 with no body when nothing changed', async () => {
  service.getEntityDelta.mockResolvedValue({ parentId: MISSION_ID, clock: {}, hasMore: false, entities: [] });
  await controller.getEntityDelta(req, res);
  expect(res.status).toHaveBeenCalledWith(304);
  expect(res.end).toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
});
it('answers 200 with the page when something changed', async () => { /* one entity → status 200, json(delta) */ });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest tests/services/sync.service.test.ts tests/repositories/postgres.repositories.test.ts tests/dtos tests/controllers/sync.controller.test.ts`
Expected: FAIL. `clock` is not defined anywhere yet.

- [ ] **Step 3: Implement.**
  - Delta query: keep the current select and joins, and use the `WHERE` from spec §5.5 with `$2::jsonb`.
  - Status query: `(SELECT jsonb_object_agg(s.origin_node, s.max_seq) FROM (SELECT origin_node, MAX(mission_change_seq) AS max_seq FROM entities e WHERE e.mission_id = parent.id OR e.infra_id = parent.id GROUP BY origin_node) s) AS clock`.
  - Clock in the DTO: `z.string().default('{}')`, then a JSON parse that adds `ERROR_MESSAGES.SYNC_CLOCK_INVALID` on failure, then piped into `z.record(z.string().min(1), z.number().int().nonnegative())`.
  - The service merges the clock as in the test. The controller returns `res.status(HTTP_STATUS.NOT_MODIFIED).end()` when `entities` is empty.
- [ ] **Step 4: Run to verify they pass.** Run the same command, then `npm run typecheck` and `npm test`, including `tests/docs/openapi.docs.test.ts`. Expected: all PASS.
- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat(sync): delta by per-station clock with 304 when nothing changed"
```

---

### Task 5: `MESH_PEERS`, a subscription per peer, a mirror per peer, a third station in deploy

**Files:**
- Modify:
  - `src/config/env.config.ts`: `MESH_PEERS` replaces `PEER_NODE_NAME`, `PEER_POSTGRES_HOST` and `PEER_POSTGRES_PORT`.
  - `src/constants/postgres.constants.ts`: remove `MESH_DEFAULTS.PEER_NODE_NAME`.
  - `src/database/postgres/pglogical.setup.ts`
  - `src/bridge/nats.streams.ts`: `setupStreams` only.
  - `.env.example`, `deploy/docker-compose.yml` (service and bridge env; header text "two copies" becomes three), `deploy/station-a/values.env`, `deploy/station-b/values.env`
- Create: `deploy/station-c/values.env`, `tests/config/env.config.test.ts`, `tests/bridge/nats.streams.test.ts`
- Test: `tests/database/pglogical.setup.test.ts`, `tests/bridge/bridge.service.test.ts` (env fixture becomes `{ NODE_NAME, MESH_PEERS: [{ name: 'station-b', host: 'station-b-postgres', port: 5432 }] }`)

**Interfaces:**
- Consumes: the `route_backups.origin_node` column from Task 3.
- Produces:
  - `export interface MeshPeer { name: string; host: string; port: number }` in `env.config.ts`, and `Env['MESH_PEERS']: MeshPeer[]`.
  - Entry format `name@host[:port]`, with port defaulting to 5432.
  - Startup errors:
    - `'MESH_PEERS entries must look like name@host:port'`
    - `'MESH_PEERS must list at most 2 peers'`
    - `'MESH_PEERS must not include this station's NODE_NAME'`
  - pglogical:
    - Subscription `sub_<self>_to_<peer>`, built with the existing `toIdentifier`, one per peer, each with its own 15 s retry timer.
    - `REPLICATED_TABLES = [missions, infra, entities, route_backups]`. `change_counters` is never added.
    - `stop()` clears every timer.
  - `setupStreams` creates `MESH_EVENTS` plus `buildMirrorStreamName(peer.name)` for each peer, with `external.api = buildJetStreamApiPrefix(peer.name)`.
  - Deploy values:
    - a: `MESH_PEERS=station-b@station-b-postgres:5432,station-c@station-c-postgres:5432`
    - b: `MESH_PEERS=station-a@station-a-postgres:5432,station-c@station-c-postgres:5432`
    - c: `NODE_NAME=station-c`, `NODE_ID=c`, `MESH_PEERS=station-a@station-a-postgres:5432,station-b@station-b-postgres:5432`, `POSTGRES_HOST_PORT=5435`, `MISSION_HOST_PORT=5003`, `NATS_CLIENT_HOST_PORT=4224`, `NATS_MONITOR_HOST_PORT=8224`, `NATS_WS_HOST_PORT=8083`
    - Compose passes `MESH_PEERS: ${MESH_PEERS}` to the mission-service and the bridge.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/config/env.config.test.ts — set process.env per case, restore after each
it('reads peers as name@host:port', () => {
  expect(load({ MESH_PEERS: 'station-b@station-b-postgres:5432,station-c@pc3:6543' }).MESH_PEERS).toEqual([
    { name: 'station-b', host: 'station-b-postgres', port: 5432 },
    { name: 'station-c', host: 'pc3', port: 6543 },
  ]);
});
it('defaults the peer port to 5432', () => expect(load({ MESH_PEERS: 'station-b@pc2' }).MESH_PEERS[0]?.port).toBe(5432));
it('runs as a single station when no peers are listed', () => expect(load({ MESH_PEERS: '' }).MESH_PEERS).toEqual([]));
it('rejects an entry that is not name@host:port', () => expect(() => load({ MESH_PEERS: 'station-b' })).toThrow(/name@host:port/));
it('rejects more than two peers', () => expect(() => load({ MESH_PEERS: 'b@h,c@h,d@h' })).toThrow(/at most 2 peers/));
it('rejects this station listed as its own peer', () =>
  expect(() => load({ NODE_NAME: 'station-a', MESH_PEERS: 'station-a@h' })).toThrow(/NODE_NAME/));

// tests/database/pglogical.setup.test.ts — pool.connect() returns a client whose query answers by SQL:
// node exists → rowCount 1; replication_set_table → rowCount 0; subscription exists → rowCount 0; show_subscription_status → [{ status: 'replicating' }]
it('subscribes to every peer', async () => {
  await mesh(twoPeers).connect();
  expect(subscriptionNames()).toEqual(['sub_node_a_to_station_b', 'sub_node_a_to_station_c']);
});
it('replicates the history table but never the change counter', async () => {
  await mesh(twoPeers).connect();
  expect(addedTables()).toEqual(expect.arrayContaining(['missions', 'infra', 'entities', 'route_backups']));
  expect(addedTables()).not.toContain('change_counters');
});
it('keeps subscribing to a reachable peer when another is down', async () => {
  failCreateSubscriptionFor('pc3');
  await expect(mesh(twoPeers).connect()).resolves.toBeUndefined();
  expect(subscriptionNames()).toContain('sub_node_a_to_station_b');
});
it('runs as a single station with no peers', async () => {
  await mesh([]).connect();
  expect(client.query).not.toHaveBeenCalled();
});

// tests/bridge/nats.streams.test.ts
it("mirrors every peer's stream through its JetStream domain", async () => {
  await setupStreams(nc, { NODE_NAME: 'station-a', MESH_PEERS: twoPeers } as Env, logger);
  expect(jsm.streams.add.mock.calls.map(([c]) => c.name)).toEqual(['MESH_EVENTS', 'MESH_EVENTS_MIRROR_STATION_B', 'MESH_EVENTS_MIRROR_STATION_C']);
  expect(jsm.streams.add.mock.calls[1][0].mirror.external.api).toBe('$JS.station-b.API');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest tests/config tests/database/pglogical.setup.test.ts tests/bridge`
Expected: FAIL, because `MESH_PEERS` is undefined.

- [ ] **Step 3: Implement.**
  - The `MESH_PEERS` schema is `z.string().default('')` with a transform that splits on `,`, trims, skips empty items, and parses each item into a `MeshPeer`. A bad item adds the first error.
  - The other two rules go in the existing `CheckedEnvSchema.refine` position, as `superRefine`.
- [ ] **Step 4: Run to verify they pass.** Run the same command, then `npm run typecheck` and `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit**

```bash
git add -A src tests .env.example deploy
git commit -m "feat(mesh): replicate and mirror with every listed peer, add station C"
```

---

### Task 6: Bridge refills one pulse per parent after any outage

**Files:**
- Modify:
  - `src/bridge/bridge.service.ts`: replace `catchUp`, add refill, reconnect watch and backoff.
  - `src/bridge/nats.streams.ts`: `readLastPublishedSeq`.
  - `src/repositories/postgres/sync.repository.ts`: add `getLocalCounters`; remove `getLocalChangesSince`, `ChangePulseRow` and `LOCAL_CHANGES_SINCE`.
  - `src/constants/nats.constants.ts`: `BRIDGE_LIMITS`.
  - `schema/asyncapi.yaml`: add the `EntityReload` payload on the entities channel; rewrite the `lastChangeSeq` description as "number assigned by the origin station, per parent, gap-free".
- Test: `tests/bridge/bridge.service.test.ts`, `tests/bridge/nats.streams.test.ts`, `tests/services/sync.service.test.ts` (mock shape only)

**Interfaces:**
- Consumes: `change_counters` (Task 2), and `buildEntitySubject(node, parentId)` and `DELTA_TYPES.RELOAD` (existing).
- Produces:
  - `SyncRepository.getLocalCounters(): Promise<ChangeCounterRow[]>`, with `ChangeCounterRow { parent_id: string; last_seq: string }`, SQL `SELECT parent_id, last_seq FROM change_counters`.
  - `readLastPublishedSeq(nc: NatsConnection, subject: string): Promise<number>`.
    - It calls `jsm.streams.getMessage(NATS_STREAMS.LOCAL, { last_by_subj: subject })` and returns the payload's `lastChangeSeq`.
    - It returns 0 when the error message contains `no message found`, and rethrows anything else.
  - `EntityReloadEvent { type: 'reload'; parentId: string; originNode: string; lastChangeSeq: number }` with msgID `reload-${parentId}-${lastChangeSeq}`.
  - `BRIDGE_LIMITS = { REFILL_RETRY_MIN_MS: 1_000, REFILL_RETRY_MAX_MS: 30_000 }`. The catch-up and reconnect-delay entries are removed.
  - When refill runs:
    - Once in `start()`, before LISTEN. A failure there schedules a retry but does not stop LISTEN.
    - On each `nats.status()` event with `type === 'reconnect'`.
    - After any failed live publish, with the delay doubling from min to max, reset after a refill succeeds.

- [ ] **Step 1: Write the failing tests**

```ts
// bridge.service.test.ts — buildNats gains status(): an async iterable the test can push into; repository mock gains getLocalCounters
it('publishes one reload pulse for a parent the stream is behind on', async () => {
  repo.getLocalCounters.mockResolvedValue([{ parent_id: MISSION_ID, last_seq: '9' }]);
  (readLastPublishedSeq as jest.Mock).mockResolvedValue(5);
  await startBridge();
  expect(readLastPublishedSeq).toHaveBeenCalledWith(expect.anything(), buildEntitySubject(NODE_NAME, MISSION_ID));
  expect(published).toEqual([{ subject: buildEntitySubject(NODE_NAME, MISSION_ID), payload: { type: DELTA_TYPES.RELOAD, parentId: MISSION_ID, originNode: NODE_NAME, lastChangeSeq: 9 }, msgID: `reload-${MISSION_ID}-9` }]);
});
it('publishes nothing for a parent the stream already covers', async () => {
  repo.getLocalCounters.mockResolvedValue([{ parent_id: MISSION_ID, last_seq: '9' }]);
  (readLastPublishedSeq as jest.Mock).mockResolvedValue(9);
  await startBridge();
  expect(published).toHaveLength(0);
});
it('refills again when NATS reconnects', async () => {
  await startBridge();
  status.push({ type: 'reconnect' });
  await flush();
  expect(repo.getLocalCounters).toHaveBeenCalledTimes(2);
});
it('retries the refill with growing delays after a failed publish', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  await startBridge();
  failNextPublish();
  await notify(PG_CHANNELS.ENTITY_CHANGES, entityNotification());
  repo.getLocalCounters.mockRejectedValueOnce(new Error('nats down'));
  await jest.advanceTimersByTimeAsync(1_000);
  expect(repo.getLocalCounters).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(1_999);
  expect(repo.getLocalCounters).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(1);
  expect(repo.getLocalCounters).toHaveBeenCalledTimes(3);
});
it('still starts listening when the first refill fails', async () => {
  repo.getLocalCounters.mockRejectedValueOnce(new Error('nats down'));
  await startBridge();
  expect(listened()).toContain(`LISTEN ${PG_CHANNELS.ENTITY_CHANGES}`);
});

// nats.streams.test.ts
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
```

Delete the two old `catch-up after downtime` tests.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest tests/bridge tests/services/sync.service.test.ts`
Expected: FAIL, because `getLocalCounters` and the reload pulse don't exist yet.

- [ ] **Step 3: Implement** to the Interfaces above. The live path keeps the per-entity events and the `origin_node === NODE_NAME` filter unchanged.
- [ ] **Step 4: Run to verify they pass.** Run the same command, then `npm run typecheck` and `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit**

```bash
git add -A src tests schema
git commit -m "feat(bridge): refill one reload pulse per parent after NATS outages"
```

---

### Task 7: README and the live three-station checks

**Files:**
- Modify: `README.md`, in these sections:
  - Environment table: `MESH_PEERS` replaces the four `PEER_*` / `MESH_NODE_*` rows.
  - Delta sync: `clock`, 304, and the client rule "keep the returned clock".
  - Last-Write-Wins without losing data.
  - Who publishes what: add reload pulses.
  - Running two stations becomes running three stations, with `docker compose down -v` first.
  - Deviations: add the six items of spec §6 and withdraw the old deviation 3.
- Test: live Docker run

- [ ] **Step 1: Update `README.md`** as listed above. Wording follows the spec.
- [ ] **Step 2: Full local gate.** Run: `npm run typecheck`, `npm test`, `npm run build`. Expected: all pass.
- [ ] **Step 3: Bring up three stations** from clean volumes, using the compose header commands for `station-a`, `station-b` and `station-c`.
- [ ] **Step 4: Run spec §8 live checks 1–5.** Cut a station off by `docker network disconnect mesh-net <station>-postgres` and `<station>-nats`. Expected results:
  1. A write on each station appears on the other two, and its `route_backups` row exists on all three.
  2. After the partitioned edit of E on A and on B, and reconnect:
     - E is identical on A, B and C, and holds the later edit.
     - `GET /sync/entities/E/history` on each station lists both edits.
     - Restoring the losing `eventId` on C reaches A and B.
  3. With A stopped, a write on B reaches C and a write on C reaches B. The B↔C mirrors grow.
  4. NATS on B stopped, then a write on B, then NATS started. Within 30 s B's stream gets a `reload` message for that parent, and a delta with the old clock returns the write.
  5. A delta to any station with its current `clock` returns 304.
- [ ] **Step 5: Report** each check's result to the user, failing ones with output. Stop the stations.
- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: three-station mesh, clock-based delta and shared history"
```
