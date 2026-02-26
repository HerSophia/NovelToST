import { WorldbookApiError } from '@/novelToST/core/worldbook/api.service';
import { parseWorldbookEntriesFromResponse, processWorldbookChunks } from '@/novelToST/core/worldbook/process.service';
import type { MemoryChunk } from '@/novelToST/types/worldbook';

function createChunk(index: number): MemoryChunk {
  return {
    id: `wb-chunk-${index + 1}`,
    index,
    title: `第${index + 1}章`,
    content: `这是第${index + 1}章的内容。`,
    estimatedTokens: 30,
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    globalThis.setTimeout(resolve, ms);
  });
}

function waitWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      globalThis.clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

describe('worldbook/process.service', () => {
  it('should parse JSON response into worldbook entries', () => {
    const entries = parseWorldbookEntriesFromResponse(
      '```json\n{"entries":[{"category":"角色","name":"林舟","keywords":["林舟"],"content":"主角设定"}]}\n```',
      createChunk(0),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      category: '角色',
      name: '林舟',
    });
  });

  it('should respect parallel concurrency limit in independent mode', async () => {
    const chunks = Array.from({ length: 5 }, (_, index) => createChunk(index));
    let active = 0;
    let maxActive = 0;

    const summary = await processWorldbookChunks({
      chunks,
      processing: {
        parallelEnabled: true,
        parallelConcurrency: 2,
        parallelMode: 'independent',
      },
      maxRetries: 0,
      retryBackoffMs: 0,
      buildPrompt: chunk => chunk.content,
      executeChunk: async ({ chunk }) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await sleep(30);
        active -= 1;

        return {
          responseText: JSON.stringify({
            entries: [
              {
                category: '剧情节点',
                name: `节点-${chunk.index + 1}`,
                keywords: [`节点-${chunk.index + 1}`],
                content: '剧情推进',
              },
            ],
          }),
        };
      },
      parseEntries: parseWorldbookEntriesFromResponse,
    });

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(summary.total).toBe(5);
    expect(summary.succeeded).toBe(5);
    expect(summary.failed).toBe(0);
    expect(summary.completed).toBe(true);
  });

  it('should retry failed chunk and eventually succeed', async () => {
    const chunks = [createChunk(0)];
    const attempts = new Map<string, number>();

    const summary = await processWorldbookChunks({
      chunks,
      processing: {
        parallelEnabled: false,
        parallelConcurrency: 1,
        parallelMode: 'independent',
      },
      maxRetries: 1,
      retryBackoffMs: 0,
      buildPrompt: chunk => chunk.content,
      executeChunk: async ({ chunk }) => {
        const nextAttempt = (attempts.get(chunk.id) ?? 0) + 1;
        attempts.set(chunk.id, nextAttempt);

        if (nextAttempt === 1) {
          throw new WorldbookApiError('rate limit', {
            type: 'rate_limit',
            provider: 'test-api',
          });
        }

        return {
          responseText: JSON.stringify({
            entries: [
              {
                category: '角色',
                name: '重试成功',
                keywords: ['重试'],
                content: '第二次请求成功',
              },
            ],
          }),
        };
      },
      parseEntries: parseWorldbookEntriesFromResponse,
    });

    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.results[0]?.attempt).toBe(2);
  });

  it('should stop processing quickly when stop flag is raised', async () => {
    const chunks = Array.from({ length: 6 }, (_, index) => createChunk(index));
    let stopped = false;

    const summary = await processWorldbookChunks({
      chunks,
      processing: {
        parallelEnabled: true,
        parallelConcurrency: 2,
        parallelMode: 'independent',
      },
      maxRetries: 0,
      retryBackoffMs: 0,
      control: {
        isStopped: () => stopped,
      },
      buildPrompt: chunk => chunk.content,
      executeChunk: async ({ chunk, signal }) => {
        if (chunk.index === 0) {
          stopped = true;
        }

        await waitWithAbort(120, signal);

        return {
          responseText: JSON.stringify({
            entries: [
              {
                category: '剧情节点',
                name: `节点-${chunk.index + 1}`,
                keywords: ['节点'],
                content: '不会全部执行完',
              },
            ],
          }),
        };
      },
      parseEntries: parseWorldbookEntriesFromResponse,
    });

    expect(summary.stopped).toBe(true);
    expect(summary.skipped).toBeGreaterThan(0);
    expect(summary.succeeded + summary.failed + summary.skipped).toBe(summary.total);
  });
});
