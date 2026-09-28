import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config.js';
import { logger } from './logger.js';
import { authenticate } from './auth/middleware.js';
import { ipRateLimit } from './security/ipRateLimit.js';
import { healthRoutes } from './routes/health.js';
import { readyRoutes } from './routes/ready.js';
import { chatRoutes } from './routes/chat.js';
import { installShutdown } from './lifecycle.js';

const app = Fastify({
  loggerInstance: logger,
  // NOTE: behind Railway/Render set this to the exact proxy hops instead of
  // `true`, otherwise clients can spoof X-Forwarded-For to evade IP limits.
  trustProxy: true,
  bodyLimit: 256 * 1024,
});

app.decorate('authenticate', authenticate);

await app.register(helmet);
await app.register(cors, {
  origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
  credentials: true,
});

// Pre-auth IP rate limit applies to every route except the probes.
app.addHook('onRequest', ipRateLimit);

await app.register(healthRoutes);
await app.register(readyRoutes);
await app.register(chatRoutes);

installShutdown(app);

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (err) {
  logger.error({ event: 'listen_failed', err: String(err) });
  process.exit(1);
}
