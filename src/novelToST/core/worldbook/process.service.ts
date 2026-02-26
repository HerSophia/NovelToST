import type { NovelWorldbookSettings } from '../../types';
import type {
  MemoryChunk,
  WorldbookApiErrorType,
  WorldbookChunkExecutionResult,
  WorldbookChunkProcessFailure,
  WorldbookChunkProcessResult,
  WorldbookEntry,
  WorldbookProcessControl,
  WorldbookProcessHooks,
  WorldbookProcessOptions,
  WorldbookProcessSummary,
} from '../../types/worldbook';
import { callAPI, WorldbookApiError } from './api.service';
import { Semaphore } from './semaphore';
import { estimateTokenCount } from './token.service';

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BACKOFF_MS = 1000;
const STOP_CHECK_INTERVAL_MS = 120;

type ProcessOutcome =
  | { status: 'success'; result: WorldbookChunkProcessResult }
  | { status: 'failed'; failure: WorldbookChunkProcessFailure }
  | { status: 'skipped' };

type ProgressState = {
  succeeded: number;
  failed: number;
  skipped: number;
  running: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looksLikeEntryObject(value: Record<string, unknown>): boolean {
  return 'keywords' in value || '关键词' in value || 'content' in value || '内容' in value || 'name' in value;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[;,，；\n\r]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

function buildFallbackEntryFromText(responseText: string, chunk: MemoryChunk): WorldbookEntry[] {
  const normalized = responseText.trim();
  if (!normalized) {
    return [];
  }

  return [
    {
      id: `${chunk.id}-entry-1`,
      category: '未分类',
      name: chunk.title || `记忆块${chunk.index + 1}`,
      keywords: [chunk.title].filter(Boolean),
      content: normalized,
      sourceChunkIds: [chunk.id],
    },
  ];
}

function normalizeEntry(
  rawEntry: unknown,
  chunk: MemoryChunk,
  entryIndex: number,
  defaults: {
    category?: string;
    name?: string;
  } = {},
): WorldbookEntry | null {
  if (!isRecord(rawEntry)) {
    return null;
  }

  const category = typeof rawEntry.category === 'string' && rawEntry.category.trim() ? rawEntry.category.trim() : defaults.category ?? '未分类';
  const name = typeof rawEntry.name === 'string' && rawEntry.name.trim() ? rawEntry.name.trim() : defaults.name ?? `条目${entryIndex + 1}`;

  const keywords = normalizeStringList(rawEntry.keywords ?? rawEntry['关键词']);
  const contentRaw = rawEntry.content ?? rawEntry['内容'];
  const content = typeof contentRaw === 'string' ? contentRaw.trim() : '';

  const sourceChunkIdsRaw = rawEntry.sourceChunkIds;
  const sourceChunkIds = Array.isArray(sourceChunkIdsRaw)
    ? sourceChunkIdsRaw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const normalizedSourceChunkIds = Array.from(new Set([...sourceChunkIds, chunk.id]));
  const id = typeof rawEntry.id === 'string' && rawEntry.id.trim() ? rawEntry.id.trim() : `${chunk.id}-entry-${entryIndex + 1}`;

  if (!content && keywords.length === 0) {
    return null;
  }

  return {
    id,
    category,
    name,
    keywords,
    content,
    position: toNumberOrUndefined(rawEntry.position),
    depth: toNumberOrUndefined(rawEntry.depth),
    order: toNumberOrUndefined(rawEntry.order),
    disable: typeof rawEntry.disable === 'boolean' ? rawEntry.disable : undefined,
    sourceChunkIds: normalizedSourceChunkIds,
  };
}

function parseCategoryEntries(categoryName: string, value: unknown, chunk: MemoryChunk): WorldbookEntry[] {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => normalizeEntry(item, chunk, index, { category: categoryName }))
      .filter((entry): entry is WorldbookEntry => entry !== null);
  }

  if (!isRecord(value)) {
    return [];
  }

  if (looksLikeEntryObject(value)) {
    const normalized = normalizeEntry(value, chunk, 0, {
      category: categoryName,
      name: categoryName,
    });
    return normalized ? [normalized] : [];
  }

  const entries: WorldbookEntry[] = [];
  let index = 0;

  for (const [entryName, entryValue] of Object.entries(value)) {
    const normalized = normalizeEntry(entryValue, chunk, index, {
      category: categoryName,
      name: entryName,
    });

    if (normalized) {
      entries.push(normalized);
      index += 1;
    }
  }

  return entries;
}

function extractJsonPayload(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const candidates = [trimmed];

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBraceIndex = trimmed.indexOf('{');
  const lastBraceIndex = trimmed.lastIndexOf('}');
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    candidates.push(trimmed.slice(firstBraceIndex, lastBraceIndex + 1));
  }

  const firstArrayIndex = trimmed.indexOf('[');
  const lastArrayIndex = trimmed.lastIndexOf(']');
  if (firstArrayIndex >= 0 && lastArrayIndex > firstArrayIndex) {
    candidates.push(trimmed.slice(firstArrayIndex, lastArrayIndex + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // ignored, try next candidate
    }
  }

  return null;
}

function normalizeParsedEntries(parsed: unknown, chunk: MemoryChunk): WorldbookEntry[] {
  if (Array.isArray(parsed)) {
    return parsed
      .map((item, index) => normalizeEntry(item, chunk, index))
      .filter((entry): entry is WorldbookEntry => entry !== null);
  }

  if (!isRecord(parsed)) {
    return [];
  }

  if (Array.isArray(parsed.entries)) {
    return parsed.entries
      .map((entry, index) => normalizeEntry(entry, chunk, index))
      .filter((entry): entry is WorldbookEntry => entry !== null);
  }

  if (looksLikeEntryObject(parsed)) {
    const normalized = normalizeEntry(parsed, chunk, 0, {
      category: '未分类',
      name: chunk.title,
    });
    return normalized ? [normalized] : [];
  }

  const entries: WorldbookEntry[] = [];
  for (const [categoryName, categoryValue] of Object.entries(parsed)) {
    entries.push(...parseCategoryEntries(categoryName, categoryValue, chunk));
  }

  return entries;
}

function normalizeFailureType(error: unknown): WorldbookApiErrorType {
  if (error instanceof WorldbookApiError) {
    return error.type;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'aborted';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('timeout') || message.includes('超时')) {
      return 'timeout';
    }
    if (message.includes('rate limit') || message.includes('限流')) {
      return 'rate_limit';
    }
    if (message === 'aborted') {
      return 'aborted';
    }
  }

  return 'unknown';
}

function normalizeFailureMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || '未知错误';
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
}

function isStopped(control: WorldbookProcessControl | undefined): boolean {
  return control?.isStopped?.() === true;
}

function isPaused(control: WorldbookProcessControl | undefined): boolean {
  return control?.isPaused?.() === true;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    globalThis.setTimeout(resolve, ms);
  });
}

async function waitForRunnable(control: WorldbookProcessControl | undefined): Promise<void> {
  while (isPaused(control) && !isStopped(control)) {
    if (control?.waitForResume) {
      await control.waitForResume();
    } else {
      await sleep(200);
    }
  }

  if (isStopped(control)) {
    throw new Error('ABORTED');
  }
}

function getRetryDelay(baseDelay: number, attempt: number): number {
  const multiplier = Math.max(1, 2 ** Math.max(0, attempt - 1));
  return Math.min(10_000, baseDelay * multiplier);
}

function emitProgress(hooks: WorldbookProcessHooks | undefined, total: number, state: ProgressState): void {
  if (!hooks?.onProgress) {
    return;
  }

  const done = state.succeeded + state.failed + state.skipped;
  const remaining = Math.max(0, total - done - state.running);
  const percent = total === 0 ? 100 : Math.round((done / total) * 1000) / 10;

  hooks.onProgress({
    total,
    done,
    succeeded: state.succeeded,
    failed: state.failed,
    skipped: state.skipped,
    running: state.running,
    remaining,
    percent,
  });
}

async function processChunkWithRetry(options: {
  chunk: MemoryChunk;
  maxRetries: number;
  retryBackoffMs: number;
  buildPrompt: WorldbookProcessOptions['buildPrompt'];
  executeChunk: WorldbookProcessOptions['executeChunk'];
  parseEntries: WorldbookProcessOptions['parseEntries'];
  control?: WorldbookProcessControl;
  hooks?: WorldbookProcessHooks;
  activeControllers: Set<AbortController>;
}): Promise<ProcessOutcome> {
  const maxAttempts = options.maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await waitForRunnable(options.control);
    } catch {
      return { status: 'skipped' };
    }

    options.hooks?.onChunkStart?.(options.chunk, attempt);

    const controller = new AbortController();
    options.activeControllers.add(controller);

    try {
      const prompt = options.buildPrompt(options.chunk);
      const startedAt = Date.now();
      const executionResult = await options.executeChunk({
        chunk: options.chunk,
        prompt,
        attempt,
        signal: controller.signal,
      });

      const normalizedResponse = executionResult.responseText?.trim() ?? '';
      if (!normalizedResponse) {
        throw new WorldbookApiError('API 返回空响应', {
          type: 'empty_response',
          provider: 'unknown',
        });
      }

      const parsedEntries = await options.parseEntries(normalizedResponse, options.chunk);
      const normalizedEntries = parsedEntries.map((entry, index) => ({
        ...entry,
        id: entry.id?.trim() ? entry.id : `${options.chunk.id}-entry-${index + 1}`,
        sourceChunkIds: Array.from(new Set([...(entry.sourceChunkIds ?? []), options.chunk.id])),
      }));

      const elapsedMs = Math.max(0, Date.now() - startedAt);
      const outputTokens = Math.max(0, Math.trunc(executionResult.outputTokens ?? estimateTokenCount(normalizedResponse)));

      return {
        status: 'success',
        result: {
          chunkId: options.chunk.id,
          chunkIndex: options.chunk.index,
          attempt,
          elapsedMs,
          responseText: normalizedResponse,
          outputTokens,
          entries: normalizedEntries,
          raw: executionResult.raw ?? normalizedResponse,
        },
      };
    } catch (error) {
      const failure: WorldbookChunkProcessFailure = {
        chunkId: options.chunk.id,
        chunkIndex: options.chunk.index,
        attempt,
        errorType: normalizeFailureType(error),
        message: normalizeFailureMessage(error),
      };

      options.hooks?.onChunkError?.(options.chunk, failure);

      const shouldAbortDirectly = failure.errorType === 'aborted' && isStopped(options.control);
      if (shouldAbortDirectly) {
        return { status: 'skipped' };
      }

      const canRetry = attempt < maxAttempts && !isStopped(options.control);
      if (canRetry) {
        const delay = getRetryDelay(options.retryBackoffMs, attempt);
        if (delay > 0) {
          await sleep(delay);
        }
        continue;
      }

      return {
        status: 'failed',
        failure,
      };
    } finally {
      options.activeControllers.delete(controller);
    }
  }

  return { status: 'skipped' };
}

function buildSummary(total: number, state: ProgressState, results: WorldbookChunkProcessResult[], failures: WorldbookChunkProcessFailure[], stopped: boolean): WorldbookProcessSummary {
  const maxSkippable = Math.max(0, total - state.succeeded - state.failed);
  const skipped = Math.min(maxSkippable, state.skipped);
  const completed = !stopped && state.succeeded + state.failed >= total;

  return {
    total,
    succeeded: state.succeeded,
    failed: state.failed,
    skipped,
    completed,
    stopped,
    results,
    failures,
  };
}

function shouldUseBatchMode(options: WorldbookProcessOptions): boolean {
  if (!options.processing.parallelEnabled) {
    return false;
  }
  return options.processing.parallelMode === 'batch';
}

export function parseWorldbookEntriesFromResponse(responseText: string, chunk: MemoryChunk): WorldbookEntry[] {
  const normalizedText = responseText.trim();
  if (!normalizedText) {
    return [];
  }

  const payload = extractJsonPayload(normalizedText);
  if (payload === null) {
    return buildFallbackEntryFromText(normalizedText, chunk);
  }

  const parsedEntries = normalizeParsedEntries(payload, chunk);
  if (parsedEntries.length > 0) {
    return parsedEntries;
  }

  return buildFallbackEntryFromText(normalizedText, chunk);
}

export function createWorldbookChunkExecutor(settings: NovelWorldbookSettings): WorldbookProcessOptions['executeChunk'] {
  return async ({ prompt, chunk, attempt, signal }): Promise<WorldbookChunkExecutionResult> => {
    const response = await callAPI(prompt, settings, {
      timeoutMs: settings.apiTimeout,
      signal,
      requestId: `${chunk.id}-try-${attempt}`,
    });

    return {
      responseText: response.text,
      outputTokens: response.outputTokens,
      raw: response.raw,
    };
  };
}

export async function processWorldbookChunks(options: WorldbookProcessOptions): Promise<WorldbookProcessSummary> {
  const pendingChunks = options.chunks.filter(chunk => !chunk.processed || chunk.failed);
  const total = pendingChunks.length;

  const maxRetries = Math.max(0, Math.trunc(options.maxRetries ?? DEFAULT_MAX_RETRIES));
  const retryBackoffMs = Math.max(0, Math.trunc(options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS));
  const concurrency = options.processing.parallelEnabled ? Math.max(1, Math.trunc(options.processing.parallelConcurrency || 1)) : 1;

  const semaphore = new Semaphore(concurrency);
  const activeControllers = new Set<AbortController>();
  const results: WorldbookChunkProcessResult[] = [];
  const failures: WorldbookChunkProcessFailure[] = [];
  const progressState: ProgressState = {
    succeeded: 0,
    failed: 0,
    skipped: 0,
    running: 0,
  };

  options.hooks?.onStart?.({
    total: options.chunks.length,
    pending: total,
  });
  emitProgress(options.hooks, total, progressState);

  const stopWatcher = globalThis.setInterval(() => {
    if (!isStopped(options.control)) {
      return;
    }

    semaphore.abort('ABORTED');
    for (const controller of activeControllers) {
      controller.abort();
    }
  }, STOP_CHECK_INTERVAL_MS);

  const runChunk = async (chunk: MemoryChunk): Promise<void> => {
    try {
      await semaphore.acquire();
    } catch {
      progressState.skipped += 1;
      emitProgress(options.hooks, total, progressState);
      return;
    }

    progressState.running += 1;
    emitProgress(options.hooks, total, progressState);

    try {
      const outcome = await processChunkWithRetry({
        chunk,
        maxRetries,
        retryBackoffMs,
        buildPrompt: options.buildPrompt,
        executeChunk: options.executeChunk,
        parseEntries: options.parseEntries,
        control: options.control,
        hooks: options.hooks,
        activeControllers,
      });

      if (outcome.status === 'success') {
        progressState.succeeded += 1;
        results.push(outcome.result);
        options.hooks?.onChunkSuccess?.(chunk, outcome.result);
      } else if (outcome.status === 'failed') {
        progressState.failed += 1;
        failures.push(outcome.failure);
      } else {
        progressState.skipped += 1;
      }
    } finally {
      progressState.running = Math.max(0, progressState.running - 1);
      semaphore.release();
      emitProgress(options.hooks, total, progressState);
    }
  };

  try {
    if (shouldUseBatchMode(options)) {
      for (let start = 0; start < pendingChunks.length; start += concurrency) {
        if (isStopped(options.control)) {
          progressState.skipped += pendingChunks.length - start;
          break;
        }

        try {
          await waitForRunnable(options.control);
        } catch {
          progressState.skipped += pendingChunks.length - start;
          break;
        }

        const batch = pendingChunks.slice(start, start + concurrency);
        await Promise.allSettled(batch.map(chunk => runChunk(chunk)));
      }
    } else {
      const runningTasks = new Set<Promise<void>>();

      for (let index = 0; index < pendingChunks.length; index += 1) {
        if (isStopped(options.control)) {
          progressState.skipped += pendingChunks.length - index;
          break;
        }

        try {
          await waitForRunnable(options.control);
        } catch {
          progressState.skipped += pendingChunks.length - index;
          break;
        }

        const chunk = pendingChunks[index];
        const task = runChunk(chunk);
        runningTasks.add(task);
        task.finally(() => {
          runningTasks.delete(task);
        });
      }

      await Promise.allSettled(Array.from(runningTasks));
    }
  } finally {
    globalThis.clearInterval(stopWatcher);
  }

  const summary = buildSummary(total, progressState, results, failures, isStopped(options.control));
  options.hooks?.onComplete?.(summary);
  return summary;
}
