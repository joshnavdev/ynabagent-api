import { Router, type Request, type Response, type NextFunction } from 'express';
import { getUserId } from '../auth.js';
import { YnabCreateTransactionsSchema } from '../schemas.js';
import {
  getPlans,
  getAccounts,
  getCategories,
  createTransactions,
} from '../lib/ynab-passthrough.js';

export const plansRouter = Router();

function requirePlanId(req: Request, res: Response): string | undefined {
  const planId = req.params.planId;
  if (typeof planId !== 'string' || planId.length === 0) {
    res.status(400).json({ error: 'planId is required' });
    return undefined;
  }
  return planId;
}

plansRouter.get(
  '/',
  (_req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const userId = getUserId();
      const { status, body } = await getPlans(userId);
      res.status(status).json(body);
    })().catch(next);
  },
);

plansRouter.get(
  '/:planId/accounts',
  (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const userId = getUserId();
      const planId = requirePlanId(req, res);
      if (planId === undefined) {
        return;
      }
      const { status, body } = await getAccounts(userId, planId);
      res.status(status).json(body);
    })().catch(next);
  },
);

plansRouter.get(
  '/:planId/categories',
  (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const userId = getUserId();
      const planId = requirePlanId(req, res);
      if (planId === undefined) {
        return;
      }
      const { status, body } = await getCategories(userId, planId);
      res.status(status).json(body);
    })().catch(next);
  },
);

plansRouter.post(
  '/:planId/transactions',
  (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const userId = getUserId();
      const planId = requirePlanId(req, res);
      if (planId === undefined) {
        return;
      }
      const body = YnabCreateTransactionsSchema.parse(req.body);
      const result = await createTransactions(userId, planId, body);
      res.status(result.status).json(result.body);
    })().catch(next);
  },
);
