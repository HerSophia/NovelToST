import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GenerationErrorRecord, GenerationRuntimeStatus, GenerationStats } from '../types';

function createEmptyStats(): GenerationStats {
  return {
    startTime: null,
    endTime: null,
    chaptersGenerated: 0,
    totalCharacters: 0,
    errors: [],
  };
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

  const isRunning = computed(() => ['running', 'paused', 'stopping'].includes(status.value));
  const isPaused = computed(() => status.value === 'paused');

  const start = (payload: { targetChapters: number; currentChapter: number }) => {
    status.value = 'running';
    targetChapters.value = payload.targetChapters;
    currentChapter.value = payload.currentChapter;
    retryCount.value = 0;
    lastGeneratedLength.value = 0;
    errorMessage.value = null;
    abortRequested.value = false;
    stats.value = {
      ...createEmptyStats(),
      startTime: Date.now(),
    };
  };

  const pause = () => {
    if (status.value === 'running') {
      status.value = 'paused';
    }
  };

  const resume = () => {
    if (status.value === 'paused') {
      status.value = 'running';
    }
  };

  const requestStop = () => {
    abortRequested.value = true;
    if (status.value !== 'idle') {
      status.value = 'stopping';
    }
  };

  const markIdle = () => {
    status.value = 'idle';
    abortRequested.value = false;
    retryCount.value = 0;
    stats.value.endTime = Date.now();
  };

  const markCompleted = () => {
    status.value = 'completed';
    abortRequested.value = false;
    retryCount.value = 0;
    stats.value.endTime = Date.now();
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
    errorMessage.value = message;
    status.value = 'error';
    const record: GenerationErrorRecord = {
      chapter,
      message,
      timestamp: new Date().toISOString(),
    };
    stats.value.errors.push(record);
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
  };

  return {
    status,
    isRunning,
    isPaused,
    targetChapters,
    currentChapter,
    retryCount,
    lastGeneratedLength,
    errorMessage,
    abortRequested,
    stats,

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
  };
});
