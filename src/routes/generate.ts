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
      const { key } = GenerateRequestSchema.parse(req.body);

      const exists = await objectExists(key);
      if (!exists) {
        res.status(404).json({ error: 'Object not found in S3' });
        return;
      }

      const [url, memory] = await Promise.all([
        createDownloadUrl(key),
        getMemory(),
      ]);

      const raw = await extractTransactions(url, memory);

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
