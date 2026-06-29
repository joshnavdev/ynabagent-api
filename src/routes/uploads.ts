import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { UploadRequestSchema, ALLOWED_CONTENT_TYPES } from '../schemas.js';
import { createUploadUrl } from '../lib/s3.js';

export const uploadsRouter = Router();

uploadsRouter.post(
  '/',
  (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const { contentType } = UploadRequestSchema.parse(req.body);
      const ext = ALLOWED_CONTENT_TYPES[contentType];
      const key = `uploads/${randomUUID()}.${ext}`;
      const uploadUrl = await createUploadUrl(key, contentType);

      res.json({ key, uploadUrl });
    })().catch(next);
  },
);
