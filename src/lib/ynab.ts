import { API } from 'ynab';
import type { Transaction } from '../schemas.js';
import { toSaveTransaction, type CategoryLookup } from './ynab-mapping.js';
import { getValidAccessToken } from './ynab-client.js';

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
