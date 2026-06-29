import { Router, type Request, type Response, type NextFunction } from 'express';
import { GenerateRequestSchema, TransactionSchema } from '../schemas.js';
import { objectExists, createDownloadUrl } from '../lib/s3.js';
import { extractTransactions } from '../lib/openai.js';
import { getMemory } from '../lib/memory.js';

export const generateRouter = Router();

generateRouter.post(
  '/',
  (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const { keys } = GenerateRequestSchema.parse(req.body);

      const existence = await Promise.all(keys.map(objectExists));
      const missing = keys.filter((_, i) => !existence[i]);
      if (missing.length > 0) {
        res.status(404).json({ error: 'Object(s) not found in S3', missing });
        return;
      }

      const [urls, memory] = await Promise.all([
        Promise.all(keys.map(createDownloadUrl)),
        getMemory(),
      ]);

      const raw = await extractTransactions(urls, memory);

      const validation = TransactionSchema.array().safeParse(raw);
      if (!validation.success) {
        res.status(422).json({
          error: 'Extracted transactions failed validation',
          issues: validation.error.issues,
        });
        return;
      }

      res.json({ transactions: validation.data });
    })().catch(next);
  },
);
