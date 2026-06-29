import { Router, type Request, type Response, type NextFunction } from 'express';
import { YnabCallbackSchema } from '../schemas.js';
import { getUserId } from '../auth.js';
import { exchangeCode } from '../lib/ynab-client.js';

export const ynabAuthRouter = Router();

ynabAuthRouter.post(
  '/callback',
  (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const userId = getUserId();
      const { code } = YnabCallbackSchema.parse(req.body);

      await exchangeCode(userId, code);

      res.json({ connected: true });
    })().catch(next);
  },
);
