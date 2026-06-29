import { encodingForModel } from 'js-tiktoken';

const enc = encodingForModel('gpt-4o');

export function countTokens(text: string): number {
  return enc.encode(text).length;
}
