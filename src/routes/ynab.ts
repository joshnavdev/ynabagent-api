import { Router, type Request, type Response, type NextFunction } from 'express';
import { getUserId } from '../auth.js';
import { listBudgets, listAccounts } from '../lib/ynab.js';

export const ynabRouter = Router();

ynabRouter.get(
  '/budgets',
  (_req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const userId = getUserId();
      const budgets = await listBudgets(userId);
      res.json({ budgets });
    })().catch(next);
  },
);

ynabRouter.get(
  '/budgets/:budgetId/accounts',
  (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const userId = getUserId();
      const budgetId = req.params.budgetId;
      if (typeof budgetId !== 'string' || budgetId.length === 0) {
        res.status(400).json({ error: 'budgetId is required' });
        return;
      }
      const accounts = await listAccounts(userId, budgetId);
      res.json({ accounts });
    })().catch(next);
  },
);
