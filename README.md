# Globus Mission Service (Node.js)

REST API for managing **missions**, **stakes**, and the **map entities** that belong to them
(circles, sectors, polygons, corridors, polylines, waypoints, landing zones, routes and more).

This is the TypeScript/Express port of the original .NET 8 `globus.mission.service`.

---

## Quick start

**Prerequisites:** Node.js 20+, and a running MongoDB, Redis **or** PostgreSQL
(see [Station](#station-mongo-redis-or-postgresql)).

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

The service listens on `http://localhost:5000` by default.

## Swagger / API docs

With the service running:

- **Swagger UI** → http://localhost:5000/docs
- **Raw OpenAPI JSON** → http://localhost:5000/docs/openapi.json

The spec is generated at runtime from the Zod DTO schemas, so it can never drift from the
validation rules the API actually enforces. Adding an endpoint means adding its schema — the
docs follow automatically.

## Environment variables

| Variable                    | Default                     | Notes                                                          |
| --------------------------- | --------------------------- | -------------------------------------------------------------- |
| `PORT`                      | `5000`                      | HTTP port                                                      |
| `NODE_ENV`                  | `development`               | `development` \| `test` \| `production`                        |
| `SERVICE_NAME`              | `mission-service`           | Used in logs and health output                                 |
| `STATION`                   | `Air`                       | `Ground` → MongoDB, `Edge` → PostgreSQL, anything else → Redis |
| `MONGO_URL`                 | `mongodb://localhost:27017` | Used when `STATION=Ground`                                     |
| `MONGO_DB_NAME`             | `Mission`                   |                                                                |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379`        | Used when `STATION=Air`                                        |
| `LOG_LEVEL`                 | `info`                      | more options: `fatal`, `error`, `warn`, `info`, `debug`        |

**Edge station only** (see [The mesh](#the-mesh-postgresql--pglogical--nats)):

| Variable                                              | Default                         | Notes                                                  |
| ----------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| `POSTGRES_HOST` / `POSTGRES_PORT`                     | `localhost` / `5432`            | Always this station's own database                     |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `mesh` / `mesh_pass` / `meshdb` |                                                        |
| `POSTGRES_POOL_MAX`                                   | `5`                             |                                                        |
| `NODE_NAME`                                           | `node-a`                        | Stamped on every row as `origin_node`                  |
| `MESH_PEERS`                                          | _(empty)_                       | `name@host:port,…`, at most 2; empty ⇒ single station  |
| `NATS_URL`                                            | `nats://localhost:4222`         | Used by the Bridge process                             |
| `TOMBSTONE_RETENTION_MINUTES`                         | `10`                            | How long a deleted row is kept before physical removal |
| `GC_INTERVAL_SECONDS`                                 | `120`                           | Background collector cadence                           |
| `ROUTE_BACKUP_LIMIT`                                  | `10`                            | Versions kept per entity per origin station            |

Env vars are validated by Zod on boot — a bad value fails fast with a clear message.

## Station: Mongo, Redis or PostgreSQL

Like the .NET service, the persistence backend is chosen by configuration, not by code:

- `STATION=Ground` → **MongoDB** (Mongoose)
- `STATION=Edge` → **PostgreSQL + PostGIS**, replicated peer-to-peer across stations
- `STATION=Air` (or anything else) → **Redis** (ioredis), plus a middleware that returns
  `503` on every non-health request while Redis is disconnected.

Business logic never sees this choice. Services depend only on the repository interfaces in
`src/repositories/*.repository.ts`; the concrete implementations live in `repositories/mongo/`,
`repositories/redis/` and `repositories/postgres/`, and are selected once in
`src/app.container.ts`.

> **Note:** this service writes **camelCase** fields to a **fresh database**. It is not
> wire-compatible with data written by the old .NET service (which used PascalCase BSON).

## Scripts

| Command                 | What it does                          |
| ----------------------- | ------------------------------------- |
| `npm run dev`           | Run with hot reload (tsx)             |
| `npm run build`         | Compile to `dist/`                    |
| `npm start`             | Run the compiled build                |
| `npm run bridge`        | Run the Bridge sidecar (Edge station) |
| `npm run bridge:dev`    | Bridge with hot reload                |
| `npm test`              | Run the Jest suite                    |
| `npm run test:watch`    | Jest in watch mode                    |
| `npm run test:coverage` | Coverage report                       |
| `npm run typecheck`     | `tsc --noEmit` over src + tests       |

## Project structure

```
src/
├── index.ts             # bootstrap: env → container → app → listen
├── app.ts               # express wiring: cors, json, routers, error handler
├── app.container.ts     # composition root — picks Mongo/Redis, builds every service
├── config/              # env + openapi registry
├── constants/           # ALL_CAPS constant objects (no bare strings anywhere)
├── models/              # Zod domain models (port of common.models)
├── dtos/                # Zod request/response DTOs + inferred types
├── mappers/             # DTO ↔ domain, plus the entity registry
├── bridge/              # Bridge sidecar: LISTEN/NOTIFY → NATS JetStream (own process)
├── database/            # client + unit of work per backend; postgres/ holds schema, pglogical, GC
├── repositories/        # interfaces + mongo/, redis/ and postgres/ implementations
├── services/            # business logic
├── controllers/         # thin HTTP layer
├── routes/              # express routers + validation middleware
├── middlewares/         # validation, error handling, redis health
├── docs/                # OpenAPI path registrations
└── utils/               # logger, name generator, geo, category helpers
tests/                   # mirrors src/, plus tests/fixtures/ for shared mocks
deploy/                  # PostGIS+pglogical image, NATS leaf configs, one-to-three-station compose
schema/asyncapi.yaml     # NATS message contract
```

**Layering:** `Routes → Controllers → Services → Repositories`. Each layer only knows the one
below it, and controllers never touch domain models directly — they speak DTOs.

**The entity registry.** There are 13 entity types with near-identical CRUD. Rather than
4 × 13 hand-written handlers, `src/mappers/entity.registry.ts` holds one `EntityDefinition`
per type (URL segment + Zod schemas + mappers), and the routes, controllers and OpenAPI docs
are generated by looping over it. **To add a new entity type:** write its model, its DTOs and
its mappers, then add one registry entry — routes, validation, docs and Swagger appear on their own.

## The mesh: PostgreSQL + pglogical + NATS

`STATION=Edge` runs the service as one station of a peer-to-peer mesh. One to three stations each
hold a complete local database and converge in the background. The design constraint behind every choice
below is **last survivor**: a station must keep accepting reads and writes when it is the only one
left, so no mechanism may need a quorum.

### How a change travels

```
operator edits an entity
          │
          ▼
  ┌───────────────────┐   one transaction
  │  UPDATE entities  │   ─ metadata trigger bumps version + per-parent number
  │                   │   ─ history trigger files the new version
  │                   │   ─ notify trigger raises pg_notify
  └─────────┬─────────┘
            │ COMMIT
   ┌────────┴─────────┐
   ▼                  ▼
pglogical          Bridge (separate process)
   │                  │  LISTEN → publish
   ▼                  ▼
peer databases     NATS JetStream ──mirrors──► peers' NATS
                      │
                      ▼
                   client: "entity X changed" → GET /sync/entities/delta
```

Nothing is published before `COMMIT`, and the application never talks to NATS itself. If it did,
it could commit a change and die before announcing it — durable but invisible, with the peers'
maps quietly disagreeing with the database.

### Why these pieces

| Decision                                     | Reason                                                                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pglogical`, not a Postgres cluster          | Clusters need a majority to accept a write. With two or three stations, losing a majority leaves the survivor read-only.               |
| NATS **leaf nodes**, not clustered JetStream | Clustered JetStream elects a leader by Raft — same quorum problem. A leaf node owns its own domain and keeps accepting messages alone. |
| UUID v4 keys, never `SERIAL`                 | Two disconnected stations must be able to mint rows that can never collide.                                                            |
| Tombstones instead of `DELETE`               | A row that simply vanished cannot be reported by the delta feed, so a peer would keep drawing it.                                      |
| `deleted_at` on the parent for bulk deletes  | Closing a mission with thousands of entities becomes one replicated write instead of a tombstone storm.                                |
| Constraints in the database                  | Under eventual consistency a malformed row written by one station replicates everywhere. The database is the gatekeeper.               |
| Geometry quantized to 7 decimals             | ~1.1cm precision, ~30% less replication and render traffic.                                                                            |

### Delta sync

Every write takes the next number from its station's counter for the parent (`change_counters`, a
local table that is never replicated). Numbers are gap-free per parent per station, and a replicated
row keeps the number its author gave it, so `(origin_node, mission_change_seq)` names one version on
every station.

A client keeps a **clock**: the highest number it has seen from each station, for example
`{"station-a":10,"station-b":4}`. It asks for what came after it, so only the entities that actually
moved cross the LAN. If nothing did, the answer is `304 Not Modified`.

**Keep the clock the server returns** and send it back on the next call. Never rebuild it from the
entities you hold: an entity overwritten by another station would lower the rebuilt value and cause
re-downloads.

| Endpoint                                            | Purpose                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET /sync/entities/delta?parentId=&clock=&limit=`  | What changed since a clock (JSON); returns the raised `clock`, or `304` if nothing    |
| `GET /sync/entities/render?parentId=`               | Full snapshot with GeoJSON and render defaults, plus the `clock` to start polling from |
| `GET /sync/status?parentId=`                        | This station's clock and entity count                                                 |
| `GET /sync/entities/:entityId/history`              | Every kept version from every station, newest first; `isCurrent` marks the live one   |
| `POST /sync/entities/:entityId/restore/:eventId`    | Reinstate a version (itself an ordinary, replicated update)                           |
| `POST /sync/entities/:entityId/duplicate/:eventId`  | Create a new entity from an old version                                               |

These routes exist only on the Edge station. The NATS message contract is documented separately in
[`schema/asyncapi.yaml`](schema/asyncapi.yaml).

### Last-Write-Wins without losing data

When two stations edit the same row while disconnected, pglogical keeps the write with the later
commit timestamp everywhere (`pglogical.conflict_resolution = last_update_wins`, which needs
`track_commit_timestamp = on`). `route_backups` is what stops the discarded write from being a loss.
An origin-only `AFTER INSERT OR UPDATE` trigger files every new version on the station that wrote
it, before any conflict exists, and `route_backups` replicates like the entities do. The entity row
and its history row commit together, and pglogical resolves conflicts per row, so a losing entity
row still delivers its history row. Every station ends up with both versions, and an operator can
restore either one by its `eventId`.

History rows are keyed by a fresh `event_id`, so they never conflict. The collector keeps the newest
`ROUTE_BACKUP_LIMIT` versions per entity **per origin station**, so fifteen edits on one station
cannot push out the single losing edit from another. The history of an entity the collector has
purged stays until the session reset: restoring it answers 404, duplicating it still works.

### Who publishes what

`origin_node` means _the station that last wrote this row_, and it is stamped by trigger on every
local write — inserts, edits, tombstones and mission masking alike — so no application path can
forget it. Two things key off it:

- **Replication.** Each station's replication set carries a pglogical row filter
  `origin_node = '<this station>'`: a station publishes only rows it wrote last, and can never be
  sent its own rows back. Editing a row the peer created makes it yours to publish.
- **Events.** The Bridge publishes only changes authored on its own station; each peer's changes
  arrive through that peer's NATS mirror, so every event is published exactly once.
- **Reload pulses.** LISTEN/NOTIFY is not durable, so after NATS or the Bridge has been down the
  Bridge compares each parent's local counter with the last number on that parent's subject in its
  stream. Where the stream is behind it publishes one `{"type":"reload", parentId, originNode,
  lastChangeSeq}` for the parent, and the client answers with a delta call. This runs at start, on
  every NATS reconnect, and after a failed publish, retried from 1 s doubling to 30 s. Mission
  lifecycle messages missed during an outage are not refilled; clients re-list missions on
  reconnect.

Physical `DELETE`s are not replicated. The only ones this service issues come from the tombstone
collector, which every station runs for itself on the same retention window.

### Running three stations

```bash
docker network create mesh-net
```

Volumes from an older build must be recreated first — the schema changed and data is
session-scoped, so there is no migration. Repeat for `station-b` and `station-c`:

```bash
cat deploy/shared.env deploy/station-a/values.env > deploy/.env && docker compose -p station-a -f deploy/docker-compose.yml down -v
```

```bash
cat deploy/shared.env deploy/station-a/values.env > deploy/.env && docker compose -p station-a -f deploy/docker-compose.yml up -d --build
```

```bash
cat deploy/shared.env deploy/station-b/values.env > deploy/.env && docker compose -p station-b -f deploy/docker-compose.yml up -d --build
```

```bash
cat deploy/shared.env deploy/station-c/values.env > deploy/.env && docker compose -p station-c -f deploy/docker-compose.yml up -d --build
```

Station A serves on `:5001`, B on `:5002`, C on `:5003`. Each runs its own PostgreSQL, NATS and
Bridge, and lists the other two in `MESH_PEERS`. Stop any one: the others keep serving, and the gap
closes on its own when it returns. For two stations, drop the third from each `MESH_PEERS`.

NATS leaf nodes cannot form a loop, so the links form a tree: `nats-b` dials A, and `nats-c` dials A
or, when A is down, B — one remote with two URLs. If A goes down, C fails over to B, and every set
of links is still a tree.

Each station has a private network for its service and Bridge; only PostgreSQL and NATS are also
attached to the shared `mesh-net`. To simulate losing the link between stations:

```bash
docker network disconnect mesh-net station-b-postgres && docker network disconnect mesh-net station-b-nats
```

```bash
docker network connect mesh-net station-b-postgres && docker network connect mesh-net station-b-nats
```

A cut link is noticed within about 15–25 seconds: every peer connection carries connect, keepalive
and TCP timeouts, and `wal_sender_timeout` is 15 s. Without them a silently dropped link could stall
replication for up to ~15 minutes after it came back. Measured on Docker, a 10 s or 60 s cut caught
up 5–15 s after reconnect.

Each station's JetStream `domain` in `deploy/nats/` must equal its `NODE_NAME` — each peer's mirror
addresses it as `$JS.<NODE_NAME>.API`.

The database image is built from `deploy/postgres/` with PostGIS and pglogical compiled in rather
than installed at runtime — a station that received a geometry row before its own PostGIS existed
would crash its replication worker and stop syncing silently.

### Deviations from the reference architecture

Points where this implementation departs from the architecture documents or the reference demo, and why:

1. **Spatial constraint covers thirteen entity types.** The reference fixes
   `point | circle | polygon | linestring`; this service has thirteen. The constraint is generated
   from `ENTITY_GEOMETRY_KINDS` so it cannot drift from the projection code.
2. **`route` stores no geometry.** It is defined by the waypoint ids it references, so `geom` is
   `NULL` and the shape is drawn from those waypoints.
3. **No CHECK on values inside `properties`.** The reference suggests enforcing e.g. a positive
   radius, but also requires that payload changes never fail a load. Structural rules are enforced
   in the database; value rules stay in the Zod DTOs, where a violation is a 400 rather than a
   stalled replication worker.

The three-station design notes (2026-09-23) are followed with these departures:

4. **The history logs each new version where it is written**, not the old version on overwrite. The
   notes' origin-only trigger on the overwritten row never runs on the receiving station, so the
   loser of a conflict would not be kept. Logging the new version at its origin keeps it.
5. **The change counter is per parent per station, in a local table** (`change_counters`), not
   `missions.last_change_seq`. A counter on a replicated row is overwritten by peers and can go
   backwards; it also skips stakes. The local counter cannot go backwards and covers both parents.
6. **Every row of a batch update gets its own number.** That is how `FOR EACH ROW` triggers behave,
   and it is harmless.
7. **Pruning keeps the last N versions per entity per station**, so a burst of edits on one station
   cannot evict the losing edit from another.
8. **No `CLUSTER_NODES` KV bucket.** The notes allow "KV or the last value on the stream"; the last
   message per subject on each stream and mirror already holds each station's latest number per
   parent.
9. **Restore and duplicate go by `eventId`**, not by version, because two stations can both make
   version 5 of an entity.

The earlier deviation "global sequence, not a per-mission counter" is withdrawn: the per-station
counter replaces it, and the interleaving settings `MESH_NODE_INDEX` / `MESH_NODE_COUNT` are gone.

The following were found by running live stations, and are corrections to the reference demo's
configuration rather than design choices:

10. **Last-Write-Wins is configured explicitly.** The demo never sets a conflict policy, so pglogical
   uses its default, `apply_remote`. On a concurrent offline edit each station then applies the
   other's version: the two databases swap values and stay diverged permanently.
11. **Each station replicates only its own rows.** The demo subscribes both ways with
   `synchronize_data := true` and no filter. As soon as one station has data before the other
   joins — the normal "last survivor" case — the second subscription's initial copy tries to insert
   the first station's own rows back into it and the apply worker dies on duplicate keys.
12. **pglogical is added to `output_plugin_libraries`.** Current PostgreSQL 16 builds only let
   allow-listed libraries act as logical-decoding output plugins; without this every subscription
   fails with _"may not be used as an output plugin"_. Set at cluster init, and only when the server
   has the setting, so older builds still start.

**The initial copy keeps the newer row instead of failing.** Each peer's initial copy is a snapshot
taken at its own moment, so a row can change hands between two copies. For example, C copies a
mission from A, B then writes to it, and C's copy from B carries the same row again. pglogical's
initial copy does not resolve conflicts, so it failed on a duplicate key, and C's subscription to B
stayed down for good. Any entity write moves its mission to the writing station, so a single write
was enough. A `BEFORE INSERT` trigger on `missions`, `infra` and `entities` now checks whether the
row already exists, keeps the one with the later `last_update_time`, and lets the copy continue. It
is enabled for replication only (`ENABLE REPLICA`), so the service's own writes never run it.
Masking a mission now also stamps `last_update_time`, so a mission deleted during that gap wins
too. Like Last-Write-Wins, this relies on the stations' clocks agreeing.

**Known limit with three stations: an edit that arrives before its create is dropped.** Each
station sends only the rows it wrote last, and a station applies each peer's stream on its own. If
station C is away while B creates an entity and A then edits it, C may receive A's edit before B's
create when it returns. pglogical cannot apply an update to a row that does not exist yet, so it
skips the edit, and C then shows B's original version until someone edits the entity again. Nothing
is lost: A's version is in C's history (`GET /sync/entities/:entityId/history`), and A and B hold it.
With two stations this cannot happen, because the editor always received the row from the creator.

## API overview

| Base path                 | Purpose                                                                        |
| ------------------------- | ------------------------------------------------------------------------------ |
| `/missions`               | Mission CRUD, clone, merge by layers, bulk import, search                      |
| `/create`, `/createStake` | Create an entity (`POST /create/circle`, `/wpt`, `/route`, …)                  |
| `/update`, `/updateStake` | Update an entity + visibility toggles                                          |
| `/delete`, `/deleteStake` | `DELETE /delete/circle/:missionId/:entityId`                                   |
| `/entities`               | Fetch a single entity by id (`/entities/route/:id`, `/entities/nav-route/:id`) |
| `/stakes`                 | Per-squadron stake (auto-created on first read)                                |
| `/names`                  | Default name generation (`C001`, `RTE001`, `משימה 1`, …)                       |
| `/healthz`, `/readyz`     | Liveness / readiness (readiness pings the DB)                                  |

The `…Stake` variants are the same handlers; the path decides whether stake categories are
allowed, exactly as in the .NET service.

**Errors** are always `{ "statusCode": number, "message": string }`, with the original status
mapping preserved: validation/domain errors → `400`, missing → `404`, DB failures → `422`,
unexpected → `500`.

## Testing

```bash
npm test
```

Every layer is unit-tested in **isolation** — controllers via `node-mocks-http` (never through
the Express stack), services and repositories against mocked dependencies. Shared mocks and
builders live in `tests/fixtures/`; keep test-specific data inside its own suite.

## Conventions

A few rules the codebase sticks to — please keep them:

- Arrow functions assigned to `const`; no `function` declarations, avoid `let`.
- No bare strings — literals live in `src/constants/*` as `ALL_CAPS` objects.
- Single quotes everywhere.
- `express-async-errors` is imported in `app.ts`, so async handlers need **no try/catch** —
  throw a typed error from `src/errors/app.errors.ts` and the global handler formats it.
- Files are named `[feature].[layer].ts`, tests `[feature].[layer].test.ts`.
- Imports use path aliases (`@services/*`, `@dtos/*`, …), not relative `../../` chains.
