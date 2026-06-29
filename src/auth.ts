import { getCurrentInvoke } from '@codegenie/serverless-express';
import { z } from 'zod';
import { HttpError } from './errors.js';

const InvokeSchema = z.object({
  event: z.object({
    requestContext: z.object({
      authorizer: z.object({
        jwt: z.object({
          claims: z.object({
            sub: z.string().min(1),
          }),
        }),
      }),
    }),
  }),
});

export function getUserId(): string {
  const invoke: unknown = getCurrentInvoke();

  const parsed = InvokeSchema.safeParse(invoke);
  if (!parsed.success) {
    throw new HttpError(401, 'Missing or invalid authentication context');
  }

  return parsed.data.event.requestContext.authorizer.jwt.claims.sub;
}
