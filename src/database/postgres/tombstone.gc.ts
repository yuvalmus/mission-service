import { Pool } from 'pg';
import { Env } from 'config/env.config';
import { PG_TABLES } from 'constants/postgres.constants';
import { AppLogger } from 'utils/logger.util';

export interface TombstoneCollector {
  start(): void;
  stop(): void;
  collectOnce(): Promise<CollectionReport>;
}

export interface CollectionReport {
  entities: number;
  missions: number;
  infra: number;
  backups: number;
}

export interface TombstoneCollectorDeps {
  pool: Pool;
  env: Env;
  logger: AppLogger;
}

/**
 * The retention window is what makes the physical delete safe. A tombstone has to outlive the
 * disconnection of every peer that still needs to see it, otherwise a station that was offline
 * would never learn the entity was removed and would keep drawing it — a zombie. Only after the
 * window has passed is the row reclaimed.
 */
const PURGE_ENTITIES = `
  DELETE FROM ${PG_TABLES.ENTITIES}
  WHERE is_deleted = true
    AND last_update_time < NOW() - ($1 || ' minutes')::interval
`;

/** Entities of a purged parent go with it through ON DELETE CASCADE. */
const PURGE_MISSIONS = `
  DELETE FROM ${PG_TABLES.MISSIONS}
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - ($1 || ' minutes')::interval
`;

const PURGE_INFRA = `
  DELETE FROM ${PG_TABLES.INFRA}
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - ($1 || ' minutes')::interval
`;

/**
 * Enforcing the ten-version ceiling out here, rather than inside the backup trigger, is deliberate:
 * a DELETE in the trigger would add I/O and lock time to every single entity update.
 */
const PRUNE_BACKUPS = `
  DELETE FROM ${PG_TABLES.ROUTE_BACKUPS} b
  WHERE b.backup_id IN (
    SELECT backup_id FROM (
      SELECT backup_id, ROW_NUMBER() OVER (PARTITION BY route_id ORDER BY version DESC) AS row_rank
      FROM ${PG_TABLES.ROUTE_BACKUPS}
    ) ranked
    WHERE ranked.row_rank > $1
  )
`;

const MILLISECONDS_PER_SECOND = 1000;

export const createTombstoneCollector = ({ pool, env, logger }: TombstoneCollectorDeps): TombstoneCollector => {
  const timer: { handle: NodeJS.Timeout | null } = { handle: null };
  const retention = env.TOMBSTONE_RETENTION_MINUTES;

  const collectOnce = async (): Promise<CollectionReport> => {
    const client = await pool.connect();
    try {
      const entities = await client.query(PURGE_ENTITIES, [retention]);
      const missions = await client.query(PURGE_MISSIONS, [retention]);
      const infra = await client.query(PURGE_INFRA, [retention]);
      const backups = await client.query(PRUNE_BACKUPS, [env.ROUTE_BACKUP_LIMIT]);

      return {
        entities: entities.rowCount ?? 0,
        missions: missions.rowCount ?? 0,
        infra: infra.rowCount ?? 0,
        backups: backups.rowCount ?? 0,
      };
    } finally {
      client.release();
    }
  };

  const runCycle = async (): Promise<void> => {
    try {
      const report = await collectOnce();
      const reclaimed = report.entities + report.missions + report.infra + report.backups;
      if (reclaimed > 0) {
        logger.info(report, 'Reclaimed tombstoned rows');
      }
    } catch (error) {
      // A failed sweep is not fatal — the rows stay and the next cycle retries.
      logger.warn({ err: error }, 'Tombstone collection cycle failed');
    }
  };

  return {
    collectOnce,

    start: () => {
      if (timer.handle) return;
      timer.handle = setInterval(runCycle, env.GC_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND);
      timer.handle.unref?.();
      logger.info(
        { intervalSeconds: env.GC_INTERVAL_SECONDS, retentionMinutes: retention },
        'Tombstone collector started',
      );
    },

    stop: () => {
      if (!timer.handle) return;
      clearInterval(timer.handle);
      timer.handle = null;
    },
  };
};
