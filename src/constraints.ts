import { env } from './env.js';

export const PROMPT_RULES: readonly string[] = [
  'Amounts are in Peruvian soles (PEN) and already in the budget currency.',
  `If a transaction amount is shown in US dollars (USD), convert it to PEN using the rate ${env.USD_PEN_RATE} and put "Original: USD <amount>" in the note field.`,
  'The category must match one from the allowed list (Parent > Child). If a category in the list shows a ">" symbol, output only the child portion (the part after ">").',
];
