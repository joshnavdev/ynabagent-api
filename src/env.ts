import { z } from 'zod';

const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  UPLOAD_BUCKET: z.string().min(1),
  AWS_REGION: z.string().default('us-east-1'),
  USD_PEN_RATE: z.coerce.number().positive().default(3.75),
  YNAB_MEMORY_KEY: z.string().default('config/ynab_memory.md'),
  YNAB_TOKENS_TABLE: z.string().min(1),
  YNAB_CLIENT_ID: z.string().min(1),
  YNAB_CLIENT_SECRET: z.string().min(1),
  YNAB_REDIRECT_URI: z.string().url(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
