import { logger } from './logger.js';

interface Closable {
  close(): Promise<void>;
}

class Lifecycle {
  shuttingDown = false;
  private installed = false;

  install(app: Closable): void {
    if (this.installed) return;
    this.installed = true;

    const shut = async (signal: NodeJS.Signals): Promise<void> => {
      if (this.shuttingDown) return;
      this.shuttingDown = true; // /health now returns 503 -> LB drains us
      logger.warn({ event: 'shutdown_started', signal });
      try {
        await app.close(); // stop accepting, finish in-flight requests
      } catch (err) {
        logger.error({ event: 'shutdown_error', err: String(err) });
      }
      process.exit(0);
    };

    process.on('SIGTERM', () => void shut('SIGTERM'));
    process.on('SIGINT', () => void shut('SIGINT'));
  }
}

export const lifecycle = new Lifecycle();

export function installShutdown(app: Closable): void {
  lifecycle.install(app);
}
