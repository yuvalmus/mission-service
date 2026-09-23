import { QueryResult } from 'pg';
import { PostgresDatabase } from 'database/postgres.database';

export const NODE_NAME = 'node-a';

export interface RecordedQuery {
  sql: string;
  values: unknown[];
}

export interface PostgresDatabaseMock {
  database: PostgresDatabase;
  queries: RecordedQuery[];
  /** Queues the result returned by the next query; anything unqueued resolves to no rows. */
  queueResult: (rows: object[]) => void;
  queueFailure: (error: Error) => void;
  lastQuery: () => RecordedQuery | undefined;
}

const emptyResult = (rows: object[]): QueryResult =>
  ({ rows, rowCount: rows.length, command: '', oid: 0, fields: [] }) as unknown as QueryResult;

export const createPostgresDatabaseMock = (): PostgresDatabaseMock => {
  const queries: RecordedQuery[] = [];
  const queued: Array<{ rows?: object[]; error?: Error }> = [];

  const query = (sql: string, values: unknown[] = []): Promise<QueryResult> => {
    queries.push({ sql, values });
    const next = queued.shift();
    if (next?.error) return Promise.reject(next.error);
    return Promise.resolve(emptyResult(next?.rows ?? []));
  };

  const client = { query } as never;

  const database: PostgresDatabase = {
    client: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      ping: jest.fn(),
      isConnected: jest.fn(),
    },
    unitOfWork: { run: (work) => work({ raw: client }) },
    pool: {} as never,
    withContext: (_context, fn) => fn(client),
  };

  return {
    database,
    queries,
    queueResult: (rows) => queued.push({ rows }),
    queueFailure: (error) => queued.push({ error }),
    lastQuery: () => queries[queries.length - 1],
  };
};

/** Collapses whitespace so assertions can match SQL without depending on formatting. */
export const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim();
