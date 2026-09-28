import type { FastifyInstance } from 'fastify';
import { lifecycle } from '../lifecycle.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Liveness: must NOT touch Redis/DB. Only answers "restart this process?".
  app.get('/health', async (_req, reply) => {
    if (lifecycle.shuttingDown) {
      return reply.code(503).send({ status: 'shutting_down' });
    }
    return {
      status: 'ok',
      service: 'gateway',
      version: process.env.npm_package_version ?? '0.1.0',
    };
  });
}
