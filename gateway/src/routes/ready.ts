import type { FastifyInstance } from 'fastify';
import { pingRedis } from '../redis/client.js';
import { supabaseAdmin } from '../supabase/client.js';
import { lifecycle } from '../lifecycle.js';

export async function readyRoutes(app: FastifyInstance): Promise<void> {
  // Readiness: checks external dependencies. 503 -> LB stops routing, no restart.
  app.get('/ready', async (_req, reply) => {
    if (lifecycle.shuttingDown) {
      return reply.code(503).send({ status: 'shutting_down' });
    }

    const redisOk = await pingRedis();
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    const dbOk = !error;

    if (!redisOk || !dbOk) {
      return reply
        .code(503)
        .send({ status: 'not ready', redis: redisOk, db: dbOk });
    }

    return { status: 'ready', redis: true, db: true };
  });
}
