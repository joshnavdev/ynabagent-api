import { Router, type Request, type Response, type NextFunction } from 'express';
import { PushRequestSchema } from '../schemas.js';
import { getUserId } from '../auth.js';
import { pushTransactions } from '../lib/ynab.js';

export const pushRouter = Router();

pushRouter.post(
  '/',
  (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const userId = getUserId();
      const { budgetId, accountId, transactions } = PushRequestSchema.parse(
        req.body,
      );

      const created = await pushTransactions(
        userId,
        budgetId,
        accountId,
        transactions,
      );

      res.json({ created });
    })().catch(next);
  },
);
