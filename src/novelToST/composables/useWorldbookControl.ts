import { computed, ref, shallowRef } from 'vue';
import { buildMemoryChunksFromText } from '../core/worldbook/chunk.service';
import {
  createWorldbookChunkExecutor,
  parseWorldbookEntriesFromResponse,
  processWorldbookChunks,
} from '../core/worldbook/process.service';
import { worldbookHistoryDB } from '../core/worldbook/history-db.service';
import { exportTaskState, importTaskState, exportSettings, importSettings } from '../core/worldbook/task-io.service';
import { mergeWorldbookDataWithHistory } from '../core/worldbook/merge.service';
import { rerollMemoryChunk, rerollSingleEntry } from '../core/worldbook/reroll.service';
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
  MemoryChunk,
  WorldbookEntry,
  WorldbookProcessControl,
  WorldbookProcessHooks,
  WorldbookProcessSummary,
} from '../types/worldbook';
import type { SaveWorldbookTaskStateInput } from '../core/worldbook/history-db.service';
import type { StructuredWorldbookData } from '../core/worldbook/merge.service';
import type { NovelWorldbookSettings } from '../types';

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
  const canStart = computed(() => !wbStore.isActive && inputText.value.trim().length > 0);
  const canPause = computed(() => wbStore.status === 'running');
  const canResume = computed(() => wbStore.status === 'paused');
  const canStop = computed(() => wbStore.isActive);
  const canReset = computed(() => !wbStore.isActive);

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
    return {
      processedIndex: wbStore.finishedChunks,
      memoryQueue: wbStore.chunks,
      generatedEntries: wbStore.generatedEntries,
      categories: wbStore.categories,
      taskState: wbStore.taskState,
      stats: wbStore.stats,
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

  async function start(): Promise<void> {
    if (wbStore.isActive) {
      toastr.warning('处理正在运行中');
      return;
    }

    const chunks = buildChunks();
    if (chunks.length === 0) return;

    wbStore.prepare(chunks);

    const settings = getWbSettings();

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

    const controller = new AbortController();
    abortController.value = controller;

    wbStore.start();

    resetHistoryMergeQueue(wbStore.generatedEntries);
    const executor = createWorldbookChunkExecutor(settings);

    try {
      await processWorldbookChunks({
        chunks: wbStore.chunks,
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
    resetHistoryMergeQueue([]);
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

  function removeEntry(entryId: string): void {
    const updatedEntries = wbStore.generatedEntries.filter((e) => e.id !== entryId);
    wbStore.replaceGeneratedEntries(updatedEntries);
    syncHistoryWorldbook(wbStore.generatedEntries);
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

    // Actions
    loadInputFile,
    buildChunks,
    start,
    pause,
    resume,
    stop,
    reset,

    // Reroll
    doRerollChunk,
    doRerollEntry,

    // Import/Export
    doExportTaskState,
    doImportTaskState,
    doExportSettings,
    doImportSettings,

    // History
    doRollbackToHistory,

    // Entry management
    removeEntry,
    updateEntry,
  };
}
