import { API } from 'ynab';
import { z } from 'zod';
import { env } from '../env.js';
import { getTokens, putTokens, type YnabTokens } from './tokens-store.js';
import { HttpError } from '../errors.js';
import type { Transaction } from '../schemas.js';
import { toSaveTransaction, type CategoryLookup } from './ynab-mapping.js';

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

async function getValidAccessToken(userId: string): Promise<string> {
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

async function clientFor(userId: string): Promise<API> {
  const accessToken = await getValidAccessToken(userId);
  return new API(accessToken);
}

export async function listBudgets(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const client = await clientFor(userId);
  const response = await client.plans.getPlans();
  return response.data.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
  }));
}

export async function listAccounts(
  userId: string,
  budgetId: string,
): Promise<{ id: string; name: string }[]> {
  const client = await clientFor(userId);
  const response = await client.accounts.getAccounts(budgetId);
  return response.data.accounts.map((account) => ({
    id: account.id,
    name: account.name,
  }));
}

async function buildCategoryLookup(
  client: API,
  budgetId: string,
): Promise<CategoryLookup> {
  const response = await client.categories.getCategories(budgetId);
  const lookup = new Map<string, string>();
  for (const group of response.data.category_groups) {
    for (const category of group.categories) {
      lookup.set(`${group.name} > ${category.name}`, category.id);
    }
  }
  return lookup;
}

export async function pushTransactions(
  userId: string,
  budgetId: string,
  accountId: string,
  transactions: readonly Transaction[],
): Promise<number> {
  const client = await clientFor(userId);
  const categoryLookup = await buildCategoryLookup(client, budgetId);

  const saveTransactions = transactions.map((transaction) =>
    toSaveTransaction(transaction, accountId, categoryLookup),
  );

  const response = await client.transactions.createTransactions(budgetId, {
    transactions: saveTransactions,
  });

  return response.data.transaction_ids?.length ?? 0;
}
