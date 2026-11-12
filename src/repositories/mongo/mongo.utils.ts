import { ClientSession } from 'mongoose';
import { TransactionContext } from 'database/database.types';

export const toSession = (context?: TransactionContext): ClientSession | null =>
  (context?.raw as ClientSession | undefined) ?? null;