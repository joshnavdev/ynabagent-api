import { z } from 'zod';
import { ALLOWED_CATEGORIES } from './categories.js';

export const ALLOWED_CONTENT_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

export const UploadRequestSchema = z.object({
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
});

export const GenerateRequestSchema = z.object({
  key: z.string().regex(/^uploads\/[\w-]+\.(png|jpg|webp)$/),
});

export const TransactionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Transaction date as YYYY-MM-DD'),
  payee: z
    .string()
    .describe(
      'If the transaction has a memo/description, use the memo text as the payee; otherwise use the name shown on the screenshot',
    ),
  amount: z
    .number()
    .nonnegative()
    .describe('Positive number, no currency symbol, e.g. 84.50'),
  direction: z
    .enum(['outflow', 'inflow'])
    .describe('outflow for money spent, inflow for money received'),
  category: z
    .enum(ALLOWED_CATEGORIES)
    .describe(
      'Chosen ONLY from the allowed category list. Always the full "Parent > Child" path. Never invent one',
    ),
  confidence: z
    .enum(['high', 'low'])
    .describe(
      'high ONLY if the payee is an exact match in the payee history; otherwise low',
    ),
  note: z
    .string()
    .describe(
      'Empty string unless something needs attention (e.g. original USD amount when converted)',
    ),
});

export const TransactionsSchema = z.object({
  transactions: z.array(TransactionSchema),
});

export const YnabCallbackSchema = z.object({
  code: z.string().min(1),
});

export const YnabCreateTransactionsSchema = z.record(z.string(), z.unknown());

export type UploadRequest = z.infer<typeof UploadRequestSchema>;
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Transactions = z.infer<typeof TransactionsSchema>;
export type YnabCallback = z.infer<typeof YnabCallbackSchema>;
export type YnabCreateTransactions = z.infer<typeof YnabCreateTransactionsSchema>;
