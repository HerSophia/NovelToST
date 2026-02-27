import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  MemoryChunk,
  WorldbookCategory,
  WorldbookEntry,
  WorldbookProcessError,
  WorldbookProcessStats,
  WorldbookRuntimeStatus,
  WorldbookTaskState,
} from '../types/worldbook';

const ACTIVE_STATUSES: WorldbookRuntimeStatus[] = ['preparing', 'running', 'paused', 'stopping'];

function createEmptyStats(): WorldbookProcessStats {
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

function normalizeChunk(chunk: MemoryChunk, index: number): MemoryChunk {
  return {
    ...chunk,
    id: chunk.id || `wb-chunk-${index + 1}`,
    index,
    estimatedTokens: Math.max(0, Math.trunc(chunk.estimatedTokens || 0)),
    source: chunk.source ?? [],
    processed: chunk.processed ?? false,
    failed: chunk.failed ?? false,
    processing: false,
    retryCount: chunk.retryCount ?? 0,
    errorMessage: chunk.errorMessage ?? null,
  };
}

function normalizeHydratedChunk(chunk: MemoryChunk, index: number): MemoryChunk {
  return {
    ...normalizeChunk(chunk, index),
    processed: Boolean(chunk.processed),
    failed: Boolean(chunk.failed),
    processing: Boolean(chunk.processing),
    retryCount: Math.max(0, Math.trunc(chunk.retryCount ?? 0)),
    errorMessage: typeof chunk.errorMessage === 'string' && chunk.errorMessage ? chunk.errorMessage : null,
  };
}

function cloneEntry(entry: WorldbookEntry): WorldbookEntry {
  return {
    ...entry,
    keywords: [...entry.keywords],
    sourceChunkIds: [...entry.sourceChunkIds],
  };
}

function cloneCategory(category: WorldbookCategory): WorldbookCategory {
  return {
    ...category,
    entries: category.entries.map(cloneEntry),
  };
}

function cloneStats(stats: WorldbookProcessStats): WorldbookProcessStats {
  return {
    startTime: typeof stats.startTime === 'number' ? stats.startTime : null,
    endTime: typeof stats.endTime === 'number' ? stats.endTime : null,
    processedChunks: Math.max(0, Math.trunc(stats.processedChunks)),
    successfulChunks: Math.max(0, Math.trunc(stats.successfulChunks)),
    failedChunks: Math.max(0, Math.trunc(stats.failedChunks)),
    generatedEntries: Math.max(0, Math.trunc(stats.generatedEntries)),
    totalInputTokens: Math.max(0, Math.trunc(stats.totalInputTokens)),
    totalOutputTokens: Math.max(0, Math.trunc(stats.totalOutputTokens)),
    errors: stats.errors.map((error) => ({
      chunkId: error.chunkId,
      chunkIndex: Math.max(0, Math.trunc(error.chunkIndex)),
      message: error.message,
      timestamp: error.timestamp,
    })),
  };
}

export const useWorldbookStore = defineStore('novelToST/worldbook', () => {
  const status = ref<WorldbookRuntimeStatus>('idle');
  const chunks = ref<MemoryChunk[]>([]);
  const currentChunkId = ref<string | null>(null);
  const generatedEntries = ref<WorldbookEntry[]>([]);
  const categories = ref<WorldbookCategory[]>([]);
  const errorMessage = ref<string | null>(null);
  const stopRequested = ref(false);
  const stats = ref<WorldbookProcessStats>(createEmptyStats());

  const totalChunks = computed(() => chunks.value.length);
  const successfulChunks = computed(() => chunks.value.filter((chunk) => chunk.processed).length);
  const failedChunks = computed(() => chunks.value.filter((chunk) => chunk.failed).length);
  const finishedChunks = computed(() => successfulChunks.value + failedChunks.value);
  const remainingChunks = computed(() => Math.max(0, totalChunks.value - finishedChunks.value));
  const progressPercent = computed(() => {
    if (totalChunks.value === 0) {
      return 0;
    }
    return Math.round((finishedChunks.value / totalChunks.value) * 1000) / 10;
  });

  const isActive = computed(() => ACTIVE_STATUSES.includes(status.value));

  const taskState = computed<WorldbookTaskState>(() => ({
    status: status.value,
    totalChunks: totalChunks.value,
    processedChunks: successfulChunks.value,
    failedChunks: failedChunks.value,
    currentChunkId: currentChunkId.value,
    startedAt: stats.value.startTime,
    endedAt: stats.value.endTime,
    errorMessage: errorMessage.value,
  }));

  const syncChunkStats = () => {
    stats.value.successfulChunks = successfulChunks.value;
    stats.value.failedChunks = failedChunks.value;
    stats.value.processedChunks = finishedChunks.value;
  };

  const recordError = (error: WorldbookProcessError) => {
    stats.value.errors = [...stats.value.errors, error];
  };

  const prepare = (nextChunks: MemoryChunk[]) => {
    chunks.value = nextChunks.map((chunk, index) => normalizeChunk(chunk, index));
    generatedEntries.value = [];
    errorMessage.value = null;
    currentChunkId.value = null;
    stopRequested.value = false;
    status.value = 'preparing';
    stats.value = createEmptyStats();
    syncChunkStats();
  };

  const start = () => {
    if (status.value === 'running') {
      return;
    }
    errorMessage.value = null;
    status.value = 'running';
    if (stats.value.startTime === null) {
      stats.value.startTime = Date.now();
    }
    stats.value.endTime = null;
  };

  const pause = () => {
    if (status.value !== 'running') {
      return;
    }
    status.value = 'paused';
  };

  const resume = () => {
    if (status.value !== 'paused') {
      return;
    }
    status.value = 'running';
  };

  const requestStop = () => {
    if (!isActive.value) {
      return;
    }
    stopRequested.value = true;
    status.value = 'stopping';
  };

  const updateChunk = (chunkId: string, updater: (chunk: MemoryChunk) => MemoryChunk): MemoryChunk | null => {
    let updated: MemoryChunk | null = null;
    chunks.value = chunks.value.map((chunk) => {
      if (chunk.id !== chunkId) {
        return chunk;
      }
      updated = updater(chunk);
      return updated;
    });
    return updated;
  };

  const markChunkProcessing = (chunkId: string) => {
    currentChunkId.value = chunkId;
    updateChunk(chunkId, (chunk) => ({
      ...chunk,
      processing: true,
      errorMessage: null,
    }));
  };

  const markChunkSuccess = (payload: { chunkId: string; outputTokens?: number }) => {
    const updated = updateChunk(payload.chunkId, (chunk) => ({
      ...chunk,
      processing: false,
      processed: true,
      failed: false,
      errorMessage: null,
    }));

    if (!updated) {
      return;
    }

    if (currentChunkId.value === payload.chunkId) {
      currentChunkId.value = null;
    }

    stats.value.totalInputTokens += updated.estimatedTokens;
    stats.value.totalOutputTokens += Math.max(0, Math.trunc(payload.outputTokens ?? 0));
    syncChunkStats();
  };

  const markChunkFailure = (payload: { chunkId: string; message: string }) => {
    const updated = updateChunk(payload.chunkId, (chunk) => ({
      ...chunk,
      processing: false,
      processed: false,
      failed: true,
      retryCount: chunk.retryCount + 1,
      errorMessage: payload.message,
    }));

    if (!updated) {
      return;
    }

    if (currentChunkId.value === payload.chunkId) {
      currentChunkId.value = null;
    }

    errorMessage.value = payload.message;
    recordError({
      chunkId: payload.chunkId,
      chunkIndex: updated.index,
      message: payload.message,
      timestamp: new Date().toISOString(),
    });

    syncChunkStats();
  };

  const replaceGeneratedEntries = (entries: WorldbookEntry[]) => {
    generatedEntries.value = entries.map(cloneEntry);
    stats.value.generatedEntries = generatedEntries.value.length;
    syncChunkStats();
  };

  const replaceChunks = (nextChunks: MemoryChunk[]) => {
    chunks.value = nextChunks.map((chunk, index) => normalizeHydratedChunk(chunk, index));
    if (currentChunkId.value && !chunks.value.some((chunk) => chunk.id === currentChunkId.value)) {
      currentChunkId.value = null;
    }
    stats.value.generatedEntries = generatedEntries.value.length;
    syncChunkStats();
  };

  const appendGeneratedEntries = (entries: WorldbookEntry[]) => {
    if (entries.length === 0) {
      return;
    }
    generatedEntries.value = [...generatedEntries.value, ...entries];
    stats.value.generatedEntries += entries.length;
  };

  const setCategories = (nextCategories: WorldbookCategory[]) => {
    categories.value = nextCategories.map(cloneCategory);
  };

  const setStatus = (nextStatus: WorldbookRuntimeStatus) => {
    status.value = nextStatus;
    if (nextStatus !== 'stopping') {
      stopRequested.value = false;
    }
  };

  const markCompleted = () => {
    status.value = 'completed';
    stopRequested.value = false;
    currentChunkId.value = null;
    stats.value.endTime = Date.now();
    syncChunkStats();
  };

  const markError = (message: string) => {
    status.value = 'error';
    errorMessage.value = message;
    currentChunkId.value = null;
    stats.value.endTime = Date.now();
  };

  const markIdle = () => {
    status.value = 'idle';
    currentChunkId.value = null;
    stopRequested.value = false;
  };

  const reset = () => {
    status.value = 'idle';
    chunks.value = [];
    currentChunkId.value = null;
    generatedEntries.value = [];
    categories.value = [];
    errorMessage.value = null;
    stopRequested.value = false;
    stats.value = createEmptyStats();
  };

  const hydrate = (payload: {
    status: WorldbookRuntimeStatus;
    chunks: MemoryChunk[];
    generatedEntries: WorldbookEntry[];
    categories: WorldbookCategory[];
    currentChunkId: string | null;
    errorMessage: string | null;
    stopRequested: boolean;
    stats: WorldbookProcessStats;
  }) => {
    status.value = payload.status;
    chunks.value = payload.chunks.map((chunk, index) => normalizeHydratedChunk(chunk, index));
    generatedEntries.value = payload.generatedEntries.map(cloneEntry);
    categories.value = payload.categories.map(cloneCategory);
    currentChunkId.value = payload.currentChunkId;
    errorMessage.value = payload.errorMessage;
    stopRequested.value = payload.stopRequested;
    stats.value = cloneStats(payload.stats);
    syncChunkStats();
  };

  return {
    status,
    chunks,
    generatedEntries,
    categories,
    currentChunkId,
    errorMessage,
    stopRequested,
    stats,

    totalChunks,
    successfulChunks,
    failedChunks,
    finishedChunks,
    remainingChunks,
    progressPercent,
    isActive,
    taskState,

    prepare,
    start,
    pause,
    resume,
    requestStop,
    markChunkProcessing,
    markChunkSuccess,
    markChunkFailure,
    replaceChunks,
    replaceGeneratedEntries,
    appendGeneratedEntries,
    setCategories,
    setStatus,
    markCompleted,
    markError,
    markIdle,
    reset,
    hydrate,
  };
});
