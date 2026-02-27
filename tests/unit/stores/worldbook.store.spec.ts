import { useWorldbookStore } from '@/novelToST/stores/worldbook.store';
import type { MemoryChunk } from '@/novelToST/types/worldbook';

function createChunk(index: number, id: string, estimatedTokens = 10): MemoryChunk {
  return {
    id,
    index,
    title: `chunk-${index + 1}`,
    content: `content-${index + 1}`,
    estimatedTokens,
    source: [
      {
        chapterIndex: index,
        chapterTitle: `第${index + 1}章`,
        startOffset: 0,
        endOffset: 10,
      },
    ],
    processed: false,
    failed: false,
    processing: false,
    retryCount: 0,
    errorMessage: null,
  };
}

describe('worldbook.store', () => {
  it('should manage chunk process lifecycle and progress', () => {
    const store = useWorldbookStore();

    store.prepare([createChunk(0, 'wb-chunk-1', 11), createChunk(1, 'wb-chunk-2', 13)]);
    expect(store.status).toBe('preparing');
    expect(store.totalChunks).toBe(2);

    store.start();
    expect(store.status).toBe('running');
    expect(store.stats.startTime).not.toBeNull();

    store.markChunkProcessing('wb-chunk-1');
    expect(store.currentChunkId).toBe('wb-chunk-1');

    store.markChunkSuccess({ chunkId: 'wb-chunk-1', outputTokens: 30 });
    expect(store.successfulChunks).toBe(1);
    expect(store.progressPercent).toBe(50);
    expect(store.stats.totalInputTokens).toBe(11);
    expect(store.stats.totalOutputTokens).toBe(30);

    store.markChunkProcessing('wb-chunk-2');
    store.markChunkFailure({ chunkId: 'wb-chunk-2', message: 'API timeout' });

    expect(store.failedChunks).toBe(1);
    expect(store.progressPercent).toBe(100);
    expect(store.errorMessage).toBe('API timeout');
    expect(store.stats.errors).toHaveLength(1);

    store.markCompleted();
    expect(store.status).toBe('completed');
    expect(store.stats.endTime).not.toBeNull();
  });

  it('should pause, resume, request stop and reset', () => {
    const store = useWorldbookStore();

    store.prepare([createChunk(0, 'wb-chunk-1')]);
    store.start();
    store.pause();
    expect(store.status).toBe('paused');

    store.resume();
    expect(store.status).toBe('running');

    store.requestStop();
    expect(store.status).toBe('stopping');
    expect(store.stopRequested).toBe(true);

    store.markIdle();
    expect(store.status).toBe('idle');
    expect(store.stopRequested).toBe(false);

    store.reset();
    expect(store.totalChunks).toBe(0);
    expect(store.generatedEntries).toHaveLength(0);
    expect(store.status).toBe('idle');
  });

  it('should replace chunk queue and normalize indexes', () => {
    const store = useWorldbookStore();

    store.prepare([createChunk(0, 'wb-chunk-1'), createChunk(1, 'wb-chunk-2'), createChunk(2, 'wb-chunk-3')]);
    store.markChunkProcessing('wb-chunk-2');

    store.replaceChunks([
      {
        ...createChunk(0, 'merged-1'),
        index: 0,
        content: 'merged content',
      },
      {
        ...createChunk(2, 'wb-chunk-3'),
        index: 5,
      },
    ]);

    expect(store.totalChunks).toBe(2);
    expect(store.chunks[0]).toMatchObject({ id: 'merged-1', index: 0, content: 'merged content' });
    expect(store.chunks[1]).toMatchObject({ id: 'wb-chunk-3', index: 1 });
    expect(store.currentChunkId).toBeNull();
  });

  it('should clear stale error message when restarting processing', () => {
    const store = useWorldbookStore();

    store.prepare([createChunk(0, 'wb-chunk-1')]);
    store.start();
    store.markChunkProcessing('wb-chunk-1');
    store.markChunkFailure({ chunkId: 'wb-chunk-1', message: '上轮失败' });

    expect(store.errorMessage).toBe('上轮失败');

    store.setStatus('completed');
    store.start();

    expect(store.status).toBe('running');
    expect(store.errorMessage).toBeNull();
  });
});
