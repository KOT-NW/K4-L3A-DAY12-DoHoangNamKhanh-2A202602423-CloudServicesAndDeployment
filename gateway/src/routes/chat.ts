import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { checkRate } from '../security/rateLimit.js';
import { check as checkCost } from '../security/costGuard.js';
import { logEvent } from '../logger.js';

const ChatBody = z.object({
  conversation_id: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
});

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/chat', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = req.user;
    if (!user) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const parsed = ChatBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(422)
        .send({ error: 'invalid_body', issues: parsed.error.issues });
    }

    // Layer 1: per-user rate limit.
    const rl = await checkRate(`user:${user.id}`, config.RATE_LIMIT_PER_MINUTE, 60);
    reply.header('X-RateLimit-Remaining', rl.remaining);
    if (!rl.allowed) {
      logEvent('rate_limited', { scope: 'user', user_id: user.id });
      return reply
        .code(429)
        .send({ error: 'rate_limited', scope: 'user', retry_after_seconds: 60 });
    }

    // Layer 2: monthly budget. Block BEFORE calling the (paid) LLM.
    const cost = await checkCost(user.id);
    if (!cost.allowed) {
      logEvent('budget_exceeded', { user_id: user.id, spent_usd: cost.spent });
      return reply.code(402).send({
        error: 'budget_exceeded',
        spent_usd: cost.spent,
        budget_usd: cost.budget,
      });
    }

    logEvent('chat_request', {
      user_id: user.id,
      source: user.source,
      conversation_id: parsed.data.conversation_id,
    });

    // P0 scope: auth + abuse controls only. Agent service is wired in P1.
    return reply.send({
      status: 'accepted',
      user_id: user.id,
      remaining: rl.remaining,
      note: 'P0: auth + rate limit + cost guard; agent not wired yet',
    });
  });
}
