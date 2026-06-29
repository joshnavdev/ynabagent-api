import axios from 'axios';
import { getValidAccessToken } from './ynab-client.js';

const YNAB_API_BASE = 'https://api.ynab.com/v1';

export interface YnabResponse {
  status: number;
  body: unknown;
}

async function ynabRequest(
  userId: string,
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<YnabResponse> {
  const accessToken = await getValidAccessToken(userId);
  const response = await axios.request({
    url: `${YNAB_API_BASE}${path}`,
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    data: init?.body,
    validateStatus: () => true,
  });
  return { status: response.status, body: response.data };
}

export function getPlans(userId: string): Promise<YnabResponse> {
  return ynabRequest(userId, '/budgets');
}

export function getAccounts(
  userId: string,
  planId: string,
): Promise<YnabResponse> {
  return ynabRequest(userId, `/budgets/${planId}/accounts`);
}

export function getCategories(
  userId: string,
  planId: string,
): Promise<YnabResponse> {
  return ynabRequest(userId, `/budgets/${planId}/categories`);
}

export function createTransactions(
  userId: string,
  planId: string,
  body: unknown,
): Promise<YnabResponse> {
  return ynabRequest(userId, `/budgets/${planId}/transactions`, {
    method: 'POST',
    body,
  });
}
