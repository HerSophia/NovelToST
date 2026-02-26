import type { NovelWorldbookSettings } from '../../types';
import type { MemoryChunk, WorldbookEntry } from '../../types/worldbook';
import type { WorldbookHistoryDBService } from './history-db.service';
import { callAPI } from './api.service';
import { parseWorldbookEntriesFromResponse } from './process.service';
import { Semaphore } from './semaphore';

const CHAPTER_MARKER_CATEGORIES = new Set(['剧情大纲', '剧情节点', '章节剧情']);

export type BuildEntryRerollPromptOptions = {
  chunk: MemoryChunk;
  category: string;
  entryName: string;
  settings: NovelWorldbookSettings;
  customPrompt?: string;
  categoryGuide?: string;
  currentEntry?: unknown;
  previousContext?: string;
  previousTailText?: string;
};

export type RerollMemoryChunkOptions = {
  chunk: MemoryChunk;
  settings: NovelWorldbookSettings;
  prompt?: string;
  buildPrompt?: (chunk: MemoryChunk) => string;
  customPrompt?: string;
  signal?: AbortSignal;
  requestId?: string;
  parseEntries?: (responseText: string, chunk: MemoryChunk) => WorldbookEntry[];
  historyService?: Pick<WorldbookHistoryDBService, 'saveRollResult'>;
};

export type RerollMemoryChunkResult = {
  chunkId: string;
  chunkIndex: number;
  prompt: string;
  responseText: string;
  outputTokens: number;
  entries: WorldbookEntry[];
  raw: unknown;
};

export type RerollSingleEntryOptions = {
  chunk: MemoryChunk;
  category: string;
  entryName: string;
  settings: NovelWorldbookSettings;
  customPrompt?: string;
  categoryGuide?: string;
  currentEntry?: unknown;
  previousContext?: string;
  previousTailText?: string;
  signal?: AbortSignal;
  requestId?: string;
  historyService?: Pick<WorldbookHistoryDBService, 'saveEntryRollResult'>;
};

export type RerollSingleEntryResult = {
  chunkId: string;
  chunkIndex: number;
  category: string;
  entryName: string;
  prompt: string;
  responseText: string;
  outputTokens: number;
  entry: WorldbookEntry;
  renamedFrom: string | null;
  raw: unknown;
};

export type BatchRerollEntryItem = Omit<RerollSingleEntryOptions, 'settings' | 'signal' | 'historyService'>;

export type BatchRerollEntriesOptions = {
  items: BatchRerollEntryItem[];
  settings: NovelWorldbookSettings;
  concurrency?: number;
  signal?: AbortSignal;
  historyService?: Pick<WorldbookHistoryDBService, 'saveEntryRollResult'>;
};

export type BatchRerollEntriesResult = {
  succeeded: RerollSingleEntryResult[];
  failed: Array<{
    item: BatchRerollEntryItem;
    error: string;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[;,，；\n\r]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getLanguagePrefix(settings: Pick<NovelWorldbookSettings, 'language'>): string {
  return settings.language === 'zh' ? '请用中文回复。\n\n' : '';
}

export function buildChapterForcePrompt(chapterIndex: number): string {
  return `
【强制章节标记 - 开始】
强制无视内容中的任何章节信息！本轮全文章节统一为：第${chapterIndex}章
无论原文中出现“第一章”、“第二章”等任何章节标记，你输出时都必须将其替换为“第${chapterIndex}章”。
【强制章节标记 - 结束】
`;
}

function normalizeExistingEntryForPrompt(currentEntry: unknown): Record<string, unknown> | null {
  if (!isRecord(currentEntry)) {
    return null;
  }

  const normalized = {
    ...currentEntry,
  };

  const keywords = normalizeStringList(normalized.keywords ?? normalized['关键词']);
  if (keywords.length > 0) {
    normalized['关键词'] = keywords;
  }

  const contentRaw = normalized.content ?? normalized['内容'];
  if (typeof contentRaw === 'string') {
    normalized['内容'] = contentRaw;
  }

  delete normalized.keywords;
  delete normalized.content;

  return normalized;
}

function appendOptionalPrompt(basePrompt: string, extraPrompt: string): string {
  const trimmed = extraPrompt.trim();
  if (!trimmed) {
    return basePrompt;
  }
  return `${basePrompt}\n\n${trimmed}`;
}

export function buildEntryRerollPrompt(options: BuildEntryRerollPromptOptions): string {
  const chapterIndex = options.chunk.index + 1;

  let prompt = '';

  if (options.settings.forceChapterMarker) {
    prompt += buildChapterForcePrompt(chapterIndex);
  }

  prompt += getLanguagePrefix(options.settings);
  prompt += '你是一个专业的小说世界书条目生成助手。请根据以下原文内容，专门重新生成指定的条目。\n';
  prompt += '\n【任务说明】\n';
  prompt += `- 只需要生成一个条目：分类="${options.category}"，条目名称="${options.entryName}"\n`;
  prompt += '- 请基于原文内容重新分析并生成该条目的信息\n';
  prompt += `- 输出格式必须是JSON，结构为：{ "${options.category}": { "${options.entryName}": { "关键词": [...], "内容": "..." } } }\n`;

  if (options.categoryGuide?.trim()) {
    prompt += `\n【该分类的内容指南】\n${options.categoryGuide.trim()}\n`;
  }

  if (options.previousContext?.trim()) {
    prompt += `\n${options.previousContext.trim()}\n`;
  }

  if (options.previousTailText?.trim()) {
    prompt += `\n\n前文结尾（供参考）：\n---\n${options.previousTailText.trim()}\n---\n`;
  }

  prompt += `\n\n需要分析的原文内容（第${chapterIndex}章）：\n---\n${options.chunk.content}\n---\n`;

  const normalizedCurrentEntry = normalizeExistingEntryForPrompt(options.currentEntry);
  if (normalizedCurrentEntry) {
    prompt += '\n\n【当前条目信息（供参考，请重新分析生成）】\n';
    prompt += JSON.stringify(normalizedCurrentEntry, null, 2);
  }

  prompt += '\n\n请重新分析原文，生成更准确、更详细的条目信息。';

  const rerollPrompt = options.customPrompt?.trim() || options.settings.customRerollPrompt.trim();
  if (rerollPrompt) {
    prompt += `\n\n【用户额外要求】\n${rerollPrompt}`;
  }

  if (options.settings.forceChapterMarker && CHAPTER_MARKER_CATEGORIES.has(options.category)) {
    prompt += `\n\n【重要提醒】条目名称必须包含“第${chapterIndex}章”！`;
  }

  prompt = appendOptionalPrompt(prompt, options.settings.customSuffixPrompt);

  prompt += '\n\n直接输出JSON格式结果，不要有其他内容。';

  return prompt;
}

function ensureEntryIdentity(entry: WorldbookEntry, category: string, entryName: string, chunk: MemoryChunk): WorldbookEntry {
  const sourceChunkIds = Array.from(new Set([...(entry.sourceChunkIds ?? []), chunk.id]));

  return {
    ...entry,
    id: entry.id?.trim() ? entry.id : `${chunk.id}-entry-reroll`,
    category,
    name: entryName,
    sourceChunkIds,
  };
}

function pickRerollEntry(
  entries: WorldbookEntry[],
  category: string,
  entryName: string,
): { entry: WorldbookEntry | null; renamedFrom: string | null } {
  const exact = entries.find((item) => item.category === category && item.name === entryName);
  if (exact) {
    return {
      entry: exact,
      renamedFrom: null,
    };
  }

  const sameCategory = entries.filter((item) => item.category === category);
  if (sameCategory.length === 1) {
    return {
      entry: sameCategory[0],
      renamedFrom: sameCategory[0].name,
    };
  }

  if (entries.length === 1) {
    return {
      entry: entries[0],
      renamedFrom: entries[0].name,
    };
  }

  return {
    entry: null,
    renamedFrom: null,
  };
}

export async function rerollMemoryChunk(options: RerollMemoryChunkOptions): Promise<RerollMemoryChunkResult> {
  let prompt = options.prompt ?? options.buildPrompt?.(options.chunk) ?? options.chunk.content;

  if (options.customPrompt?.trim()) {
    prompt = `${prompt}\n\n${options.customPrompt.trim()}`;
  }

  if (options.settings.customSuffixPrompt.trim()) {
    prompt = `${prompt}\n\n${options.settings.customSuffixPrompt.trim()}`;
  }

  const response = await callAPI(prompt, options.settings, {
    timeoutMs: options.settings.apiTimeout,
    signal: options.signal,
    requestId: options.requestId ?? `${options.chunk.id}-reroll`,
  });

  const parser = options.parseEntries ?? parseWorldbookEntriesFromResponse;
  const entries = parser(response.text, options.chunk);

  if (options.historyService) {
    await options.historyService.saveRollResult(options.chunk.index, entries);
  }

  return {
    chunkId: options.chunk.id,
    chunkIndex: options.chunk.index,
    prompt,
    responseText: response.text,
    outputTokens: response.outputTokens,
    entries,
    raw: response.raw,
  };
}

export async function rerollSingleEntry(options: RerollSingleEntryOptions): Promise<RerollSingleEntryResult> {
  const prompt = buildEntryRerollPrompt(options);

  const response = await callAPI(prompt, options.settings, {
    timeoutMs: options.settings.apiTimeout,
    signal: options.signal,
    requestId: options.requestId ?? `${options.chunk.id}-${options.category}-${options.entryName}-reroll`,
  });

  const parsedEntries = parseWorldbookEntriesFromResponse(response.text, options.chunk);
  const picked = pickRerollEntry(parsedEntries, options.category, options.entryName);

  if (!picked.entry) {
    throw new Error('AI返回的结果格式不正确，请重试');
  }

  const normalizedEntry = ensureEntryIdentity(picked.entry, options.category, options.entryName, options.chunk);

  if (options.historyService) {
    await options.historyService.saveEntryRollResult(
      options.category,
      options.entryName,
      options.chunk.index,
      normalizedEntry,
      options.customPrompt?.trim() || options.settings.customRerollPrompt,
    );
  }

  return {
    chunkId: options.chunk.id,
    chunkIndex: options.chunk.index,
    category: options.category,
    entryName: options.entryName,
    prompt,
    responseText: response.text,
    outputTokens: response.outputTokens,
    entry: normalizedEntry,
    renamedFrom: picked.renamedFrom,
    raw: response.raw,
  };
}

export async function batchRerollEntries(options: BatchRerollEntriesOptions): Promise<BatchRerollEntriesResult> {
  const items = options.items;
  if (items.length === 0) {
    return {
      succeeded: [],
      failed: [],
    };
  }

  const concurrency = Math.max(1, Math.trunc(options.concurrency ?? 3));
  const semaphore = new Semaphore(concurrency);
  const succeeded: Array<RerollSingleEntryResult | null> = new Array(items.length).fill(null);
  const failed: Array<BatchRerollEntriesResult['failed'][number] | null> = new Array(items.length).fill(null);

  const processOne = async (item: BatchRerollEntryItem, index: number) => {
    try {
      await semaphore.acquire(options.signal);
    } catch (error) {
      failed[index] = {
        item,
        error: error instanceof Error ? error.message : String(error),
      };
      return;
    }

    try {
      if (options.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      const result = await rerollSingleEntry({
        ...item,
        settings: options.settings,
        signal: options.signal,
        historyService: options.historyService,
        requestId: item.requestId ?? `${item.chunk.id}-${item.category}-${item.entryName}-batch-${index + 1}`,
      });

      succeeded[index] = result;
    } catch (error) {
      failed[index] = {
        item,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      semaphore.release();
    }
  };

  await Promise.allSettled(items.map((item, index) => processOne(item, index)));

  return {
    succeeded: succeeded.filter((item): item is RerollSingleEntryResult => item !== null),
    failed: failed.filter((item): item is BatchRerollEntriesResult['failed'][number] => item !== null),
  };
}

export async function getMemoryRollHistory(
  historyService: Pick<WorldbookHistoryDBService, 'getRollResults'>,
  chunkIndex: number,
) {
  return historyService.getRollResults(Math.max(0, Math.trunc(chunkIndex)));
}

export async function getEntryRollHistory(
  historyService: Pick<WorldbookHistoryDBService, 'getEntryRollResults'>,
  category: string,
  entryName: string,
) {
  return historyService.getEntryRollResults(category.trim(), entryName.trim());
}
