import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'gateway', env: config.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport: config.isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { singleLine: true, translateTime: 'SYS:standard' },
      },
});

/** Emit one structured JSON line per event (machine readable on the hot path). */
export function logEvent(event: string, data: Record<string, unknown> = {}): void {
  logger.info({ event, ...data });
}
