import pino from 'pino';

type LogFn = (...args: unknown[]) => void;

export interface AppLogger {
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  debug: LogFn;
}

export const createLogger = (level: string, name: string): AppLogger => pino({ level, name });
