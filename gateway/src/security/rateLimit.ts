import { redis } from '../redis/client.js';

/**
 * Atomic sliding-window rate limiter.
 * Check-then-record in a single Lua script so concurrent requests cannot slip
 * past the limit. Window is a ZSET of `timestamp:uuid` members (members must be
 * unique, otherwise ZSET de-dupes them and the count is wrong).
 */
const SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local count = redis.call('ZCARD', key)
if count >= limit then
  return {0, count, 0}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window_ms)
return {1, count + 1, limit - count - 1}
`;

export interface RateResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRate(
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<RateResult> {
  const now = Date.now();
  const member = `${now}:${crypto.randomUUID()}`;

  const raw = (await redis.eval(
    SLIDING_WINDOW,
    [`rl:${bucket}`],
    [now, windowSec * 1000, limit, member],
  )) as [number, number, number];

  const allowed = Number(raw[0]) === 1;
  const remaining = Number(raw[2]);
  return { allowed, remaining };
}
