import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  CORS_ORIGINS: z.string().default(''),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),

  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_IP_PER_MINUTE: z.coerce.number().int().positive().default(120),
  AUTH_MAX_FAILURES: z.coerce.number().int().positive().default(5),
  AUTH_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),
  MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(10),

  AGENT_INTERNAL_URL: z.string().url().optional(),
  INTERNAL_TOKEN: z.string().min(16).optional(),
});

// Treat empty strings in .env as "not set" so optional vars can stay blank.
const source: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (typeof v === 'string' && v.trim() !== '') source[k] = v;
}

const parsed = schema.safeParse(source);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // Fail fast: a missing secret must stop boot, never fall back to a default.
  console.error(`[config] Invalid environment:\n${issues}`);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  ...env,
  isProd: env.NODE_ENV === 'production',
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwksUrl:
    env.SUPABASE_JWKS_URL ??
    `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
} as const;

export type Config = typeof config;
