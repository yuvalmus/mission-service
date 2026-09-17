import mongoose, { Connection } from 'mongoose';
import { Env } from 'config/env.config';
import { DatabaseClient, TransactionContext, UnitOfWork } from 'database/database.types';

export interface MongoDatabase {
  client: DatabaseClient;
  unitOfWork: UnitOfWork;
  connection: Connection;
}

const READY_STATE_CONNECTED = 1;

export const createMongoDatabase = (env: Env): MongoDatabase => {
  const connection = mongoose.createConnection(env.MONGO_URI, { dbName: env.MONGO_DB_NAME });

  const client: DatabaseClient = {
    connect: async () => {
      await connection.asPromise();
    },
    disconnect: async () => {
      await connection.close();
    },
    ping: async () => {
      if (connection.readyState !== READY_STATE_CONNECTED || !connection.db) return false;
      try {
        await connection.db.admin().ping();
        return true;
      } catch {
        return false;
      }
    },
    isConnected: () => connection.readyState === READY_STATE_CONNECTED,
  };

  const unitOfWork: UnitOfWork = {
    run: async <T>(work: (context: TransactionContext) => Promise<T>): Promise<T> => {
      const session = await connection.startSession();
      try {
        const result = { value: undefined as T };
        await session.withTransaction(async () => {
          result.value = await work({ raw: session });
        });
        return result.value;
      } finally {
        await session.endSession();
      }
    },
  };

  return { client, unitOfWork, connection };
};
