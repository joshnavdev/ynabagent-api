import { env } from './env.js';

export const PROMPT_RULES: readonly string[] = [
  'Amounts are in Peruvian soles (PEN) and already in the budget currency.',
  `If a transaction amount is shown in US dollars (USD), convert it to PEN using the rate ${env.USD_PEN_RATE} and put "Original: USD <amount>" in the note field.`,
  'The category must match one from the allowed list. Use only the child name (e.g. "Alquiler", not "Immediate Obligations > Alquiler"). Never invent a category.',
];
