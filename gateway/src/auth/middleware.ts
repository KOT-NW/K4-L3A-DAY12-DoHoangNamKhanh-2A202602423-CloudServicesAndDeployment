import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifySupabaseJwt, type AuthUser } from './jwt.js';
import { verifyApiKey } from './apiKey.js';
import { isLocked, recordAuthFailure } from '../security/lockout.js';
import { logEvent } from '../logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Gateway auth. Accepts either a Supabase access token (browser) or an API key
 * (machine clients). Locks out abusive IPs before doing any credential work.
 */
export async function authenticate(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ipKey = `ip:${req.ip}`;

  if (await isLocked(ipKey)) {
    logEvent('auth_locked', { ip: req.ip });
    await reply
      .code(429)
      .send({ error: 'locked', message: 'Too many failed attempts. Try again later.' });
    return;
  }

  const apiKey = req.headers['x-api-key'];
  const authz = req.headers['authorization'];

  let user: AuthUser | null = null;

  if (typeof apiKey === 'string' && apiKey.length > 0) {
    user = await verifyApiKey(apiKey);
  } else if (typeof authz === 'string' && authz.startsWith(BEARER_PREFIX)) {
    user = await verifySupabaseJwt(authz.slice(BEARER_PREFIX.length));
  }

  if (!user) {
    const failures = await recordAuthFailure(ipKey);
    logEvent('auth_failed', { ip: req.ip, failures });
    await reply
      .code(401)
      .send({ error: 'unauthorized', message: 'Missing or invalid credentials.' });
    return;
  }

  req.user = user;
}
