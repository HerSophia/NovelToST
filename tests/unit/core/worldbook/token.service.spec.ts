import { estimateTokenCount, estimateWorldbookEntryTokens, sumEstimatedChunkTokens } from '@/novelToST/core/worldbook/token.service';

describe('worldbook/token.service', () => {
  it('should estimate token count for mixed text', () => {
    expect(estimateTokenCount('')).toBe(0);

    const count = estimateTokenCount('你好 world 123!');
    expect(count).toBeGreaterThan(0);
  });

  it('should estimate worldbook entry tokens and sum chunk tokens', () => {
    const entryTokens = estimateWorldbookEntryTokens({
      keywords: ['主角', '成长'],
      content: '主角在这一章中面对关键抉择。',
    });

    expect(entryTokens).toBeGreaterThan(0);

    const total = sumEstimatedChunkTokens([
      { estimatedTokens: 12 },
      { estimatedTokens: 8 },
      { estimatedTokens: -1 },
    ]);

    expect(total).toBe(20);
  });
});
