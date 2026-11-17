# Three-station sync: design

Date: 2026-11-17 · Branch: `feature/postgreSQL-sync-implementation` · Station type: `STATION=Edge`

## 1. Intent

The vehicle runs 1–3 stations. Today the Edge mesh supports exactly two. The architect's new docs
(`PostgreSQL files/new docs/`, 2026-09-23) describe the 1–3 station design, and we adopt them with
two fixes.

The rule the user set: when stations lose contact and two of them edit the same entity, the later
edit wins when contact returns (Last-Write-Wins). The earlier edit must not disappear. It stays in
the entity's history on every station, and an operator can restore it.

## 2. Goals, non-goals, anti-goals

Goals
- 1, 2 or 3 stations in a full mesh. Any station keeps working alone ("last survivor").
- Every version of every entity is kept in a history table that is the same on all stations,
  including the losing side of a conflict.
- An operator can list an entity's versions and restore one, or create a new entity from it.
- A client never misses a change, including after a disconnect or when talking to a lagging station.
- If nothing changed, the delta call answers `304 Not Modified`.
- The Bridge talks only to its own station's NATS, retries when NATS is down, and refills the
  stream from Postgres when NATS comes back.

Non-goals (separate later projects, in this order)
1. Route rules: LinePoint on waypoint delete, legs computed live, name suffixes (ASAF1/ASAF2),
   UUID ordering for duplicate names.
2. Mission cloning in one SQL statement (CTE).
3. Data versioning: filter unknown entity types, `line_dash` default, Invalid flag, on-load migration.

Also not in scope
- Telling an operator that their edit was overwritten. The history shows it; an alert can be added
  later by recording which version each edit started from.
- Mongo (Ground) and Redis (Air) stations. They are untouched.
- The browser client. This doc defines the API it calls.

Anti-goals (would make this a failure even if it runs)
- A conflict loser that exists on only one station, or that is pruned away by newer edits from the winner.
- A client that skips a change because a number went backwards.
- Anything that needs a majority of stations to accept a write.

## 3. Constraints

- No quorum anywhere: no Raft, no Postgres cluster, no clustered JetStream.
- 2014 hardware, LAN only, no internet. Sessions last at most 12 hours, then the data is reset.
- Conflict rule stays pglogical `last_update_wins` with `track_commit_timestamp = on`.
- Each station publishes only rows it wrote last (`origin_node = '<self>'` row filter,
  `forward_origins := '{}'`, physical deletes not replicated). This stays.
- Data is session-scoped, so existing station volumes are recreated. There is no in-place migration.

## 4. Approaches considered

| | How | Trade-off |
|---|---|---|
| A. New docs as written | Backup trigger copies OLD, origin-only; `route_backups` replicated; per-mission counter `missions.last_change_seq` under a row lock | The losing edit is never backed up, because the receiving station's trigger is switched off. The counter sits on a replicated row that peers overwrite, so it can go backwards. Stakes get no counter. |
| B. Current branch extended to 3 | Backup trigger fires on every station (ENABLE ALWAYS); local `route_backups`; one interleaved global sequence | The loser is kept, but only on the station that lost, so histories differ between stations. A single "since" number lets a late change from one station hide behind a higher number from another. |
| **C. New docs + two fixes (picked)** | Log each version (NEW) when written, origin-only, into a replicated history. Keep the change counter per parent in a local, non-replicated table. | One extra small table, plus a row lock per parent per station. |

The user picked C on 2026-11-17.

## 5. Design

### 5.1 Configuration for 1–3 stations

- Replace `PEER_NODE_NAME`, `PEER_POSTGRES_HOST` and `PEER_POSTGRES_PORT` with one list:
  `MESH_PEERS=station-b@station-b-postgres:5432,station-c@station-c-postgres:5432`.
  An empty list means a single station.
- Remove `MESH_NODE_INDEX`, `MESH_NODE_COUNT` and the `entity_change_seq` sequence. The new counter
  is per station, so the interleaving trick is no longer needed.
- `deploy/` gets a `station-c` values file, a `nats-c.conf`, and peers lists for all three stations.

### 5.2 Change counter (fix 2)

A new **local** table, never added to the replication set:

```sql
CREATE TABLE change_counters (
  parent_id UUID PRIMARY KEY,
  last_seq  BIGINT NOT NULL
);
```

- The existing origin-only `BEFORE INSERT OR UPDATE` metadata trigger on `entities` takes the next
  number from this table:
  `INSERT ... VALUES (COALESCE(NEW.mission_id, NEW.infra_id), 1) ON CONFLICT (parent_id) DO UPDATE SET last_seq = change_counters.last_seq + 1 RETURNING last_seq`.
- The result goes into `NEW.mission_change_seq`. The column name stays, and it is also used for stakes.
- What this gives:
  - The counter row stays locked until commit. Within one parent on one station, numbers are
    therefore gap-free and in commit order.
  - Rows arriving through pglogical keep the number their author gave them. So
    `(origin_node, mission_change_seq)` is a stable identity for a version, the same on every station.
  - pglogical applies each origin's commits in order, so per parent and per origin the numbers seen
    on any station only ever go up.
- Deviations from the new docs:
  - No `missions.last_change_seq` column.
  - Each row in a multi-row UPDATE gets its own number. This is how FOR EACH ROW triggers behave,
    and it is harmless.
- A transaction that writes to two parents in opposite orders can deadlock. Postgres aborts one of
  them, and the request fails with 500. This is acceptable: no current write path spans two parents.
- The GC deletes counter rows of parents it purges.

### 5.3 History (fix 1)

`route_backups` is rebuilt as the new docs ask: `event_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
plus every column of `entities`, with no foreign keys.

- A new trigger, `AFTER INSERT OR UPDATE ON entities FOR EACH ROW`, inserts `NEW` into
  `route_backups`. It is **origin-only** (plain ENABLE), so rows applied by pglogical are not logged again.
- The old `ENABLE ALWAYS` backup trigger, which copied OLD, is removed.
- `route_backups` joins the replication set with the same `origin_node = '<self>'` row filter. History
  rows are insert-only and keyed by a fresh UUID, so they never conflict.
- Why the loser survives: each edit is logged on the station that made it, before any conflict
  exists. The entity row and its history row commit together. pglogical resolves a conflict per
  row, so a losing entity row still delivers its history row. Every station ends up with both versions.
- Indexes: `(entity_id, last_update_time DESC)` and `(mission_id, mission_change_seq DESC)`.
- Pruning, in the existing GC job: keep the newest `ROUTE_BACKUP_LIMIT` rows **per entity per
  origin station**, ordered by `mission_change_seq DESC`. Within one station and one parent that
  number strictly increases, so there are no ties, even for two edits in the same transaction.
  - This prevents a specific loss: one station makes 15 edits while another makes one. Pruning by
    entity alone would push the single losing edit out at once.
  - Each station prunes its own copy, since deletes are not replicated. The copies converge because
    the ordering is deterministic.
- When the GC purges a tombstoned entity, its history rows stay until the session reset. Restore
  then returns 404, because there is no row to update, but duplicate still works.
- The notify triggers (`ENABLE ALWAYS`) are unchanged.

### 5.4 Replication for three stations

`pglogical.setup.ts` creates one subscription per peer, `sub_<self>_to_<peer>`, each retried on its
own 15 s timer. A peer that is down never blocks the others.

Replicated tables: missions, infra, entities, route_backups. Not replicated: change_counters.

### 5.5 Delta API (vector clock)

`GET /sync/entities/delta?parentId=<uuid>&clock=<json>&limit=<n>`

- `clock` is a JSON object mapping station name to the last number seen from it, for example
  `{"station-a":10,"station-b":4}`. It may be missing or `{}`.
- Query: `WHERE (mission_id = $1 OR infra_id = $1) AND mission_change_seq > COALESCE(($2 ->> origin_node)::bigint, 0) ORDER BY origin_node, mission_change_seq LIMIT $3`
- The response is `{ parentId, clock, hasMore, entities }`.
  - The returned `clock` is the request clock with each station raised to the highest number
    returned for it.
  - Paging is safe: within one station the rows come in number order, so a page cut leaves a prefix.
- No rows: respond `304 Not Modified` with no body.
- Client rule, documented in the README and AsyncAPI: keep the returned `clock`. Never rebuild it
  from the entities you hold. An entity overwritten by another station would lower the rebuilt
  value and cause re-downloads.
- `GET /sync/entities/render` returns `{ parentId, clock, entities }`, where `clock` is the
  per-station maximum over the parent's entities.
- `GET /sync/status` returns `clock` in place of `lastChangeSeq`. A client compares it with its own
  clock to spot a gap.
- `sinceSeq` and `nextSeq` are removed. Nothing outside this branch calls them.

### 5.6 History API

A version number is no longer unique once two stations can both make version 5. So history is
addressed by `eventId`.

- `GET /sync/entities/{entityId}/history`: all kept versions, newest first. Each item has
  `eventId, version, originNode, changeSeq, lastUpdateTime, isDeleted, geometry, properties, isCurrent`.
  `isCurrent` is true when `(origin_node, mission_change_seq)` matches the live row.
- `POST /sync/entities/{entityId}/restore/{eventId}`: an ordinary UPDATE. It gets a new version, is
  logged, replicates, and wins by being newest.
- `POST /sync/entities/{entityId}/duplicate/{eventId}`: INSERT with a new UUID.

### 5.7 Bridge

- It connects only to the local NATS (`NATS_URL`, a single URL). There is no failover to another station.
- Live path: unchanged. Each change written here becomes one event on
  `events.<self>.mission.<parent>.entities`, with msgID `<entityId>-<version>`.
- Refill: the `getLocalChangesSince` and global-cursor catch-up are replaced.
  - For each row in `change_counters`, read the last message on that parent's subject in the local
    stream (`getMessage` with `last_by_subj`), and take its `lastChangeSeq`. If there is none, use 0.
  - If the counter is ahead, publish one pulse
    `{type:"reload", parentId, originNode, lastChangeSeq}` with msgID `reload-<parent>-<seq>`.
    The client answers a pulse with a delta call.
  - This costs one message per parent, not one per row.
- Refill runs:
  - at start;
  - on every NATS `reconnect` status event;
  - after any failed publish, retried with exponential backoff from 1 s up to 30 s, and reset after
    a refill succeeds.
- No `CLUSTER_NODES` KV bucket. The new docs allow "KV **or** last value on the stream". The last
  message per subject on each station's stream and mirror already holds each station's latest
  number per parent. `/sync/status` gives the database's view.

### 5.8 NATS for three stations

- Leaf nodes cannot form a loop, so the links must form a tree that survives any one station going down:
  - `nats-b` connects out to `[station-a]`.
  - `nats-c` connects out to `[station-a, station-b]`, as **one** remote with two URLs. Two remotes
    would create a loop.
  - If A dies, C fails over to B. Every possible set of links is still a tree.
- Each station keeps its own JetStream domain (= `NODE_NAME`), its `MESH_EVENTS` stream, and one
  mirror per peer: `MESH_EVENTS_MIRROR_<PEER>`.
- **Risk, to verify first:** when A and C are linked only through B, a mirror on C must still read
  `$JS.station-a.API`. If it can't, stop and come back. Don't redesign this silently.

## 6. Deviations from the new docs (to add to the README)

1. The history logs each new version where it is written, not the old version on overwrite. The
   loser of a conflict is then kept.
2. The change counter is per parent per station, in a local table, not `missions.last_change_seq`.
   It cannot go backwards, and it covers stakes.
3. Every row of a batch update gets its own number.
4. Pruning keeps the last N versions per entity **per station**.
5. No `CLUSTER_NODES` KV. The stream's last value per subject is used, which the docs allow.
6. Restore and duplicate go by `eventId`, not by version.

The existing deviation 3 (global sequence) is withdrawn.

## 7. Known limits

- `forward_origins := '{}'` means changes only travel directly from the station that wrote them.
  If A and C cannot reach each other but both reach B, C gets A's changes only when the A–C link
  returns. The same applies to a station joining while the author of some rows is down.
- A tombstone and an edit made apart from each other: the later one wins, so a delete can be undone
  by a later edit. The delete stays in the history.
- Mission lifecycle events lost while NATS is down are not refilled. The mission list is small, and
  clients re-list it on reconnect.
- Clock skew decides LWW. The docs accept this for 12-hour sessions.
- An edit that reaches a station before its create is dropped. C is away; B creates an entity and A
  edits it; on return C may apply A's update first, which pglogical skips because the row is missing,
  then B's insert. C shows B's version until the next edit. A's version is in C's history. Found in
  the final review; the user chose on 2026-11-17 to document it rather than repair it.

## 8. Verification

Unit tests, updated or added:
- schema statements (counter, history trigger, no ALWAYS backup);
- pglogical setup (one subscription per peer, route_backups in the set, counter table not in it);
- delta and clock merge, including paging and 304;
- history by eventId;
- Bridge refill: pulse when behind, nothing when level, retry after a failed publish, refill on reconnect.

Live checks on Docker with three stations:
1. A write on each station reaches the other two, and its history row appears on all three.
2. Cut A off. Edit entity E on A and on B. Reconnect.
   - E is equal on all three and holds the later edit.
   - Both edits are in E's history on all three stations.
   - Restoring the losing edit on C reaches A and B.
3. Stop A. B and C keep syncing both ways, and the NATS mirrors between B and C keep working.
4. Stop NATS on B, write on B, start NATS again. The Bridge refills, and a client holding the old clock catches up.
5. Ask a lagging station with an up-to-date clock: it answers 304.

## 9. Left to the builder

- Exact SQL, file layout and naming, following the existing code style (no code comments added,
  minimal changes).
- Parsing of the `MESH_PEERS` format and its validation errors.
- Whether the live checks become a script or a written checklist.
- README, `schema/asyncapi.yaml` and OpenAPI updates to match sections 5.5–5.7.
