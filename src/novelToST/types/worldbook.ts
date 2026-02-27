import type { WorldbookParallelMode } from '../types';

export type WorldbookRuntimeStatus = 'idle' | 'preparing' | 'running' | 'paused' | 'stopping' | 'completed' | 'error';

export type ChapterSegment = {
  index: number;
  title: string;
  content: string;
  startOffset: number;
  endOffset: number;
};

export type MemoryChunkSource = {
  chapterIndex: number;
  chapterTitle: string;
  startOffset: number;
  endOffset: number;
};

export type MemoryChunk = {
  id: string;
  index: number;
  title: string;
  content: string;
  estimatedTokens: number;
  source: MemoryChunkSource[];
  processed: boolean;
  failed: boolean;
  processing: boolean;
  retryCount: number;
  errorMessage: string | null;
};

export type WorldbookEntry = {
  id: string;
  category: string;
  name: string;
  keywords: string[];
  content: string;
  position?: number;
  depth?: number;
  order?: number;
  disable?: boolean;
  sourceChunkIds: string[];
};

export type WorldbookCategory = {
  name: string;
  enabled: boolean;
  isBuiltin: boolean;
  entries: WorldbookEntry[];
};

export type WorldbookTaskState = {
  status: WorldbookRuntimeStatus;
  totalChunks: number;
  processedChunks: number;
  failedChunks: number;
  currentChunkId: string | null;
  startedAt: number | null;
  endedAt: number | null;
  errorMessage: string | null;
};

export type WorldbookProcessError = {
  chunkId: string;
  chunkIndex: number;
  message: string;
  timestamp: string;
};

export type WorldbookProcessStats = {
  startTime: number | null;
  endTime: number | null;
  processedChunks: number;
  successfulChunks: number;
  failedChunks: number;
  generatedEntries: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  errors: WorldbookProcessError[];
};

export type ChapterParseOptions = {
  chapterRegexPattern: string;
  useCustomChapterRegex: boolean;
  fallbackTitlePrefix?: string;
  fallbackTitleSuffix?: string;
};

export type BuildMemoryChunksOptions = {
  chunkSize: number;
  minChunkSize?: number;
  chapterRegexPattern: string;
  useCustomChapterRegex: boolean;
};

export type WorldbookProcessingOptions = {
  parallelEnabled: boolean;
  parallelConcurrency: number;
  parallelMode: WorldbookParallelMode;
};

export type WorldbookApiErrorType =
  | 'timeout'
  | 'rate_limit'
  | 'json_parse'
  | 'empty_response'
  | 'http_error'
  | 'aborted'
  | 'network'
  | 'unknown';

export type WorldbookApiResponse = {
  provider: string;
  text: string;
  outputTokens: number;
  raw: unknown;
};

export type WorldbookModelListResult = {
  provider: string;
  models: string[];
  raw: unknown;
};

export type WorldbookApiQuickTestResult = {
  provider: string;
  elapsedMs: number;
  responseText: string;
  outputTokens: number;
};

export type WorldbookChunkExecutionResult = {
  responseText: string;
  outputTokens?: number;
  raw?: unknown;
};

export type WorldbookChunkProcessResult = {
  chunkId: string;
  chunkIndex: number;
  attempt: number;
  elapsedMs: number;
  responseText: string;
  outputTokens: number;
  entries: WorldbookEntry[];
  raw: unknown;
};

export type WorldbookChunkProcessFailure = {
  chunkId: string;
  chunkIndex: number;
  attempt: number;
  errorType: WorldbookApiErrorType;
  message: string;
};

export type WorldbookProcessProgress = {
  total: number;
  done: number;
  succeeded: number;
  failed: number;
  skipped: number;
  running: number;
  remaining: number;
  percent: number;
};

export type WorldbookProcessControl = {
  isStopped?: () => boolean;
  isPaused?: () => boolean;
  waitForResume?: () => Promise<void>;
};

export type WorldbookProcessHooks = {
  onStart?: (payload: { total: number; pending: number }) => void;
  onChunkStart?: (chunk: MemoryChunk, attempt: number) => void;
  onChunkSuccess?: (chunk: MemoryChunk, result: WorldbookChunkProcessResult) => void;
  onChunkError?: (chunk: MemoryChunk, failure: WorldbookChunkProcessFailure) => void;
  onProgress?: (progress: WorldbookProcessProgress) => void;
  onComplete?: (summary: WorldbookProcessSummary) => void;
};

export type WorldbookPromptBuilder = (chunk: MemoryChunk) => string;

export type WorldbookResponseParser = (responseText: string, chunk: MemoryChunk) => WorldbookEntry[] | Promise<WorldbookEntry[]>;

export type WorldbookChunkExecutor = (payload: {
  chunk: MemoryChunk;
  prompt: string;
  attempt: number;
  signal: AbortSignal;
}) => Promise<WorldbookChunkExecutionResult>;

export type WorldbookProcessOptions = {
  chunks: ReadonlyArray<MemoryChunk>;
  processing: WorldbookProcessingOptions;
  maxRetries?: number;
  retryBackoffMs?: number;
  buildPrompt: WorldbookPromptBuilder;
  executeChunk: WorldbookChunkExecutor;
  parseEntries: WorldbookResponseParser;
  control?: WorldbookProcessControl;
  hooks?: WorldbookProcessHooks;
};

export type WorldbookProcessSummary = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  completed: boolean;
  stopped: boolean;
  results: WorldbookChunkProcessResult[];
  failures: WorldbookChunkProcessFailure[];
};
