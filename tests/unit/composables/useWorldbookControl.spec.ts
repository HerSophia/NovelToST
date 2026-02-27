import {
  applyWorldbookStartChunkIndex,
  resolveWorldbookStartChunkIndex,
  useWorldbookControl,
} from '@/novelToST/composables/useWorldbookControl';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import { useWorldbookStore } from '@/novelToST/stores/worldbook.store';
import type {
  MemoryChunk,
  WorldbookEntry,
  WorldbookProcessOptions,
  WorldbookProcessStats,
  WorldbookProcessSummary,
} from '@/novelToST/types/worldbook';
import { stMocks } from '../../setup/st-globals.mock';

const apiServiceMock = vi.hoisted(() => ({
  fetchCustomApiModels: vi.fn(),
  quickTestWorldbookApi: vi.fn(),
}));

const processServiceMock = vi.hoisted(() => ({
  createWorldbookChunkExecutor: vi.fn(),
  processWorldbookChunks: vi.fn(),
}));

vi.mock('@/novelToST/core/worldbook/api.service', async () => {
  const actual = await vi.importActual<typeof import('@/novelToST/core/worldbook/api.service')>(
    '@/novelToST/core/worldbook/api.service',
  );

  return {
    ...actual,
    fetchCustomApiModels: apiServiceMock.fetchCustomApiModels,
    quickTestWorldbookApi: apiServiceMock.quickTestWorldbookApi,
  };
});

vi.mock('@/novelToST/core/worldbook/process.service', async () => {
  const actual = await vi.importActual<typeof import('@/novelToST/core/worldbook/process.service')>(
    '@/novelToST/core/worldbook/process.service',
  );

  return {
    ...actual,
    createWorldbookChunkExecutor: processServiceMock.createWorldbookChunkExecutor,
    processWorldbookChunks: processServiceMock.processWorldbookChunks,
  };
});

function createChunk(index: number, id: string): MemoryChunk {
  return {
    id,
    index,
    title: `块${index + 1}`,
    content: `内容-${index + 1}`,
    estimatedTokens: 16,
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

function createEntry(id: string, chunkId: string): WorldbookEntry {
  return {
    id,
    category: '角色',
    name: id,
    keywords: [id],
    content: `内容-${id}`,
    sourceChunkIds: [chunkId],
  };
}

function createStats(): WorldbookProcessStats {
  return {
    startTime: null,
    endTime: null,
    processedChunks: 0,
    successfulChunks: 0,
    failedChunks: 0,
    generatedEntries: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    errors: [],
  };
}

describe('useWorldbookControl', () => {
  beforeEach(() => {
    apiServiceMock.fetchCustomApiModels.mockReset();
    apiServiceMock.quickTestWorldbookApi.mockReset();
    processServiceMock.createWorldbookChunkExecutor.mockReset();
    processServiceMock.processWorldbookChunks.mockReset();
    processServiceMock.createWorldbookChunkExecutor.mockReturnValue(vi.fn());
    processServiceMock.processWorldbookChunks.mockImplementation(async (
      options: WorldbookProcessOptions,
    ): Promise<WorldbookProcessSummary> => {
      const pendingChunks = options.chunks.filter((chunk: MemoryChunk) => !chunk.processed || chunk.failed);

      options.hooks?.onStart?.({
        total: options.chunks.length,
        pending: pendingChunks.length,
      });

      for (const chunk of pendingChunks) {
        options.hooks?.onChunkStart?.(chunk, 1);
        options.hooks?.onChunkSuccess?.(chunk, {
          chunkId: chunk.id,
          chunkIndex: chunk.index,
          attempt: 1,
          elapsedMs: 1,
          responseText: '{}',
          outputTokens: 1,
          entries: [],
          raw: {},
        });
      }

      const summary = {
        total: pendingChunks.length,
        succeeded: pendingChunks.length,
        failed: 0,
        skipped: 0,
        completed: true,
        stopped: false,
        results: [],
        failures: [],
      };
      options.hooks?.onComplete?.(summary);
      return summary;
    });
    vi.stubGlobal('confirm', vi.fn(() => true));
  });
  it('should fetch model list and sync selected model', async () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({
      worldbook: {
        useTavernApi: false,
        customApiProvider: 'openai-compatible',
        customApiEndpoint: 'http://127.0.0.1:5000/v1',
        customApiModel: '',
      },
    });

    apiServiceMock.fetchCustomApiModels.mockResolvedValue({
      provider: 'openai-compatible',
      models: ['model-a', 'model-b'],
      raw: { data: [] },
    });

    const ctrl = useWorldbookControl();
    await ctrl.fetchModelList();

    expect(ctrl.modelOptions.value).toEqual(['model-a', 'model-b']);
    expect(settingsStore.settings.worldbook.customApiModel).toBe('model-a');
    expect(ctrl.modelStatusType.value).toBe('success');
    expect(ctrl.modelStatusMessage.value).toContain('2');
    expect(stMocks.toastr.success).toHaveBeenCalledWith('模型列表拉取成功，共 2 个');
  });

  it('should show warning when fetching model list in tavern mode', async () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({
      worldbook: {
        useTavernApi: true,
      },
    });

    const ctrl = useWorldbookControl();
    await ctrl.fetchModelList();

    expect(apiServiceMock.fetchCustomApiModels).not.toHaveBeenCalled();
    expect(ctrl.modelStatusType.value).toBe('error');
    expect(ctrl.modelStatusMessage.value).toContain('SillyTavern');
    expect(stMocks.toastr.warning).toHaveBeenCalledWith('当前为 SillyTavern API 模式，无需拉取模型列表');
  });

  it('should record fetch error status when model list request fails', async () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({
      worldbook: {
        useTavernApi: false,
        customApiProvider: 'openai-compatible',
      },
    });

    apiServiceMock.fetchCustomApiModels.mockRejectedValue(new Error('endpoint 无效'));

    const ctrl = useWorldbookControl();
    await ctrl.fetchModelList();

    expect(ctrl.modelOptions.value).toEqual([]);
    expect(ctrl.modelStatusType.value).toBe('error');
    expect(ctrl.modelStatusMessage.value).toBe('endpoint 无效');
    expect(stMocks.toastr.error).toHaveBeenCalledWith('endpoint 无效', '模型列表拉取失败');
  });

  it('should run quick API test and update success feedback', async () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({
      worldbook: {
        useTavernApi: false,
      },
    });

    apiServiceMock.quickTestWorldbookApi.mockResolvedValue({
      provider: 'openai-compatible',
      elapsedMs: 87,
      responseText: 'OK',
      outputTokens: 1,
    });

    const ctrl = useWorldbookControl();
    await ctrl.quickTestApi();

    expect(ctrl.modelStatusType.value).toBe('success');
    expect(ctrl.modelStatusMessage.value).toContain('87ms');
    expect(ctrl.modelStatusMessage.value).toContain('openai-compatible');
    expect(stMocks.toastr.success).toHaveBeenCalledWith('API 连接测试成功（87ms）');
  });

  it('should record quick API test error feedback when request fails', async () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({
      worldbook: {
        useTavernApi: false,
      },
    });

    apiServiceMock.quickTestWorldbookApi.mockRejectedValue(new Error('鉴权失败'));

    const ctrl = useWorldbookControl();
    await ctrl.quickTestApi();

    expect(ctrl.modelStatusType.value).toBe('error');
    expect(ctrl.modelStatusMessage.value).toBe('鉴权失败');
    expect(stMocks.toastr.error).toHaveBeenCalledWith('鉴权失败', 'API 测试失败');
  });

  it('should support multi-select delete and undo', () => {
    const wbStore = useWorldbookStore();
    wbStore.hydrate({
      status: 'completed',
      chunks: [createChunk(0, 'chunk-a')],
      generatedEntries: [createEntry('entry-a', 'chunk-a'), createEntry('entry-b', 'chunk-a')],
      categories: [],
      currentChunkId: null,
      errorMessage: null,
      stopRequested: false,
      stats: createStats(),
    });

    const ctrl = useWorldbookControl();
    ctrl.removeEntries(['entry-a', 'entry-b'], { skipConfirm: true });

    expect(wbStore.generatedEntries).toHaveLength(0);
    expect(ctrl.canUndoEdit.value).toBe(true);

    ctrl.undoLastEdit();

    expect(wbStore.generatedEntries.map(entry => entry.id)).toEqual(['entry-a', 'entry-b']);
    expect(ctrl.canUndoEdit.value).toBe(false);
  });

  it('should merge chunk down and clear affected entries', () => {
    const wbStore = useWorldbookStore();
    const chunkA = { ...createChunk(0, 'chunk-a'), content: 'A', processed: true };
    const chunkB = { ...createChunk(1, 'chunk-b'), content: 'B', processed: true };
    const chunkC = { ...createChunk(2, 'chunk-c'), content: 'C', processed: true };

    wbStore.hydrate({
      status: 'completed',
      chunks: [chunkA, chunkB, chunkC],
      generatedEntries: [
        createEntry('entry-a', 'chunk-a'),
        createEntry('entry-b', 'chunk-b'),
        createEntry('entry-c', 'chunk-c'),
      ],
      categories: [],
      currentChunkId: null,
      errorMessage: null,
      stopRequested: false,
      stats: createStats(),
    });

    const ctrl = useWorldbookControl();
    ctrl.mergeChunkDown(0);

    expect(wbStore.chunks).toHaveLength(2);
    expect(wbStore.chunks[0]).toMatchObject({
      id: 'chunk-a',
      index: 0,
      content: 'A\n\nB',
      processed: false,
      failed: false,
    });
    expect(wbStore.generatedEntries.map(entry => entry.id)).toEqual(['entry-c']);
    expect(ctrl.canUndoEdit.value).toBe(true);
  });

  it('should allow start when pending chunk exists even if input text is empty', () => {
    const wbStore = useWorldbookStore();
    wbStore.hydrate({
      status: 'idle',
      chunks: [createChunk(0, 'chunk-a')],
      generatedEntries: [],
      categories: [],
      currentChunkId: null,
      errorMessage: null,
      stopRequested: false,
      stats: createStats(),
    });

    const ctrl = useWorldbookControl();

    expect(ctrl.inputText.value).toBe('');
    expect(ctrl.canStart.value).toBe(true);
  });

  it('should clamp start chunk index into valid queue range', () => {
    expect(resolveWorldbookStartChunkIndex(0, 5)).toBe(0);
    expect(resolveWorldbookStartChunkIndex(6, -3)).toBe(0);
    expect(resolveWorldbookStartChunkIndex(6, 3.9)).toBe(2);
    expect(resolveWorldbookStartChunkIndex(6, 999)).toBe(5);
  });

  it('should mark chunks before start index as skipped-processed', () => {
    const chunks = [createChunk(0, 'chunk-a'), createChunk(1, 'chunk-b'), createChunk(2, 'chunk-c')];
    chunks[0].failed = true;
    chunks[0].retryCount = 2;
    chunks[0].errorMessage = '旧错误';

    const result = applyWorldbookStartChunkIndex(chunks, 3);

    expect(result.effectiveStartIndex).toBe(2);
    expect(result.skippedCount).toBe(2);
    expect(result.chunks[0]).toMatchObject({ processed: true, failed: false, retryCount: 0, errorMessage: null });
    expect(result.chunks[1]).toMatchObject({ processed: true, failed: false, retryCount: 0, errorMessage: null });
    expect(result.chunks[2]).toMatchObject({ processed: false, failed: false });
    expect(chunks[0].processed).toBe(false);
  });

  it('should retry single failed chunk from repair queue', async () => {
    const wbStore = useWorldbookStore();
    wbStore.hydrate({
      status: 'completed',
      chunks: [
        { ...createChunk(0, 'chunk-a'), processed: true },
        { ...createChunk(1, 'chunk-b'), failed: true, retryCount: 2, errorMessage: '超时' },
        { ...createChunk(2, 'chunk-c'), failed: true, retryCount: 1, errorMessage: '429' },
      ],
      generatedEntries: [],
      categories: [],
      currentChunkId: null,
      errorMessage: '上一轮失败',
      stopRequested: false,
      stats: createStats(),
    });

    const ctrl = useWorldbookControl();
    await ctrl.retryFailedChunk(1);

    expect(processServiceMock.processWorldbookChunks).toHaveBeenCalledTimes(1);
    expect(processServiceMock.processWorldbookChunks).toHaveBeenCalledWith(
      expect.objectContaining({
        chunks: expect.arrayContaining([
          expect.objectContaining({ id: 'chunk-b' }),
        ]),
      }),
    );
    const retriedChunks = processServiceMock.processWorldbookChunks.mock.calls[0][0].chunks as MemoryChunk[];
    expect(retriedChunks).toHaveLength(1);
    expect(retriedChunks[0]?.id).toBe('chunk-b');

    expect(wbStore.chunks[1]).toMatchObject({ processed: true, failed: false, errorMessage: null });
    expect(wbStore.chunks[2]).toMatchObject({ processed: false, failed: true });
  });

  it('should retry all failed chunks in batch', async () => {
    const wbStore = useWorldbookStore();
    wbStore.hydrate({
      status: 'completed',
      chunks: [
        { ...createChunk(0, 'chunk-a'), failed: true, retryCount: 1, errorMessage: '超时' },
        { ...createChunk(1, 'chunk-b'), processed: true },
        { ...createChunk(2, 'chunk-c'), failed: true, retryCount: 3, errorMessage: 'JSON 错误' },
      ],
      generatedEntries: [],
      categories: [],
      currentChunkId: null,
      errorMessage: '失败',
      stopRequested: false,
      stats: createStats(),
    });

    const ctrl = useWorldbookControl();
    await ctrl.retryAllFailedChunks();

    const retriedChunks = processServiceMock.processWorldbookChunks.mock.calls[0][0].chunks as MemoryChunk[];
    expect(retriedChunks.map((chunk) => chunk.id)).toEqual(['chunk-a', 'chunk-c']);
  });

  it('should skip retry-all action when there is no failed chunk', async () => {
    const wbStore = useWorldbookStore();
    wbStore.hydrate({
      status: 'completed',
      chunks: [{ ...createChunk(0, 'chunk-a'), processed: true }],
      generatedEntries: [],
      categories: [],
      currentChunkId: null,
      errorMessage: null,
      stopRequested: false,
      stats: createStats(),
    });

    const ctrl = useWorldbookControl();
    await ctrl.retryAllFailedChunks();

    expect(processServiceMock.processWorldbookChunks).not.toHaveBeenCalled();
    expect(stMocks.toastr.info).toHaveBeenCalledWith('当前没有失败块需要修复');
  });

  it('should prepare import preview and merge imported entries in replace mode', async () => {
    const wbStore = useWorldbookStore();
    wbStore.hydrate({
      status: 'completed',
      chunks: [createChunk(0, 'chunk-a')],
      generatedEntries: [
        {
          id: 'entry-existing',
          category: '角色',
          name: '林舟',
          keywords: ['林舟'],
          content: '旧设定',
          sourceChunkIds: ['chunk-a'],
        },
      ],
      categories: [],
      currentChunkId: null,
      errorMessage: null,
      stopRequested: false,
      stats: createStats(),
    });

    const ctrl = useWorldbookControl();
    const file = new File(
      [
        JSON.stringify({
          entries: [
            {
              uid: 1,
              comment: '角色 - 林舟',
              key: ['林舟', '主角'],
              content: '导入设定',
            },
            {
              uid: 2,
              comment: '地点 - 云港',
              key: ['云港'],
              content: '新增地点',
              position: 1,
              depth: 4,
              order: 160,
            },
          ],
        }),
      ],
      'import-worldbook.json',
      { type: 'application/json' },
    );

    await ctrl.doPrepareImportEntries(file);

    expect(ctrl.entryImportPreview.value?.preview.newEntries).toHaveLength(1);
    expect(ctrl.entryImportPreview.value?.preview.allDuplicates).toHaveLength(1);

    const merged = await ctrl.doConfirmImportEntriesMerge({ mode: 'replace' });
    expect(merged).toBe(true);
    expect(ctrl.entryImportPreview.value).toBeNull();
    expect(wbStore.generatedEntries.find(entry => entry.category === '角色' && entry.name === '林舟')?.content).toBe('导入设定');
    expect(wbStore.generatedEntries.find(entry => entry.category === '地点' && entry.name === '云港')).toBeDefined();
  });

  it('should support alias merge options when confirming import', async () => {
    const wbStore = useWorldbookStore();
    wbStore.hydrate({
      status: 'completed',
      chunks: [createChunk(0, 'chunk-a')],
      generatedEntries: [
        {
          id: 'entry-existing',
          category: '角色',
          name: '林舟',
          keywords: ['林舟'],
          content: '旧设定',
          sourceChunkIds: ['chunk-a'],
        },
      ],
      categories: [],
      currentChunkId: null,
      errorMessage: null,
      stopRequested: false,
      stats: createStats(),
    });

    const ctrl = useWorldbookControl();
    const file = new File(
      [
        JSON.stringify({
          entries: [
            {
              uid: 1,
              comment: '角色 - 阿舟',
              key: ['阿舟'],
              content: '外号补充',
            },
          ],
        }),
      ],
      'import-worldbook-alias.json',
      { type: 'application/json' },
    );

    await ctrl.doPrepareImportEntries(file);
    const merged = await ctrl.doConfirmImportEntriesMerge({
      mode: 'keep',
      aliasMerge: {
        groups: [{ category: '角色', canonicalName: '林舟', aliases: ['阿舟'] }],
        mode: 'append',
      },
    });

    expect(merged).toBe(true);
    expect(wbStore.generatedEntries.find(entry => entry.category === '角色' && entry.name === '阿舟')).toBeUndefined();
    const canonical = wbStore.generatedEntries.find(entry => entry.category === '角色' && entry.name === '林舟');
    expect(canonical?.keywords).toEqual(expect.arrayContaining(['林舟', '阿舟']));
    expect(String(canonical?.content)).toContain('外号补充');
    expect(stMocks.toastr.info).toHaveBeenCalledWith(expect.stringContaining('别名合并'));
  });

  it('should show warning when exporting entries from empty result list', () => {
    const ctrl = useWorldbookControl();
    ctrl.doExportEntries();
    expect(stMocks.toastr.warning).toHaveBeenCalledWith('暂无条目可导出');
  });
});
