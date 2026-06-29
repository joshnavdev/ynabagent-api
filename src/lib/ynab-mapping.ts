import type { NewTransaction } from 'ynab';
import type { Transaction } from '../schemas.js';
import { HttpError } from '../errors.js';

export type CategoryLookup = Map<string, string>;

const MILLIUNITS_PER_UNIT = 1000;

export function toSaveTransaction(
  transaction: Transaction,
  accountId: string,
  categoryLookup: CategoryLookup,
): NewTransaction {
  const categoryId = categoryLookup.get(transaction.category);
  if (!categoryId) {
    throw new HttpError(
      422,
      `No matching YNAB category for "${transaction.category}"`,
    );
  }

  const magnitude = Math.round(transaction.amount * MILLIUNITS_PER_UNIT);
  const amount = transaction.direction === 'outflow' ? -magnitude : magnitude;

  return {
    account_id: accountId,
    date: transaction.date,
    amount,
    payee_name: transaction.payee,
    category_id: categoryId,
    memo: transaction.note || undefined,
    approved: false,
  };
}
