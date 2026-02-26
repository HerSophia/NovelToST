import {
  createMemoryWorldbookHistoryDbBackend,
  createWorldbookHistoryDBService,
  type SaveWorldbookTaskStateInput,
} from '@/novelToST/core/worldbook/history-db.service';
import type { MemoryChunk } from '@/novelToST/types/worldbook';

function createChunk(index: number): MemoryChunk {
  return {
    id: `wb-chunk-${index + 1}`,
    index,
    title: `第${index + 1}章`,
    content: `这是第${index + 1}章内容。`,
    estimatedTokens: 20,
    source: [
      {
        chapterIndex: index,
        chapterTitle: `第${index + 1}章`,
        startOffset: 0,
        endOffset: 120,
      },
    ],
    processed: false,
    failed: false,
    processing: false,
    retryCount: 0,
    errorMessage: null,
  };
}

function createPersistedStateInput(): SaveWorldbookTaskStateInput {
  return {
    processedIndex: 1,
    memoryQueue: [createChunk(0), createChunk(1)],
    generatedEntries: [
      {
        id: 'entry-1',
        category: '角色',
        name: '林舟',
        keywords: ['林舟'],
        content: '主角',
        sourceChunkIds: ['wb-chunk-1'],
      },
    ],
    categories: [
      {
        name: '角色',
        enabled: true,
        isBuiltin: true,
        entries: [],
      },
    ],
    generatedWorldbook: {
      角色: {
        林舟: {
          关键词: ['林舟'],
          内容: '主角',
        },
      },
    },
    worldbookVolumes: [{ name: '卷一', entryCount: 1 }],
    currentVolumeIndex: 0,
    taskState: {
      status: 'running',
      totalChunks: 2,
      processedChunks: 1,
      failedChunks: 0,
      currentChunkId: 'wb-chunk-2',
      startedAt: 1000,
      endedAt: null,
      errorMessage: null,
    },
    stats: {
      startTime: 1000,
      endTime: null,
      processedChunks: 1,
      successfulChunks: 1,
      failedChunks: 0,
      generatedEntries: 1,
      totalInputTokens: 20,
      totalOutputTokens: 18,
      errors: [],
    },
    fileHash: 'hash-001',
    novelName: '测试小说',
  };
}

describe('worldbook/history-db.service', () => {
  it('should save, load and clear state with deep-clone protection', async () => {
    const service = createWorldbookHistoryDBService({
      backend: createMemoryWorldbookHistoryDbBackend(),
    });

    await service.saveState(createPersistedStateInput());

    const loaded = await service.loadState();
    expect(loaded).not.toBeNull();
    expect(loaded?.processedIndex).toBe(1);
    expect(loaded?.memoryQueue).toHaveLength(2);
    expect(loaded?.generatedEntries).toHaveLength(1);

    if (loaded) {
      loaded.memoryQueue[0].title = '已被篡改';
    }

    const reloaded = await service.loadState();
    expect(reloaded?.memoryQueue[0]?.title).toBe('第1章');

    await service.clearState();
    await expect(service.loadState()).resolves.toBeNull();
  });

  it('should save history and rollback to a specific history id', async () => {
    const service = createWorldbookHistoryDBService({
      backend: createMemoryWorldbookHistoryDbBackend(),
    });

    const id1 = await service.saveHistory({
      memoryIndex: 0,
      memoryTitle: '第1章',
      previousWorldbook: { role: 'old-1' },
      newWorldbook: { role: 'new-1' },
      changedEntries: ['entry-1'],
    });

    const id2 = await service.saveHistory({
      memoryIndex: 1,
      memoryTitle: '第2章',
      previousWorldbook: { role: 'old-2' },
      newWorldbook: { role: 'new-2' },
      changedEntries: ['entry-2'],
    });

    await service.saveHistory({
      memoryIndex: 2,
      memoryTitle: '第3章',
      previousWorldbook: { role: 'old-3' },
      newWorldbook: { role: 'new-3' },
      changedEntries: ['entry-3'],
    });

    const rolled = await service.rollbackToHistory(id2);
    expect(rolled.id).toBe(id2);
    expect(rolled.memoryTitle).toBe('第2章');

    const remain = await service.getAllHistory();
    expect(remain.map((item) => item.id)).toEqual([id1]);
  });

  it('should manage hash, categories, chunk roll and entry roll records', async () => {
    const service = createWorldbookHistoryDBService({
      backend: createMemoryWorldbookHistoryDbBackend(),
    });

    await service.saveFileHash('hash-abc');
    await expect(service.getSavedFileHash()).resolves.toBe('hash-abc');
    await service.clearFileHash();
    await expect(service.getSavedFileHash()).resolves.toBeNull();

    const categories = [{ name: '角色', enabled: true }];
    await service.saveCustomCategories(categories);
    await expect(service.getCustomCategories()).resolves.toEqual(categories);

    await service.saveRollResult(0, { pass: 1 });
    await service.saveRollResult(0, { pass: 2 });
    const rollResults = await service.getRollResults(0);
    expect(rollResults).toHaveLength(2);

    await service.clearRollResults(0);
    await expect(service.getRollResults(0)).resolves.toHaveLength(0);

    const entryRollId = await service.saveEntryRollResult('角色', '林舟', 0, { content: 'roll' }, '自定义提示词');
    const entryRoll = await service.getEntryRollById(entryRollId);
    expect(entryRoll?.entryKey).toBe('角色:林舟');

    const entryRolls = await service.getEntryRollResults('角色', '林舟');
    expect(entryRolls).toHaveLength(1);

    await service.clearEntryRollResults('角色', '林舟');
    await expect(service.getEntryRollResults('角色', '林舟')).resolves.toHaveLength(0);
  });
});
