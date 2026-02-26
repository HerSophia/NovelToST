import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GenerationErrorRecord, GenerationRuntimeStatus, GenerationStats } from '../types';

function createEmptyStats(): GenerationStats {
  return {
    startTime: null,
    endTime: null,
    chaptersGenerated: 0,
    totalCharacters: 0,
    pausedAt: null,
    totalPausedMs: 0,
    errors: [],
  };
}

function calcElapsedMs(stats: GenerationStats, now: number): number {
  if (stats.startTime === null) {
    return 0;
  }

  const baseEnd = stats.endTime ?? now;
  const elapsedRaw = Math.max(0, baseEnd - stats.startTime);

  let pausedMs = Math.max(0, stats.totalPausedMs);
  if (stats.endTime === null && stats.pausedAt !== null) {
    pausedMs += Math.max(0, now - stats.pausedAt);
  }

  return Math.max(0, elapsedRaw - pausedMs);
}

export const useGenerationStore = defineStore('novelToST/generation', () => {
  const status = ref<GenerationRuntimeStatus>('idle');
  const targetChapters = ref(0);
  const currentChapter = ref(0);
  const retryCount = ref(0);
  const lastGeneratedLength = ref(0);
  const errorMessage = ref<string | null>(null);
  const abortRequested = ref(false);
  const stats = ref<GenerationStats>(createEmptyStats());
  const runtimeNow = ref(Date.now());

  const isRunning = computed(() => ['running', 'paused', 'stopping'].includes(status.value));
  const isPaused = computed(() => status.value === 'paused');
  const remainingChapters = computed(() => Math.max(0, targetChapters.value - currentChapter.value));
  const elapsedMs = computed(() => calcElapsedMs(stats.value, runtimeNow.value));
  const averageChapterDurationMs = computed(() => {
    if (stats.value.chaptersGenerated <= 0) {
      return null;
    }

    return Math.max(0, Math.round(elapsedMs.value / stats.value.chaptersGenerated));
  });
  const estimatedRemainingMs = computed(() => {
    if (remainingChapters.value <= 0) {
      return 0;
    }

    if (averageChapterDurationMs.value === null) {
      return null;
    }

    return Math.max(0, averageChapterDurationMs.value * remainingChapters.value);
  });

  const touchRuntimeNow = (timestamp: number = Date.now()) => {
    runtimeNow.value = timestamp;
  };

  const finalizePauseWindow = (timestamp: number = Date.now()) => {
    if (stats.value.pausedAt === null) {
      return;
    }

    stats.value.totalPausedMs += Math.max(0, timestamp - stats.value.pausedAt);
    stats.value.pausedAt = null;
  };

  const start = (payload: { targetChapters: number; currentChapter: number }) => {
    const startedAt = Date.now();
    status.value = 'running';
    targetChapters.value = payload.targetChapters;
    currentChapter.value = payload.currentChapter;
    retryCount.value = 0;
    lastGeneratedLength.value = 0;
    errorMessage.value = null;
    abortRequested.value = false;
    stats.value = {
      ...createEmptyStats(),
      startTime: startedAt,
    };
    runtimeNow.value = startedAt;
  };

  const pause = () => {
    if (status.value === 'running') {
      const pausedAt = Date.now();
      status.value = 'paused';
      stats.value.pausedAt = pausedAt;
      runtimeNow.value = pausedAt;
    }
  };

  const resume = () => {
    if (status.value === 'paused') {
      const resumedAt = Date.now();
      finalizePauseWindow(resumedAt);
      status.value = 'running';
      runtimeNow.value = resumedAt;
    }
  };

  const requestStop = () => {
    const requestedAt = Date.now();
    finalizePauseWindow(requestedAt);
    abortRequested.value = true;
    if (status.value !== 'idle') {
      status.value = 'stopping';
    }
    runtimeNow.value = requestedAt;
  };

  const markIdle = () => {
    const endedAt = Date.now();
    finalizePauseWindow(endedAt);
    status.value = 'idle';
    abortRequested.value = false;
    retryCount.value = 0;
    stats.value.endTime = endedAt;
    runtimeNow.value = endedAt;
  };

  const markCompleted = () => {
    const endedAt = Date.now();
    finalizePauseWindow(endedAt);
    status.value = 'completed';
    abortRequested.value = false;
    retryCount.value = 0;
    stats.value.endTime = endedAt;
    runtimeNow.value = endedAt;
  };

  const appendError = (message: string, chapter: number) => {
    const record: GenerationErrorRecord = {
      chapter,
      message,
      timestamp: new Date().toISOString(),
    };
    stats.value.errors.push(record);
    errorMessage.value = message;
  };

  const markError = (message: string, chapter: number) => {
    const endedAt = Date.now();
    finalizePauseWindow(endedAt);
    errorMessage.value = message;
    status.value = 'error';

    const record: GenerationErrorRecord = {
      chapter,
      message,
      timestamp: new Date().toISOString(),
    };
    stats.value.errors.push(record);
    stats.value.endTime = endedAt;
    runtimeNow.value = endedAt;
  };

  const clearError = () => {
    errorMessage.value = null;
    if (status.value === 'error') {
      status.value = 'idle';
    }
  };

  const setCurrentChapter = (chapter: number) => {
    currentChapter.value = Math.max(0, chapter);
  };

  const setRetryCount = (count: number) => {
    retryCount.value = Math.max(0, count);
  };

  const incrementRetry = () => {
    retryCount.value += 1;
  };

  const recordGeneratedChapter = (length: number) => {
    const safeLength = Math.max(0, Math.trunc(length));
    lastGeneratedLength.value = safeLength;
    stats.value.chaptersGenerated += 1;
    stats.value.totalCharacters += safeLength;
    runtimeNow.value = Date.now();
  };

  const resetProgress = () => {
    status.value = 'idle';
    targetChapters.value = 0;
    currentChapter.value = 0;
    retryCount.value = 0;
    lastGeneratedLength.value = 0;
    errorMessage.value = null;
    abortRequested.value = false;
    stats.value = createEmptyStats();
    runtimeNow.value = Date.now();
  };

  return {
    status,
    isRunning,
    isPaused,
    remainingChapters,
    targetChapters,
    currentChapter,
    retryCount,
    lastGeneratedLength,
    errorMessage,
    abortRequested,
    stats,
    elapsedMs,
    averageChapterDurationMs,
    estimatedRemainingMs,

    start,
    pause,
    resume,
    requestStop,
    markIdle,
    markCompleted,
    appendError,
    markError,
    clearError,
    setCurrentChapter,
    setRetryCount,
    incrementRetry,
    recordGeneratedChapter,
    resetProgress,
    touchRuntimeNow,
  };
});
