import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { checkRate } from './rateLimit.js';
import { logEvent } from '../logger.js';

const SKIP = new Set(['/health', '/ready']);

/**
 * Pre-auth IP rate limit. Runs before credential verification so brute force
 * and unauthenticated spam never reach the auth logic.
 */
export async function ipRateLimit(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (SKIP.has(req.url.split('?')[0] ?? '')) return;

  const result = await checkRate(
    `ip:${req.ip}`,
    config.RATE_LIMIT_IP_PER_MINUTE,
    60,
  );

  reply.header('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    logEvent('rate_limited', { scope: 'ip', ip: req.ip, path: req.url });
    await reply.code(429).send({ error: 'rate_limited', scope: 'ip' });
  }
}
