import type { MemoryChunk, WorldbookEntry } from '../../types/worldbook';

const CJK_CHAR_REGEX = /[\u3400-\u9fff\uf900-\ufaff]/g;
const WORD_REGEX = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
const NUMBER_REGEX = /\d+(?:\.\d+)?/g;
const PUNCTUATION_REGEX = /[.,!?;:，。！？；：、]/g;

export function estimateTokenCount(text: string): number {
  if (!text) {
    return 0;
  }

  const cjkChars = text.match(CJK_CHAR_REGEX)?.length ?? 0;
  const words = text.match(WORD_REGEX)?.length ?? 0;
  const numbers = text.match(NUMBER_REGEX)?.length ?? 0;
  const punctuation = text.match(PUNCTUATION_REGEX)?.length ?? 0;

  const estimated = cjkChars * 1.5 + words + numbers * 0.5 + punctuation * 0.3;
  return Math.max(1, Math.ceil(estimated));
}

export function estimateWorldbookEntryTokens(entry: Pick<WorldbookEntry, 'keywords' | 'content'>): number {
  const keywordsText = entry.keywords.join(',');
  return estimateTokenCount(`${keywordsText}\n${entry.content}`);
}

export function sumEstimatedChunkTokens(chunks: Array<Pick<MemoryChunk, 'estimatedTokens'>>): number {
  return chunks.reduce((sum, chunk) => sum + Math.max(0, Math.trunc(chunk.estimatedTokens)), 0);
}
