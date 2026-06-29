import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { env } from '../env.js';
import { TransactionsSchema, type Transaction } from '../schemas.js';
import { PROMPT_RULES } from '../constraints.js';
import { countTokens } from './tokens.js';

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}

function buildSystemPrompt(memory: string): string {
  return [
    'You extract YNAB transactions from a screenshot of a Peruvian bank or app. A single screenshot may contain multiple transactions; return every transaction.',
    'Payee rule: if a transaction has a memo/description, use the memo text as the payee; otherwise use the name shown on the screenshot.',
    'Rules:',
    PROMPT_RULES.map((rule) => `- ${rule}`).join('\n'),
    'Knowledge base (allowed categories and payee history). Choose category ONLY from the allowed list; set confidence "high" only on an exact payee match here:',
    memory,
  ].join('\n\n');
}

export async function extractTransactions(
  imageUrl: string,
  memory: string,
): Promise<Transaction[]> {
  const systemPrompt = buildSystemPrompt(memory);

  console.log(
    JSON.stringify({
      event: 'token_estimate',
      memoryTokens: countTokens(memory),
      systemPromptTokens: countTokens(systemPrompt),
    }),
  );

  const completion = await client.chat.completions.parse({
    model: env.OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all transactions from this screenshot.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    response_format: zodResponseFormat(TransactionsSchema, 'transactions'),
  });

  const usage = completion.usage;
  console.log(
    JSON.stringify({
      event: 'token_usage',
      promptTokensWithImage: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
    }),
  );

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new ExtractionError(`Model refused: ${message.refusal}`);
  }

  if (!message?.parsed) {
    throw new ExtractionError('Model returned no parsed content');
  }

  return message.parsed.transactions;
}
