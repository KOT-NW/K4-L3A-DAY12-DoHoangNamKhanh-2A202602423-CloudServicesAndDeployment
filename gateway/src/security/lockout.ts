import { config } from '../config.js';
import { redis } from '../redis/client.js';

const key = (id: string): string => `authfail:${id}`;

export async function isLocked(id: string): Promise<boolean> {
  const n = await redis.get<number>(key(id));
  return (n ?? 0) >= config.AUTH_MAX_FAILURES;
}

export async function recordAuthFailure(id: string): Promise<number> {
  const n = await redis.incr(key(id));
  if (n === 1) await redis.expire(key(id), config.AUTH_LOCKOUT_SECONDS);
  return Number(n);
}

export async function clearAuthFailures(id: string): Promise<void> {
  await redis.del(key(id));
}
