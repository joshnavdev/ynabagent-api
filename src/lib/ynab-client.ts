import { z } from 'zod';
import { env } from '../env.js';
import { getTokens, putTokens, type YnabTokens } from './tokens-store.js';
import { HttpError } from '../errors.js';

const TOKEN_URL = 'https://app.ynab.com/oauth/token';
const EXPIRY_SAFETY_MARGIN_MS = 60 * 1000;

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number(),
});

function expiresAtFrom(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}

async function postToken(params: Record<string, string>): Promise<YnabTokens> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.YNAB_CLIENT_ID,
      client_secret: env.YNAB_CLIENT_SECRET,
      ...params,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(502, `YNAB token request failed: ${detail}`);
  }

  const parsed = TokenResponseSchema.parse(await response.json());
  return {
    userId: '',
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    expiresAt: expiresAtFrom(parsed.expires_in),
  };
}

export async function exchangeCode(
  userId: string,
  code: string,
): Promise<void> {
  const tokens = await postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.YNAB_REDIRECT_URI,
  });
  await putTokens({ ...tokens, userId });
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const tokens = await getTokens(userId);
  if (!tokens) {
    throw new HttpError(409, 'YNAB account not connected');
  }

  if (tokens.expiresAt - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return tokens.accessToken;
  }

  const refreshed = await postToken({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });
  await putTokens({ ...refreshed, userId });
  return refreshed.accessToken;
}
