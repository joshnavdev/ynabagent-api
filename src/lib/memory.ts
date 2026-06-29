import { env } from '../env.js';
import { getObjectText } from './s3.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { value: string; expiresAt: number } | null = null;

export async function getMemory(): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }

  const text = await getObjectText(env.YNAB_MEMORY_KEY);
  cache = { value: text, expiresAt: now + CACHE_TTL_MS };
  return text;
}
