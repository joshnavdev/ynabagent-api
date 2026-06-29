import { getValidAccessToken } from './ynab-client.js';

const YNAB_API_BASE = 'https://api.ynab.com/v1';

export interface YnabResponse {
  status: number;
  body: unknown;
}

async function ynabFetch(
  userId: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<YnabResponse> {
  const accessToken = await getValidAccessToken(userId);
  const hasBody = init?.body !== undefined;
  const response = await fetch(`${YNAB_API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    body: hasBody ? JSON.stringify(init?.body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

export function getPlans(userId: string): Promise<YnabResponse> {
  return ynabFetch(userId, '/budgets');
}

export function getAccounts(
  userId: string,
  planId: string,
): Promise<YnabResponse> {
  return ynabFetch(userId, `/budgets/${planId}/accounts`);
}

export function getCategories(
  userId: string,
  planId: string,
): Promise<YnabResponse> {
  return ynabFetch(userId, `/budgets/${planId}/categories`);
}

export function createTransactions(
  userId: string,
  planId: string,
  body: unknown,
): Promise<YnabResponse> {
  return ynabFetch(userId, `/budgets/${planId}/transactions`, {
    method: 'POST',
    body,
  });
}
