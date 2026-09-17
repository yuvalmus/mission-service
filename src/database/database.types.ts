export interface DatabaseClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<boolean>;
  isConnected(): boolean;
}

export interface TransactionContext {
  readonly raw?: unknown;
}

export interface UnitOfWork {
  run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}
