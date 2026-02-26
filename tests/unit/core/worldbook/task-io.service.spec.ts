import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import {
  WorldbookTaskIOError,
  exportSettings,
  exportTaskState,
  importSettings,
  importTaskState,
} from '@/novelToST/core/worldbook/task-io.service';
import type { SaveWorldbookTaskStateInput } from '@/novelToST/core/worldbook/history-db.service';
import type { MemoryChunk } from '@/novelToST/types/worldbook';

function createChunk(index: number): MemoryChunk {
  return {
    id: `wb-chunk-${index + 1}`,
    index,
    title: `第${index + 1}章`,
    content: `第${index + 1}章内容`,
    estimatedTokens: 15,
    source: [
      {
        chapterIndex: index,
        chapterTitle: `第${index + 1}章`,
        startOffset: 0,
        endOffset: 60,
      },
    ],
    processed: false,
    failed: false,
    processing: false,
    retryCount: 0,
    errorMessage: null,
  };
}

function createTaskStateInput(): SaveWorldbookTaskStateInput {
  return {
    processedIndex: 3,
    memoryQueue: [createChunk(0)],
    generatedEntries: [],
    categories: [],
    generatedWorldbook: {
      角色: {
        林舟: {
          关键词: ['林舟'],
          内容: '主角',
        },
      },
    },
    worldbookVolumes: [],
    currentVolumeIndex: 0,
    taskState: {
      status: 'paused',
      totalChunks: 4,
      processedChunks: 3,
      failedChunks: 0,
      currentChunkId: null,
      startedAt: 100,
      endedAt: null,
      errorMessage: null,
    },
    stats: {
      startTime: 100,
      endTime: null,
      processedChunks: 3,
      successfulChunks: 3,
      failedChunks: 0,
      generatedEntries: 4,
      totalInputTokens: 66,
      totalOutputTokens: 82,
      errors: [],
    },
    fileHash: 'hash-demo',
    novelName: '导入导出测试',
  };
}

describe('worldbook/task-io.service', () => {
  it('should export and import task state in a roundtrip', () => {
    const input = createTaskStateInput();

    const serialized = exportTaskState(input);
    const restored = importTaskState(serialized);

    expect(restored.processedIndex).toBe(3);
    expect(restored.memoryQueue).toHaveLength(1);
    expect(restored.taskState.status).toBe('paused');
    expect(restored.novelName).toBe('导入导出测试');
  });

  it('should throw understandable error when importing invalid task JSON', () => {
    expect(() => importTaskState('{invalid-json')).toThrow(WorldbookTaskIOError);
    expect(() => importTaskState('[]')).toThrow('任务状态格式无效');
  });

  it('should export and import worldbook settings only', () => {
    const settingsStore = useNovelSettingsStore();
    const current = settingsStore.settings.worldbook;

    const serialized = exportSettings(current);
    const restored = importSettings(serialized);

    expect(restored.chunkSize).toBe(current.chunkSize);
    expect(restored.customApiProvider).toBe(current.customApiProvider);
  });

  it('should accept plain worldbook settings JSON and apply defaults', () => {
    const restored = importSettings(
      JSON.stringify({
        chunkSize: 19999,
        parallelEnabled: false,
      }),
    );

    expect(restored.chunkSize).toBe(19999);
    expect(restored.parallelEnabled).toBe(false);
    expect(restored.parallelConcurrency).toBe(3);
  });

  it('should throw error for invalid worldbook settings payload', () => {
    expect(() =>
      importSettings(
        JSON.stringify({
          worldbook: {
            chunkSize: 'invalid',
          },
        }),
      ),
    ).toThrow(WorldbookTaskIOError);
  });
});
