import { createHash, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../supabase/client.js';
import type { AuthUser } from './jwt.js';

export const API_KEY_PREFIX = 'ag_';
const PREFIX_LEN = 12;

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Constant-time hex comparison (same-length buffers only). */
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify an API key sent in `X-API-Key`.
 * Lookup happens on the non-secret prefix, then the secret is compared in
 * constant time against the stored hash. Revoked/expired keys are rejected.
 */
export async function verifyApiKey(raw: string): Promise<AuthUser | null> {
  if (!raw.startsWith(API_KEY_PREFIX) || raw.length < 24) return null;

  const prefix = raw.slice(0, PREFIX_LEN);
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, user_id, key_hash, scopes, revoked_at, expires_at')
    .eq('prefix', prefix)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
  if (!safeEqualHex(hashApiKey(raw), data.key_hash as string)) return null;

  void supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => undefined);

  return {
    id: data.user_id as string,
    role: 'user',
    source: 'api_key',
    scopes: (data.scopes as string[] | null) ?? ['user'],
  };
}
