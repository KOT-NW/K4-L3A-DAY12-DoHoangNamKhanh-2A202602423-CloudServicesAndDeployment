import { config } from '../config.js';
import { redis } from '../redis/client.js';

function period(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const key = (userId: string): string => `cost:${userId}:${period()}`;

export interface CostStatus {
  allowed: boolean;
  spent: number;
  budget: number;
}

export async function spent(userId: string): Promise<number> {
  const v = await redis.get<number | string>(key(userId));
  return Number(v ?? 0);
}

export async function check(userId: string): Promise<CostStatus> {
  const s = await spent(userId);
  return {
    allowed: s < config.MONTHLY_BUDGET_USD,
    spent: s,
    budget: config.MONTHLY_BUDGET_USD,
  };
}

export async function record(userId: string, usd: number): Promise<number> {
  const total = await redis.incrbyfloat(key(userId), usd);
  return Number(total);
}
