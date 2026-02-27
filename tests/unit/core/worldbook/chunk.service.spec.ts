import { buildMemoryChunksFromText, mergeAdjacentChunks } from '@/novelToST/core/worldbook/chunk.service';
import type { MemoryChunk } from '@/novelToST/types/worldbook';

function createChunk(index: number, id?: string): MemoryChunk {
  return {
    id: id ?? `wb-chunk-${index + 1}`,
    index,
    title: `第${index + 1}章`,
    content: `内容-${index + 1}`,
    estimatedTokens: 10,
    source: [
      {
        chapterIndex: index,
        chapterTitle: `第${index + 1}章`,
        startOffset: 0,
        endOffset: 100,
      },
    ],
    processed: false,
    failed: false,
    processing: false,
    retryCount: 0,
    errorMessage: null,
  };
}

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

  it('should merge current chunk with previous chunk when direction is up', () => {
    const chunks = [createChunk(0, 'a'), createChunk(1, 'b'), createChunk(2, 'c')];
    chunks[0].content = '上块内容';
    chunks[1].content = '当前内容';

    const result = mergeAdjacentChunks(chunks, 1, 'up');

    expect(result.baseChunkId).toBe('a');
    expect(result.removedChunkId).toBe('b');
    expect(result.mergedIndex).toBe(0);
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0]).toMatchObject({
      id: 'a',
      index: 0,
      content: '上块内容\n\n当前内容',
      processed: false,
      failed: false,
      retryCount: 0,
    });
    expect(result.chunks[1]).toMatchObject({ id: 'c', index: 1 });
  });

  it('should merge current chunk with next chunk when direction is down', () => {
    const chunks = [createChunk(0, 'a'), createChunk(1, 'b'), createChunk(2, 'c')];
    chunks[1].content = '当前内容';
    chunks[2].content = '下块内容';

    const result = mergeAdjacentChunks(chunks, 1, 'down');

    expect(result.baseChunkId).toBe('b');
    expect(result.removedChunkId).toBe('c');
    expect(result.mergedIndex).toBe(1);
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[1]).toMatchObject({
      id: 'b',
      index: 1,
      content: '当前内容\n\n下块内容',
      processed: false,
      failed: false,
    });
  });

  it('should throw when trying to merge the first chunk upward', () => {
    const chunks = [createChunk(0), createChunk(1)];
    expect(() => mergeAdjacentChunks(chunks, 0, 'up')).toThrow('首块');
  });
});
