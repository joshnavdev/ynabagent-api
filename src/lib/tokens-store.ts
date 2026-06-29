import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { env } from '../env.js';

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: env.AWS_REGION }),
);

export const YnabTokensSchema = z.object({
  userId: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
});

export type YnabTokens = z.infer<typeof YnabTokensSchema>;

export async function getTokens(userId: string): Promise<YnabTokens | null> {
  const result = await client.send(
    new GetCommand({
      TableName: env.YNAB_TOKENS_TABLE,
      Key: { userId },
    }),
  );

  if (!result.Item) {
    return null;
  }

  return YnabTokensSchema.parse(result.Item);
}

export async function putTokens(tokens: YnabTokens): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: env.YNAB_TOKENS_TABLE,
      Item: tokens,
    }),
  );
}
