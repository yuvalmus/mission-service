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
| `MONGO_URI`                 | `mongodb://localhost:27017` | Used when `STATION=Ground`                                     |
| `MONGO_DB_NAME`             | `Mission`                   |                                                                |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379`        | Used when `STATION=Air`                                        |
| `LOG_LEVEL`                 | `info`                      | pino level                                                     |

**Edge station only** (see [The mesh](#the-mesh-postgresql--pglogical--nats)):

| Variable                                              | Default                         | Notes                                                  |
| ----------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| `POSTGRES_HOST` / `POSTGRES_PORT`                     | `localhost` / `5432`            | Always this station's own database                     |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `mesh` / `mesh_pass` / `meshdb` |                                                        |
| `POSTGRES_POOL_MAX`                                   | `5`                             |                                                        |
| `NODE_NAME`                                           | `node-a`                        | Stamped on every row as `origin_node`                  |
| `PEER_NODE_NAME`                                      | `node-b`                        |                                                        |
| `PEER_POSTGRES_HOST`                                  | _(unset)_                       | Unset ⇒ single station, no replication                 |
| `PEER_POSTGRES_PORT`                                  | `5432`                          | Used only by the replication worker                    |
| `MESH_NODE_INDEX` / `MESH_NODE_COUNT`                 | `1` / `2`                       | Interleaves change sequences across stations           |
| `NATS_URL`                                            | `nats://localhost:4222`         | Used by the Bridge process                             |
| `TOMBSTONE_RETENTION_MINUTES`                         | `10`                            | How long a deleted row is kept before physical removal |
| `GC_INTERVAL_SECONDS`                                 | `120`                           | Background collector cadence                           |
| `ROUTE_BACKUP_LIMIT`                                  | `10`                            | Versions kept per entity                               |

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
deploy/                  # PostGIS+pglogical image, NATS leaf configs, two-station compose
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

`STATION=Edge` runs the service as one station of a peer-to-peer mesh. Two stations each hold a
complete local database and converge in the background. The design constraint behind every choice
below is **last survivor**: a station must keep accepting reads and writes when it is the only one
left, so no mechanism may need a quorum.

### How a change travels

```
operator edits an entity
          │
          ▼
  ┌───────────────────┐   one transaction
  │  UPDATE entities  │   ─ backup trigger files the previous version
  │                   │   ─ metadata trigger bumps version + change sequence
  │                   │   ─ notify trigger raises pg_notify
  └─────────┬─────────┘
            │ COMMIT
   ┌────────┴─────────┐
   ▼                  ▼
pglogical          Bridge (separate process)
   │                  │  LISTEN → publish
   ▼                  ▼
peer database      NATS JetStream ──mirror──► peer's NATS
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
| `pglogical`, not a Postgres cluster          | Clusters need a majority to accept a write. With two stations, losing one would leave the survivor read-only.                          |
| NATS **leaf nodes**, not clustered JetStream | Clustered JetStream elects a leader by Raft — same quorum problem. A leaf node owns its own domain and keeps accepting messages alone. |
| UUID v4 keys, never `SERIAL`                 | Two disconnected stations must be able to mint rows that can never collide.                                                            |
| Tombstones instead of `DELETE`               | A row that simply vanished cannot be reported by the delta feed, so a peer would keep drawing it.                                      |
| `deleted_at` on the parent for bulk deletes  | Closing a mission with thousands of entities becomes one replicated write instead of a tombstone storm.                                |
| Constraints in the database                  | Under eventual consistency a malformed row written by one station replicates everywhere. The database is the gatekeeper.               |
| Geometry quantized to 7 decimals             | ~1.1cm precision, ~30% less replication and render traffic.                                                                            |

### Delta sync

Every write takes the next value of the station's change sequence. A client keeps the highest
sequence it has processed and asks for what came after it, so only the entities that actually
moved cross the LAN.

Sequences are **interleaved** across stations — station 1 emits 1, 3, 5…, station 2 emits 2, 4,
6…, set by `MESH_NODE_INDEX` / `MESH_NODE_COUNT`. Without that, two stations writing while
disconnected would hand the same number to different entities and a reconnecting client could skip
one. Gaps within a single mission are expected and harmless.

| Endpoint                                              | Purpose                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /sync/entities/delta?parentId=&sinceSeq=&limit=` | What changed since a sequence; returns `nextSeq` to resume from                     |
| `GET /sync/entities/render?parentId=`                 | Full snapshot with geometry as GeoJSON and render defaults injected by the database |
| `GET /sync/status?parentId=`                          | This station's high-water mark and entity count                                     |
| `GET /sync/entities/:entityId/history`                | Up to ten previous versions                                                         |
| `POST /sync/entities/:entityId/restore/:version`      | Reinstate a version (itself an ordinary, replicated update)                         |
| `POST /sync/entities/:entityId/duplicate/:version`    | Create a new entity from an old version                                             |

These routes exist only on the Edge station. The NATS message contract is documented separately in
[`schema/asyncapi.yaml`](schema/asyncapi.yaml).

### Last-Write-Wins without losing data

When both stations edit the same row while disconnected, pglogical keeps the write with the later
commit timestamp on both sides (`pglogical.conflict_resolution = last_update_wins`, which needs
`track_commit_timestamp = on`). `route_backups` is what stops the discarded write from being a loss:
a `BEFORE UPDATE` trigger files the row about to be replaced, and because that trigger is
`ENABLE ALWAYS` it also runs when the overwrite arrives _from the peer_. The losing version is kept
on the station where it was written.

`route_backups` is deliberately **not** replicated — it is each station's record of what was
overwritten locally.

### Who publishes what

`origin_node` means _the station that last wrote this row_, and it is stamped by trigger on every
local write — inserts, edits, tombstones and mission masking alike — so no application path can
forget it. Two things key off it:

- **Replication.** Each station's replication set carries a pglogical row filter
  `origin_node = '<this station>'`: a station publishes only rows it wrote last, and can never be
  sent its own rows back. Editing a row the peer created makes it yours to publish.
- **Events.** The Bridge publishes only changes authored on its own station; the peer's changes
  arrive through the NATS mirror, so every event is published exactly once.

Physical `DELETE`s are not replicated. The only ones this service issues come from the tombstone
collector, which every station runs for itself on the same retention window.

### Running two stations

```bash
docker network create mesh-net
```

```bash
cat deploy/shared.env deploy/station-a/values.env > deploy/.env && docker compose -p station-a -f deploy/docker-compose.yml up -d --build
```

```bash
cat deploy/shared.env deploy/station-b/values.env > deploy/.env && docker compose -p station-b -f deploy/docker-compose.yml up -d --build
```

Station A serves on `:5001`, station B on `:5002`. Each runs its own PostgreSQL, NATS and Bridge.
Stop either one: the other keeps serving, and the gap closes on its own when it returns.

Each station has a private network for its service and Bridge; only PostgreSQL and NATS are also
attached to the shared `mesh-net`. To simulate losing the link between stations:

```bash
docker network disconnect mesh-net station-b-postgres && docker network disconnect mesh-net station-b-nats
```

```bash
docker network connect mesh-net station-b-postgres && docker network connect mesh-net station-b-nats
```

Each station's JetStream `domain` in `deploy/nats/` must equal its `NODE_NAME` — the peer's mirror
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
3. **Global sequence, not a per-mission counter.** The reference demo increments a counter on the
   `missions` row; the later design notes replace it with `nextval()` on a global sequence
   explicitly to avoid row locks and deadlocks. This follows the later notes.
4. **No CHECK on values inside `properties`.** The reference suggests enforcing e.g. a positive
   radius, but also requires that payload changes never fail a load. Structural rules are enforced
   in the database; value rules stay in the Zod DTOs, where a violation is a 400 rather than a
   stalled replication worker.

The following were found by running two live stations, and are corrections to the reference demo's
configuration rather than design choices:

5. **Last-Write-Wins is configured explicitly.** The demo never sets a conflict policy, so pglogical
   uses its default, `apply_remote`. On a concurrent offline edit each station then applies the
   other's version: the two databases swap values and stay diverged permanently.
6. **Each station replicates only its own rows.** The demo subscribes both ways with
   `synchronize_data := true` and no filter. As soon as one station has data before the other
   joins — the normal "last survivor" case — the second subscription's initial copy tries to insert
   the first station's own rows back into it and the apply worker dies on duplicate keys.
7. **pglogical is added to `output_plugin_libraries`.** Current PostgreSQL 16 builds only let
   allow-listed libraries act as logical-decoding output plugins; without this every subscription
   fails with _"may not be used as an output plugin"_. Set at cluster init, and only when the server
   has the setting, so older builds still start.

A residual edge remains in the initial copy: if a joining station edits a row the survivor created
in the seconds before the survivor's back-subscription is established, that copy collides. The
window is one retry interval (15 seconds) after a station first joins.

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
