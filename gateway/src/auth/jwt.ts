import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.js';

export interface AuthUser {
  id: string;
  email?: string;
  role: 'user' | 'admin';
  source: 'jwt' | 'api_key';
  scopes: string[];
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function roleOf(payload: JWTPayload): 'user' | 'admin' {
  const metaRole = (payload.user_metadata as Record<string, unknown> | undefined)?.role;
  if (payload.role === 'service_role' || metaRole === 'admin') return 'admin';
  return 'user';
}

/**
 * Verify a Supabase-issued access token.
 * - New projects: asymmetric keys, verified via the JWKS endpoint.
 * - Legacy projects: HS256 with the project JWT secret.
 * The user id is taken from `sub`; anything client-supplied is ignored.
 */
export async function verifySupabaseJwt(token: string): Promise<AuthUser | null> {
  try {
    let payload: JWTPayload;

    if (config.SUPABASE_JWT_SECRET) {
      const secret = new TextEncoder().encode(config.SUPABASE_JWT_SECRET);
      ({ payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
        audience: 'authenticated',
      }));
    } else {
      jwks ??= createRemoteJWKSet(new URL(config.jwksUrl));
      ({ payload } = await jwtVerify(token, jwks, {
        algorithms: ['RS256', 'ES256', 'EdDSA'],
        audience: 'authenticated',
      }));
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;

    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: roleOf(payload),
      source: 'jwt',
      scopes: ['user'],
    };
  } catch {
    return null;
  }
}
