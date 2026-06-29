import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { uploadsRouter } from './routes/uploads.js';
import { generateRouter } from './routes/generate.js';
import { ynabAuthRouter } from './routes/ynab-auth.js';
import { ynabRouter } from './routes/ynab.js';
import { plansRouter } from './routes/plans.js';
import { pushRouter } from './routes/push.js';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok' });
});

app.use('/uploads', uploadsRouter);
app.use('/generate', generateRouter);
app.use('/auth/ynab', ynabAuthRouter);
app.use('/ynab', ynabRouter);
app.use('/plans', plansRouter);
app.use('/transactions/push', pushRouter);

function hasStatusCode(err: unknown): err is Error & { statusCode: number } {
  return err instanceof Error && 'statusCode' in err && typeof err.statusCode === 'number';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express requires 4 params for error middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', issues: err.issues });
    return;
  }

  if (hasStatusCode(err)) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
