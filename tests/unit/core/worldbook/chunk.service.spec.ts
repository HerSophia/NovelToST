import { buildMemoryChunksFromText } from '@/novelToST/core/worldbook/chunk.service';

describe('worldbook/chunk.service', () => {
  it('should keep chapter boundaries as chunk priority', () => {
    const text = [
      '第1章',
      '甲'.repeat(180),
      '',
      '第2章',
      '乙'.repeat(180),
      '',
      '第3章',
      '丙'.repeat(180),
    ].join('\n');

    const chunks = buildMemoryChunksFromText(text, {
      chunkSize: 450,
      minChunkSize: 120,
      chapterRegexPattern: '第[零一二三四五六七八九十百千万0-9]+[章回卷节部篇]',
      useCustomChapterRegex: false,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].source.length).toBeGreaterThanOrEqual(1);
    expect(chunks.every((chunk) => chunk.content.length <= 450)).toBe(true);
  });

  it('should split very large chapter into multiple chunks', () => {
    const text = ['第1章', '大'.repeat(1800)].join('\n');

    const chunks = buildMemoryChunksFromText(text, {
      chunkSize: 600,
      minChunkSize: 0,
      chapterRegexPattern: '第[零一二三四五六七八九十百千万0-9]+[章回卷节部篇]',
      useCustomChapterRegex: false,
    });

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.content.length <= 600)).toBe(true);
    expect(chunks.every((chunk) => chunk.source[0].chapterIndex === 0)).toBe(true);
  });
});
