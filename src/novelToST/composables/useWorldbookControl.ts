import { computed, ref, shallowRef } from 'vue';
import { buildMemoryChunksFromText, mergeAdjacentChunks, type ChunkMergeDirection } from '../core/worldbook/chunk.service';
import {
  createWorldbookChunkExecutor,
  parseWorldbookEntriesFromResponse,
  processWorldbookChunks,
} from '../core/worldbook/process.service';
import { worldbookHistoryDB } from '../core/worldbook/history-db.service';
import { exportTaskState, importTaskState, exportSettings, importSettings } from '../core/worldbook/task-io.service';
import {
  mergeWorldbookDataWithHistory,
  type StructuredWorldbookData,
  type WorldbookMergeMode,
} from '../core/worldbook/merge.service';
import { rerollMemoryChunk, rerollSingleEntry } from '../core/worldbook/reroll.service';
import {
  buildStructuredWorldbookFromEntries as buildStructuredWorldbookFromEntriesForImport,
  buildWorldbookImportPreview,
  convertEntriesToSillyTavernFormat,
  convertStructuredWorldbookToEntries,
  parseWorldbookImport,
  performWorldbookImportMerge,
  type ParsedWorldbookImport,
  type WorldbookImportAliasMergeOptions,
  type WorldbookImportPreview,
} from '../core/worldbook/st-format.service';
import { fetchCustomApiModels, quickTestWorldbookApi } from '../core/worldbook/api.service';
import {
  DEFAULT_WORLDBOOK_CATEGORIES,
  cloneWorldbookCategories,
  generateDynamicJsonTemplate,
  getEnabledCategoryNamesFromSettings,
  normalizeCategoryLightSettings,
  type WorldbookCategoryDefinition,
} from '../core/worldbook/category.service';
import { applyDefaultWorldbookEntries } from '../core/worldbook/entry-config.service';
import { useWorldbookStore } from '../stores/worldbook.store';
import { useNovelSettingsStore } from '../stores/settings.store';
import { useUiStore } from '../stores/ui.store';
import type {
  WorldbookCategory,
  MemoryChunk,
  WorldbookEntry,
  WorldbookProcessStats,
  WorldbookProcessControl,
  WorldbookProcessHooks,
  WorldbookRuntimeStatus,
  WorldbookProcessSummary,
} from '../types/worldbook';
import type { SaveWorldbookTaskStateInput } from '../core/worldbook/history-db.service';
import type { NovelWorldbookSettings } from '../types';
type ApiStatusType = 'idle' | 'loading' | 'success' | 'error';
type ConfirmableActionOptions = {
  skipConfirm?: boolean;
};

type EditableSnapshot = {
  action: string;
  state: {
    status: WorldbookRuntimeStatus;
    chunks: MemoryChunk[];
    generatedEntries: WorldbookEntry[];
    categories: WorldbookCategory[];
    currentChunkId: string | null;
    errorMessage: string | null;
    stopRequested: boolean;
    stats: WorldbookProcessStats;
  };
};

type EntryImportPreviewState = {
  fileName: string;
  parsed: ParsedWorldbookImport;
  preview: WorldbookImportPreview;
};

type ConfirmWorldbookImportOptions = {
  mode: WorldbookMergeMode;
  customPrompt?: string;
  concurrency?: number;
  aliasMerge?: WorldbookImportAliasMergeOptions;
};

const MAX_EDIT_SNAPSHOT_COUNT = 20;

function cloneChunk(chunk: MemoryChunk): MemoryChunk {
  return {
    ...chunk,
    source: chunk.source.map(source => ({
      chapterIndex: source.chapterIndex,
      chapterTitle: source.chapterTitle,
      startOffset: source.startOffset,
      endOffset: source.endOffset,
    })),
  };
}

function cloneChunks(chunks: ReadonlyArray<MemoryChunk>): MemoryChunk[] {
  return chunks.map(cloneChunk);
}

function cloneEntry(entry: WorldbookEntry): WorldbookEntry {
  return {
    ...entry,
    keywords: [...entry.keywords],
    sourceChunkIds: [...entry.sourceChunkIds],
  };
}

function cloneEntries(entries: ReadonlyArray<WorldbookEntry>): WorldbookEntry[] {
  return entries.map(cloneEntry);
}

function cloneCategories(categories: ReadonlyArray<WorldbookCategory>): WorldbookCategory[] {
  return categories.map(category => ({
    ...category,
    entries: cloneEntries(category.entries),
  }));
}

function cloneStats(stats: WorldbookProcessStats): WorldbookProcessStats {
  return {
    startTime: stats.startTime,
    endTime: stats.endTime,
    processedChunks: stats.processedChunks,
    successfulChunks: stats.successfulChunks,
    failedChunks: stats.failedChunks,
    generatedEntries: stats.generatedEntries,
    totalInputTokens: stats.totalInputTokens,
    totalOutputTokens: stats.totalOutputTokens,
    errors: stats.errors.map(error => ({
      chunkId: error.chunkId,
      chunkIndex: error.chunkIndex,
      message: error.message,
      timestamp: error.timestamp,
    })),
  };
}

export function resolveWorldbookStartChunkIndex(totalChunks: number, startChunkIndex: number): number {
  const normalizedTotalChunks = Math.max(0, Math.trunc(totalChunks));
  if (normalizedTotalChunks <= 0) {
    return 0;
  }

  const normalizedStartChunkIndex = Number.isFinite(startChunkIndex)
    ? Math.max(1, Math.trunc(startChunkIndex))
    : 1;

  return Math.min(normalizedStartChunkIndex - 1, normalizedTotalChunks - 1);
}

export function applyWorldbookStartChunkIndex(
  chunks: ReadonlyArray<MemoryChunk>,
  startChunkIndex: number,
): {
  chunks: MemoryChunk[];
  effectiveStartIndex: number;
  skippedCount: number;
} {
  const clonedChunks = cloneChunks(chunks);
  const effectiveStartIndex = resolveWorldbookStartChunkIndex(clonedChunks.length, startChunkIndex);

  for (let index = 0; index < effectiveStartIndex; index += 1) {
    clonedChunks[index] = {
      ...clonedChunks[index],
      processed: true,
      failed: false,
      processing: false,
      retryCount: 0,
      errorMessage: null,
    };
  }

  return { chunks: clonedChunks, effectiveStartIndex, skippedCount: effectiveStartIndex };
}

const WORLDBOOK_REQUEST_PREFIX = 'wb-ctrl';

let requestCounter = 0;
function nextRequestId(): string {
  return `${WORLDBOOK_REQUEST_PREFIX}-${Date.now()}-${++requestCounter}`;
}

function downloadJson(data: unknown, filename: string): void {
  const fileContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([fileContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function createCustomCategoryDefinition(name: string, enabled: boolean): WorldbookCategoryDefinition {
  return {
    name,
    enabled,
    isBuiltin: false,
    entryExample: `${name}条目`,
    keywordsExample: [name],
    contentGuide: `${name}相关设定`,
    defaultPosition: 0,
    defaultDepth: 4,
    defaultOrder: 100,
    autoIncrementOrder: false,
  };
}

function buildCategoryDefinitions(settings: NovelWorldbookSettings): WorldbookCategoryDefinition[] {
  const baseCategories = cloneWorldbookCategories(DEFAULT_WORLDBOOK_CATEGORIES);
  const lightSettings = normalizeCategoryLightSettings(settings.categoryLightSettings);
  const lightKeys = Object.keys(lightSettings);

  if (lightKeys.length === 0) {
    return baseCategories;
  }

  const mergedCategories = baseCategories.map((category) => {
    if (Object.prototype.hasOwnProperty.call(lightSettings, category.name)) {
      return {
        ...category,
        enabled: Boolean(lightSettings[category.name]),
      };
    }
    return category;
  });

  const knownCategoryNames = new Set(mergedCategories.map((category) => category.name));
  for (const [categoryName, enabled] of Object.entries(lightSettings)) {
    const normalizedName = categoryName.trim();
    if (!normalizedName || knownCategoryNames.has(normalizedName)) {
      continue;
    }
    mergedCategories.push(createCustomCategoryDefinition(normalizedName, Boolean(enabled)));
  }

  return mergedCategories;
}

function buildStructuredWorldbookFromEntries(entries: ReadonlyArray<WorldbookEntry>): StructuredWorldbookData {
  const structured: StructuredWorldbookData = {};

  entries.forEach((entry, index) => {
    const category = entry.category.trim() || '未分类';
    const name = entry.name.trim() || `条目${index + 1}`;

    if (!structured[category]) {
      structured[category] = {};
    }

    const structuredEntry: Record<string, unknown> = {
      关键词: [...entry.keywords],
      内容: entry.content,
    };

    if (entry.position !== undefined) {
      structuredEntry.position = entry.position;
    }
    if (entry.depth !== undefined) {
      structuredEntry.depth = entry.depth;
    }
    if (entry.order !== undefined) {
      structuredEntry.order = entry.order;
    }
    if (entry.disable !== undefined) {
      structuredEntry.disable = entry.disable;
    }

    structured[category][name] = structuredEntry;
  });

  return structured;
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function useWorldbookControl() {
  const wbStore = useWorldbookStore();
  const settingsStore = useNovelSettingsStore();
  const uiStore = useUiStore();

  const abortController = shallowRef<AbortController | null>(null);
  const inputText = ref('');
  const inputFileName = ref('');

  const wbSettings = computed(() => settingsStore.settings.worldbook);
  const isActive = computed(() => wbStore.isActive);
  const hasPendingChunks = computed(() => wbStore.chunks.some(chunk => !chunk.processed || chunk.failed));
  const canStart = computed(() => !wbStore.isActive && (inputText.value.trim().length > 0 || hasPendingChunks.value));
  const canPause = computed(() => wbStore.status === 'running');
  const canResume = computed(() => wbStore.status === 'paused');
  const canStop = computed(() => wbStore.isActive);
  const canReset = computed(() => !wbStore.isActive);
  const modelOptions = ref<string[]>([]);
  const modelStatusType = ref<ApiStatusType>('idle');
  const modelStatusMessage = ref('');
  const modelFetchLoading = ref(false);
  const apiTestLoading = ref(false);
  const entryImportPreview = shallowRef<EntryImportPreviewState | null>(null);
  const entryImportMerging = ref(false);

  function setModelStatus(type: ApiStatusType, message = ''): void {
    modelStatusType.value = type;
    modelStatusMessage.value = message;
  }

  const editSnapshots = ref<EditableSnapshot[]>([]);
  const canUndoEdit = computed(() => editSnapshots.value.length > 0);
  const lastEditAction = computed(() => editSnapshots.value.at(-1)?.action ?? '');

  function confirmAction(message: string, options: ConfirmableActionOptions = {}): boolean {
    if (options.skipConfirm) {
      return true;
    }

    if (typeof globalThis.confirm !== 'function') {
      return true;
    }

    return globalThis.confirm(message);
  }

  function clearEditSnapshots(): void {
    editSnapshots.value = [];
  }

  function pushEditSnapshot(action: string): void {
    editSnapshots.value.push({
      action,
      state: {
        status: wbStore.status,
        chunks: cloneChunks(wbStore.chunks),
        generatedEntries: cloneEntries(wbStore.generatedEntries),
        categories: cloneCategories(wbStore.categories),
        currentChunkId: wbStore.currentChunkId,
        errorMessage: wbStore.errorMessage,
        stopRequested: wbStore.stopRequested,
        stats: cloneStats(wbStore.stats),
      },
    });

    if (editSnapshots.value.length > MAX_EDIT_SNAPSHOT_COUNT) {
      editSnapshots.value.shift();
    }
  }

  function undoLastEdit(): void {
    const snapshot = editSnapshots.value.pop();
    if (!snapshot) {
      toastr.info('暂无可撤销的编辑操作');
      return;
    }

    wbStore.hydrate({
      status: snapshot.state.status,
      chunks: snapshot.state.chunks,
      generatedEntries: snapshot.state.generatedEntries,
      categories: snapshot.state.categories,
      currentChunkId: snapshot.state.currentChunkId,
      errorMessage: snapshot.state.errorMessage,
      stopRequested: snapshot.state.stopRequested,
      stats: snapshot.state.stats,
    });
    syncHistoryWorldbook(wbStore.generatedEntries);
    toastr.success(`已撤销：${snapshot.action}`);
  }

  function consumeEntryIds(entryIds: ReadonlyArray<string>): string[] {
    return Array.from(
      new Set(
        entryIds
          .map(id => id.trim())
          .filter(Boolean),
      ),
    );
  }

  const historyWorldbook = shallowRef<StructuredWorldbookData>({});
  let historyMergeQueue: Promise<void> = Promise.resolve();

  function syncHistoryWorldbook(entries: ReadonlyArray<WorldbookEntry> = wbStore.generatedEntries): void {
    historyWorldbook.value = buildStructuredWorldbookFromEntries(entries);
  }

  function resetHistoryMergeQueue(entries: ReadonlyArray<WorldbookEntry> = wbStore.generatedEntries): void {
    syncHistoryWorldbook(entries);
    historyMergeQueue = Promise.resolve();
  }

  function enqueueHistoryMerge(chunk: MemoryChunk, entries: WorldbookEntry[]): void {
    const source = buildStructuredWorldbookFromEntries(entries);

    historyMergeQueue = historyMergeQueue
      .catch(() => undefined)
      .then(async () => {
        const mergeResult = await mergeWorldbookDataWithHistory({
          target: historyWorldbook.value,
          source,
          memoryIndex: chunk.index,
          memoryTitle: chunk.title,
          incremental: true,
          historyService: worldbookHistoryDB,
        });
        historyWorldbook.value = mergeResult.mergedWorldbook;
      })
      .catch((error) => {
        console.warn('[worldbook] Failed to merge/save history:', error);
      });
  }

  function buildPersistedStateInput(): SaveWorldbookTaskStateInput {
    const taskState = wbStore.taskState;

    return {
      processedIndex: wbStore.finishedChunks,
      memoryQueue: cloneChunks(wbStore.chunks),
      generatedEntries: cloneEntries(wbStore.generatedEntries),
      categories: cloneCategories(wbStore.categories),
      taskState: {
        status: taskState.status,
        totalChunks: taskState.totalChunks,
        processedChunks: taskState.processedChunks,
        failedChunks: taskState.failedChunks,
        currentChunkId: taskState.currentChunkId,
        startedAt: taskState.startedAt,
        endedAt: taskState.endedAt,
        errorMessage: taskState.errorMessage,
      },
      stats: cloneStats(wbStore.stats),
    };
  }

  function resolveChunkForEntry(entry: WorldbookEntry): MemoryChunk | null {
    for (const chunkId of entry.sourceChunkIds) {
      const matched = wbStore.chunks.find((chunk) => chunk.id === chunkId);
      if (matched) {
        return matched;
      }
    }

    if (wbStore.chunks.length > 0) {
      return wbStore.chunks[0];
    }

    return null;
  }

  function getWbSettings(): NovelWorldbookSettings {
    return settingsStore.settings.worldbook;
  }

  function buildPromptForChunk(chunk: MemoryChunk): string {
    const settings = getWbSettings();
    const categoryDefinitions = buildCategoryDefinitions(settings);
    const categoryNames = getEnabledCategoryNamesFromSettings(categoryDefinitions, settings);
    const jsonTemplate = generateDynamicJsonTemplate(categoryDefinitions);

    let prompt = `请阅读以下小说文本片段，提取世界书条目。\n\n`;
    if (categoryNames.length > 0) {
      prompt += `### 重点分类\n${categoryNames.join('、')}\n\n`;
    }
    prompt += `### 输出格式\n请按以下JSON格式输出：\n\`\`\`json\n${jsonTemplate}\n\`\`\`\n\n`;

    if (settings.customWorldbookPrompt) {
      prompt += `### 额外指导\n${settings.customWorldbookPrompt}\n\n`;
    }

    if (settings.customSuffixPrompt) {
      prompt += `${settings.customSuffixPrompt}\n\n`;
    }

    prompt += `### 待分析文本\n${chunk.content}`;
    return prompt;
  }

  function createProcessControl(): WorldbookProcessControl {
    return {
      isStopped: () => wbStore.stopRequested,
      isPaused: () => wbStore.status === 'paused',
      waitForResume: () =>
        new Promise<void>((resolve) => {
          const check = () => {
            if (wbStore.status !== 'paused') {
              resolve();
              return;
            }
            setTimeout(check, 200);
          };
          check();
        }),
    };
  }

  function createProcessHooks(): WorldbookProcessHooks {
    return {
      onChunkStart: (chunk, attempt) => {
        wbStore.markChunkProcessing(chunk.id);
        if (getWbSettings().debugMode) {
          console.log(`[worldbook] Processing chunk ${chunk.index + 1} (attempt ${attempt})`);
        }
      },
      onChunkSuccess: (chunk, result) => {
        wbStore.markChunkSuccess({ chunkId: chunk.id, outputTokens: result.outputTokens });
        wbStore.appendGeneratedEntries(result.entries);

        enqueueHistoryMerge(chunk, result.entries);
      },
      onChunkError: (chunk, failure) => {
        wbStore.markChunkFailure({ chunkId: chunk.id, message: failure.message });
      },
      onProgress: (progress) => {
        if (getWbSettings().debugMode) {
          console.log(`[worldbook] Progress: ${progress.done}/${progress.total} (${progress.percent}%)`);
        }
      },
      onComplete: (summary: WorldbookProcessSummary) => {
        if (summary.stopped) {
          wbStore.markIdle();
          toastr.warning('世界书处理已停止');
        } else {
          wbStore.markCompleted();
          toastr.success(`世界书处理完成：${summary.succeeded} 成功，${summary.failed} 失败`);
        }
        abortController.value = null;
      },
    };
  }

  async function loadInputFile(file: File): Promise<void> {
    try {
      const text = await readFileAsText(file);
      inputText.value = text;
      inputFileName.value = file.name;
      toastr.success(`已加载文件：${file.name}`);
    } catch (error) {
      toastr.error('文件读取失败');
    }
  }

  function buildChunks(): MemoryChunk[] {
    const text = inputText.value.trim();
    if (!text) {
      toastr.warning('请先输入或加载文本内容');
      return [];
    }

    const settings = getWbSettings();
    return buildMemoryChunksFromText(text, {
      chunkSize: settings.chunkSize,
      chapterRegexPattern: settings.chapterRegexPattern,
      useCustomChapterRegex: settings.useCustomChapterRegex,
    });
  }

  async function fetchModelList(): Promise<void> {
    if (modelFetchLoading.value) {
      return;
    }

    const settings = getWbSettings();
    if (settings.useTavernApi) {
      setModelStatus('error', '当前为 SillyTavern API 模式，无需拉取模型列表');
      toastr.warning('当前为 SillyTavern API 模式，无需拉取模型列表');
      return;
    }

    modelFetchLoading.value = true;
    setModelStatus('loading', '正在拉取模型列表...');

    try {
      const result = await fetchCustomApiModels(settings, {
        timeoutMs: settings.apiTimeout,
      });

      modelOptions.value = result.models;
      if (result.models.length === 0) {
        setModelStatus('error', '未拉取到模型，请检查 Endpoint 与权限');
        toastr.warning('未拉取到模型，请手动填写模型名称');
        return;
      }

      const currentModel = settings.customApiModel.trim();
      if (!currentModel || !result.models.includes(currentModel)) {
        settingsStore.patch({
          worldbook: {
            customApiModel: result.models[0],
          },
        });
      }

      setModelStatus('success', `已拉取 ${result.models.length} 个模型`);
      toastr.success(`模型列表拉取成功，共 ${result.models.length} 个`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      modelOptions.value = [];
      setModelStatus('error', message);
      toastr.error(message, '模型列表拉取失败');
    } finally {
      modelFetchLoading.value = false;
    }
  }

  async function quickTestApi(): Promise<void> {
    if (apiTestLoading.value) {
      return;
    }

    const settings = getWbSettings();
    apiTestLoading.value = true;
    setModelStatus('loading', '正在测试 API 连接...');

    try {
      const result = await quickTestWorldbookApi(settings, {
        timeoutMs: settings.apiTimeout,
        requestId: nextRequestId(),
      });
      setModelStatus('success', `连接成功（${result.elapsedMs}ms，${result.provider}）`);
      toastr.success(`API 连接测试成功（${result.elapsedMs}ms）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setModelStatus('error', message);
      toastr.error(message, 'API 测试失败');
    } finally {
      apiTestLoading.value = false;
    }
  }

  async function runChunkProcessing(chunksToProcess: ReadonlyArray<MemoryChunk>): Promise<void> {
    const settings = getWbSettings();

    const controller = new AbortController();
    abortController.value = controller;

    wbStore.start();

    resetHistoryMergeQueue(wbStore.generatedEntries);
    const executor = createWorldbookChunkExecutor(settings);

    try {
      await processWorldbookChunks({
        chunks: chunksToProcess,
        processing: {
          parallelEnabled: settings.parallelEnabled,
          parallelConcurrency: settings.parallelConcurrency,
          parallelMode: settings.parallelMode,
        },
        maxRetries: 2,
        retryBackoffMs: 3000,
        buildPrompt: buildPromptForChunk,
        executeChunk: executor,
        parseEntries: parseWorldbookEntriesFromResponse,
        control: createProcessControl(),
        hooks: createProcessHooks(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      wbStore.markError(message);
      toastr.error(message, '世界书处理失败');
    } finally {
      abortController.value = null;

      try {
        await historyMergeQueue.catch(() => undefined);
        await worldbookHistoryDB.saveState(buildPersistedStateInput());
      } catch (error) {
        console.warn('[worldbook] Failed to save state:', error);
      }
    }
  }

  async function start(): Promise<void> {
    if (wbStore.isActive) {
      toastr.warning('处理正在运行中');
      return;
    }

    const settings = getWbSettings();

    const reusePendingChunks = hasPendingChunks.value;
    if (!reusePendingChunks) {
      const chunks = buildChunks();
      if (chunks.length === 0) {
        return;
      }

      const prepared = applyWorldbookStartChunkIndex(chunks, settings.startChunkIndex);
      wbStore.prepare(prepared.chunks);
      clearEditSnapshots();

      if (prepared.skippedCount > 0) {
        toastr.info(
          `已设置从第 ${prepared.effectiveStartIndex + 1} 块开始，本次将跳过前 ${prepared.skippedCount} 块`,
        );
      }
    } else if (settings.startChunkIndex > 1) {
      toastr.info('已检测到待处理队列：起始块设置仅对新建任务生效，本次将继续处理未完成块');
    }

    if (!reusePendingChunks) {
      const defaultResult = applyDefaultWorldbookEntries({
        baseEntries: wbStore.generatedEntries,
        settings,
        entryPositionConfig: settings.entryPositionConfig,
      });

      if (defaultResult.appliedCount > 0) {
        wbStore.replaceGeneratedEntries(defaultResult.entries);

        settingsStore.patch({
          worldbook: {
            entryPositionConfig: defaultResult.nextEntryPositionConfig,
          },
        });
      }
    }

    await runChunkProcessing(wbStore.chunks);
  }

  async function retryFailedChunk(chunkIndex: number): Promise<void> {
    if (wbStore.isActive) {
      toastr.warning('处理正在运行中，请稍后重试失败块');
      return;
    }

    const chunk = wbStore.chunks[chunkIndex];
    if (!chunk) {
      toastr.error('未找到指定的失败块');
      return;
    }

    if (!chunk.failed) {
      toastr.info(`块 #${chunkIndex + 1} 当前不是失败状态`);
      return;
    }

    toastr.info(`开始重试失败块 #${chunkIndex + 1}`);
    await runChunkProcessing([chunk]);
  }

  async function retryAllFailedChunks(): Promise<void> {
    if (wbStore.isActive) {
      toastr.warning('处理正在运行中，请稍后再试');
      return;
    }

    const failedChunks = wbStore.chunks.filter((chunk) => chunk.failed);
    if (failedChunks.length === 0) {
      toastr.info('当前没有失败块需要修复');
      return;
    }

    toastr.info(`开始批量重试失败块（${failedChunks.length}）`);
    await runChunkProcessing(failedChunks);
  }

  function pause(): void {
    if (wbStore.status !== 'running') return;
    wbStore.pause();
    toastr.info('世界书处理已暂停');
  }

  function resume(): void {
    if (wbStore.status !== 'paused') return;
    wbStore.resume();
    toastr.info('世界书处理已恢复');
  }

  function stop(): void {
    if (!wbStore.isActive) return;
    wbStore.requestStop();
    if (abortController.value) {
      abortController.value.abort();
    }
    toastr.warning('正在停止世界书处理...');
  }

  function reset(): void {
    if (wbStore.isActive) {
      toastr.warning('请先停止处理后再重置');
      return;
    }
    wbStore.reset();
    inputText.value = '';
    inputFileName.value = '';
    modelOptions.value = [];
    setModelStatus('idle');
    resetHistoryMergeQueue([]);
    entryImportPreview.value = null;
    entryImportMerging.value = false;
    clearEditSnapshots();
    toastr.info('世界书状态已重置');
  }

  async function doRerollChunk(chunkIndex: number): Promise<void> {
    const chunk = wbStore.chunks[chunkIndex];
    if (!chunk) {
      toastr.error('未找到指定的记忆块');
      return;
    }

    const settings = getWbSettings();
    try {
      uiStore.setBusy(true);
      const result = await rerollMemoryChunk({
        chunk,
        settings,
        signal: new AbortController().signal,
        requestId: nextRequestId(),
        parseEntries: parseWorldbookEntriesFromResponse,
        historyService: worldbookHistoryDB,
      });

      const updatedEntries = wbStore.generatedEntries.filter(
        (e) => !e.sourceChunkIds.includes(chunk.id),
      );
      wbStore.replaceGeneratedEntries([...updatedEntries, ...result.entries]);
      syncHistoryWorldbook(wbStore.generatedEntries);
      toastr.success(`记忆块 ${chunkIndex + 1} 重Roll完成，生成 ${result.entries.length} 条目`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '重Roll失败');
    } finally {
      uiStore.setBusy(false);
    }
  }

  async function doRerollEntry(entry: WorldbookEntry): Promise<void> {
    const settings = getWbSettings();
    const chunk = resolveChunkForEntry(entry);
    if (!chunk) {
      toastr.error('未找到条目对应的记忆块，无法重Roll');
      return;
    }

    try {
      uiStore.setBusy(true);
      const result = await rerollSingleEntry({
        chunk,
        category: entry.category,
        entryName: entry.name,
        currentEntry: entry,
        settings,
        signal: new AbortController().signal,
        requestId: nextRequestId(),
        historyService: worldbookHistoryDB,
      });

      if (result.entry) {
        const updatedEntries = wbStore.generatedEntries.map((e) =>
          e.id === entry.id ? result.entry : e,
        );
        wbStore.replaceGeneratedEntries(updatedEntries);
        syncHistoryWorldbook(wbStore.generatedEntries);
        toastr.success(`条目 "${entry.name}" 重Roll完成`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '条目重Roll失败');
    } finally {
      uiStore.setBusy(false);
    }
  }

  function clearEntryImportPreview(): void {
    entryImportPreview.value = null;
  }

  function doExportEntries(): void {
    if (wbStore.generatedEntries.length === 0) {
      toastr.warning('暂无条目可导出');
      return;
    }

    try {
      const exported = convertEntriesToSillyTavernFormat({
        entries: wbStore.generatedEntries,
        settings: getWbSettings(),
      });
      downloadJson(exported, `worldbook-sillytavern-${Date.now()}.json`);
      toastr.success(`已导出 ${exported.entries.length} 条目（SillyTavern 格式）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '导出条目失败');
    }
  }

  async function doPrepareImportEntries(file: File): Promise<void> {
    if (wbStore.isActive) {
      toastr.warning('处理运行中，暂不支持导入合并条目');
      return;
    }

    try {
      const text = await readFileAsText(file);
      const parsed = parseWorldbookImport(text);
      const preview = buildWorldbookImportPreview({
        existingWorldbook: buildStructuredWorldbookFromEntriesForImport(wbStore.generatedEntries),
        imported: parsed,
      });

      if (preview.totalEntries === 0) {
        entryImportPreview.value = null;
        toastr.warning('导入文件中没有可识别的世界书条目');
        return;
      }

      entryImportPreview.value = {
        fileName: file.name,
        parsed,
        preview,
      };

      toastr.info(
        `导入预览：${preview.newEntries.length} 个新条目，${preview.allDuplicates.length} 个重复条目`,
      );
    } catch (error) {
      entryImportPreview.value = null;
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '导入条目失败');
    }
  }

  async function doConfirmImportEntriesMerge(options: ConfirmWorldbookImportOptions): Promise<boolean> {
    const draft = entryImportPreview.value;
    if (!draft) {
      return false;
    }

    if (wbStore.isActive) {
      toastr.warning('处理运行中，暂不支持导入合并条目');
      return false;
    }

    const settings = getWbSettings();

    try {
      entryImportMerging.value = true;
      const trimmedPrompt = options.customPrompt?.trim() ?? '';
      const aliasMerge =
        options.aliasMerge && options.aliasMerge.groups.length > 0
          ? {
              ...options.aliasMerge,
              groups: [...options.aliasMerge.groups],
            }
          : undefined;
      const mergeResult = await performWorldbookImportMerge({
        existingWorldbook: buildStructuredWorldbookFromEntriesForImport(wbStore.generatedEntries),
        imported: draft.parsed,
        mode: options.mode,
        customPrompt: trimmedPrompt || undefined,
        concurrency: options.concurrency,
        settings,
        aliasMerge,
      });

      if (options.mode === 'ai' && trimmedPrompt !== settings.customMergePrompt) {
        settingsStore.patch({
          worldbook: {
            customMergePrompt: trimmedPrompt,
          },
        });
      }

      const mergedEntries = convertStructuredWorldbookToEntries({
        worldbook: mergeResult.worldbook,
        existingEntries: wbStore.generatedEntries,
        entryMeta: draft.parsed.entryMeta,
        settings,
      });

      pushEditSnapshot(`导入世界书（${options.mode}）`);
      wbStore.replaceGeneratedEntries(mergedEntries);
      syncHistoryWorldbook(mergedEntries);
      entryImportPreview.value = null;

      toastr.success(`导入完成：新增 ${mergeResult.newEntries.length}，处理重复 ${mergeResult.processedDuplicates}`);

      if (mergeResult.aliasMerge.applied) {
        toastr.info(
          `别名合并：规则 ${mergeResult.aliasMerge.groups} 组，合并 ${mergeResult.aliasMerge.mergedCount} 条，未命中 ${mergeResult.aliasMerge.missingCount} 条`,
        );
      }

      if (mergeResult.failedDuplicates.length > 0) {
        toastr.warning(`有 ${mergeResult.failedDuplicates.length} 个重复条目处理失败`);
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '导入合并失败');
      return false;
    } finally {
      entryImportMerging.value = false;
    }
  }

  async function doExportTaskState(): Promise<void> {
    try {
      const state = await worldbookHistoryDB.loadState();
      const fileContent = exportTaskState(state ?? buildPersistedStateInput());
      downloadJson(fileContent, `worldbook-task-${Date.now()}.json`);
      toastr.success('任务状态已导出');
    } catch (error) {
      toastr.error('导出任务状态失败');
    }
  }

  async function doImportTaskState(file: File): Promise<void> {
    try {
      const text = await readFileAsText(file);
      const state = importTaskState(text);
      if (state) {
        wbStore.hydrate({
          status: state.taskState.status,
          chunks: state.memoryQueue ?? [],
          generatedEntries: state.generatedEntries ?? [],
          categories: state.categories ?? [],
          currentChunkId: state.taskState.currentChunkId,
          errorMessage: state.taskState.errorMessage,
          stopRequested: false,
          stats: state.stats ?? {
            startTime: null,
            endTime: null,
            processedChunks: 0,
            successfulChunks: 0,
            failedChunks: 0,
            generatedEntries: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            errors: [],
          },
        });
        resetHistoryMergeQueue(wbStore.generatedEntries);
        clearEditSnapshots();
        toastr.success('任务状态已导入');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '导入任务状态失败');
    }
  }

  function doExportSettings(): void {
    try {
      const fileContent = exportSettings(getWbSettings());
      downloadJson(fileContent, `worldbook-settings-${Date.now()}.json`);
      toastr.success('世界书设置已导出');
    } catch (error) {
      toastr.error('导出设置失败');
    }
  }

  async function doImportSettings(file: File): Promise<void> {
    try {
      const text = await readFileAsText(file);
      const importedSettings = importSettings(text);
      if (importedSettings) {
        settingsStore.patch({ worldbook: importedSettings });
        modelOptions.value = [];
        setModelStatus('idle');
        clearEditSnapshots();
        toastr.success('世界书设置已导入');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '导入设置失败');
    }
  }

  async function doRollbackToHistory(historyId: number): Promise<void> {
    try {
      uiStore.setBusy(true);
      const history = await worldbookHistoryDB.rollbackToHistory(historyId);
      if (history) {
        historyWorldbook.value = history.newWorldbook as StructuredWorldbookData;
        toastr.success('已回退到历史版本');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '回退失败');
    } finally {
      historyMergeQueue = Promise.resolve();
      uiStore.setBusy(false);
    }
  }

  function removeEntries(entryIds: ReadonlyArray<string>, options: ConfirmableActionOptions = {}): void {
    const uniqueIds = consumeEntryIds(entryIds);
    if (uniqueIds.length === 0) {
      return;
    }

    const idSet = new Set(uniqueIds);
    const removableCount = wbStore.generatedEntries.filter(entry => idSet.has(entry.id)).length;
    if (removableCount === 0) {
      return;
    }

    const confirmed = confirmAction(
      removableCount === 1
        ? '确认删除选中的 1 个条目吗？'
        : `确认删除选中的 ${removableCount} 个条目吗？`,
      options,
    );

    if (!confirmed) {
      return;
    }

    pushEditSnapshot(removableCount === 1 ? '删除条目' : `批量删除 ${removableCount} 条目`);
    const updatedEntries = wbStore.generatedEntries.filter(entry => !idSet.has(entry.id));
    wbStore.replaceGeneratedEntries(updatedEntries);
    syncHistoryWorldbook(wbStore.generatedEntries);
    toastr.success(`已删除 ${removableCount} 条目`);
  }

  function removeEntry(entryId: string, options: ConfirmableActionOptions = {}): void {
    removeEntries([entryId], options);
  }

  function mergeChunk(chunkIndex: number, direction: ChunkMergeDirection, options: ConfirmableActionOptions = {}): void {
    if (wbStore.isActive) {
      toastr.warning('处理运行中，无法编辑记忆块');
      return;
    }

    const chunk = wbStore.chunks[chunkIndex];
    if (!chunk) {
      toastr.error('未找到要合并的记忆块');
      return;
    }

    const actionLabel = direction === 'up' ? '向上合并' : '向下合并';
    if (!confirmAction(`确认对块 #${chunk.index + 1} 执行${actionLabel}吗？`, options)) {
      return;
    }

    try {
      const merged = mergeAdjacentChunks(wbStore.chunks, chunkIndex, direction);
      pushEditSnapshot(`${actionLabel}（块 #${chunk.index + 1}）`);

      wbStore.replaceChunks(merged.chunks);

      const affectedChunkIds = new Set([merged.baseChunkId, merged.removedChunkId]);
      const previousEntries = wbStore.generatedEntries;
      const keptEntries = previousEntries.filter(
        entry => !entry.sourceChunkIds.some(chunkId => affectedChunkIds.has(chunkId)),
      );

      if (keptEntries.length !== previousEntries.length) {
        wbStore.replaceGeneratedEntries(keptEntries);
      }

      syncHistoryWorldbook(wbStore.generatedEntries);
      const removedEntryCount = previousEntries.length - keptEntries.length;
      toastr.success(`记忆块已合并，当前共 ${wbStore.totalChunks} 块`);
      if (removedEntryCount > 0) {
        toastr.info(`已移除 ${removedEntryCount} 条受影响条目，请重新处理合并块`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.warning(message || '记忆块合并失败');
    }
  }

  function mergeChunkUp(chunkIndex: number): void {
    mergeChunk(chunkIndex, 'up');
  }

  function mergeChunkDown(chunkIndex: number): void {
    mergeChunk(chunkIndex, 'down');
  }

  function updateEntry(entry: WorldbookEntry): void {
    const updatedEntries = wbStore.generatedEntries.map((e) =>
      e.id === entry.id ? entry : e,
    );
    wbStore.replaceGeneratedEntries(updatedEntries);
    syncHistoryWorldbook(wbStore.generatedEntries);
  }

  return {
    // State
    inputText,
    inputFileName,
    wbSettings,
    isActive,
    canStart,
    canPause,
    canResume,
    canStop,
    canReset,
    modelOptions,
    modelStatusType,
    modelStatusMessage,
    modelFetchLoading,
    apiTestLoading,
    canUndoEdit,
    entryImportPreview,
    entryImportMerging,
    lastEditAction,

    // Actions
    loadInputFile,
    buildChunks,
    fetchModelList,
    quickTestApi,
    start,
    pause,
    resume,
    stop,
    retryFailedChunk,
    retryAllFailedChunks,
    reset,

    // Reroll
    doRerollChunk,
    doRerollEntry,

    // Import/Export
    doExportEntries,
    doPrepareImportEntries,
    doConfirmImportEntriesMerge,
    clearEntryImportPreview,
    doExportTaskState,
    doImportTaskState,
    doExportSettings,
    doImportSettings,

    // History
    doRollbackToHistory,

    // Entry management
    removeEntry,
    removeEntries,
    updateEntry,

    // Chunk edit
    mergeChunkUp,
    mergeChunkDown,
    undoLastEdit,
  };
}
