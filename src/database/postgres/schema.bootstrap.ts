import { Pool } from 'pg';
import { Env } from 'config/env.config';
import { buildSchemaStatements } from 'database/postgres/schema.statements';
import { AppLogger } from 'utils/logger.util';

export interface SchemaBootstrapDeps {
  pool: Pool;
  env: Env;
  logger: AppLogger;
}

const TRANSACTION = {
  BEGIN: 'BEGIN',
  COMMIT: 'COMMIT',
  ROLLBACK: 'ROLLBACK',
} as const;

/**
 * Applies the schema as one transaction: either this station comes up with every table, trigger
 * and view in place, or it comes up with none of them and fails loudly. Every statement is
 * idempotent, so this runs on each boot.
 */
export const createSchema = async ({ pool, env, logger }: SchemaBootstrapDeps): Promise<void> => {
  const statements = buildSchemaStatements(env);
  const client = await pool.connect();

  try {
    await client.query(TRANSACTION.BEGIN);
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query(TRANSACTION.COMMIT);
    logger.info({ node: env.NODE_NAME, statements: statements.length }, 'Postgres schema ready');
  } catch (error) {
    await client.query(TRANSACTION.ROLLBACK).catch(() => undefined);
    logger.error({ err: error }, 'Postgres schema bootstrap failed');
    throw error;
  } finally {
    client.release();
  }
};
