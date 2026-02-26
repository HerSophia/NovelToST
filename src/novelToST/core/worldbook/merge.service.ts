import type { NovelWorldbookSettings } from '../../types';
import type { WorldbookHistoryDBService } from './history-db.service';
import { callAPI } from './api.service';
import { Semaphore } from './semaphore';

export type StructuredWorldbookEntry = Record<string, unknown>;
export type StructuredWorldbookCategory = Record<string, StructuredWorldbookEntry>;
export type StructuredWorldbookData = Record<string, StructuredWorldbookCategory>;

export type WorldbookChangeType = 'add' | 'modify' | 'delete';

export type WorldbookChangedEntry = {
  type: WorldbookChangeType;
  category: string;
  entryName: string;
  oldValue: StructuredWorldbookEntry | null;
  newValue: StructuredWorldbookEntry | null;
};

export type MergeWorldbookWithHistoryOptions = {
  target: StructuredWorldbookData;
  source: StructuredWorldbookData;
  memoryIndex: number;
  memoryTitle: string;
  incremental?: boolean;
  fileHash?: string | null;
  volumeIndex?: number;
  historyService?: Pick<WorldbookHistoryDBService, 'saveHistory'>;
};

export type WorldbookDuplicateEntry = {
  category: string;
  name: string;
  existing: StructuredWorldbookEntry;
  imported: StructuredWorldbookEntry;
};

export type WorldbookNewEntry = {
  category: string;
  name: string;
  entry: StructuredWorldbookEntry;
};

export type WorldbookMergeMode = 'ai' | 'replace' | 'keep' | 'rename' | 'append';

export type MergeEntriesWithAIOptions = {
  entryA: StructuredWorldbookEntry;
  entryB: StructuredWorldbookEntry;
  settings: NovelWorldbookSettings;
  customPrompt?: string;
  signal?: AbortSignal;
  requestId?: string;
};

export type MergeEntriesWithAIResult = {
  entry: StructuredWorldbookEntry;
  prompt: string;
  responseText: string;
  outputTokens: number;
  raw: unknown;
};

export type PerformWorldbookMergeOptions = {
  existingWorldbook: StructuredWorldbookData;
  importedWorldbook: StructuredWorldbookData;
  mode: WorldbookMergeMode;
  customPrompt?: string;
  concurrency?: number;
  settings?: NovelWorldbookSettings;
  signal?: AbortSignal;
};

export type PerformWorldbookMergeResult = {
  worldbook: StructuredWorldbookData;
  duplicates: WorldbookDuplicateEntry[];
  newEntries: WorldbookNewEntry[];
  processedDuplicates: number;
  failedDuplicates: Array<{ duplicate: WorldbookDuplicateEntry; error: string }>;
};

export type WorldbookAliasMergeMode = 'append' | 'replace' | 'keep';

export type WorldbookAliasMergeGroup = {
  category: string;
  canonicalName: string;
  aliases: string[];
};

export type MergeWorldbookAliasesOptions = {
  worldbook: StructuredWorldbookData;
  groups: WorldbookAliasMergeGroup[];
  mode?: WorldbookAliasMergeMode;
  keepAliases?: boolean;
};

export type MergeWorldbookAliasesResult = {
  worldbook: StructuredWorldbookData;
  mergedCount: number;
  missingCount: number;
  merged: Array<{ category: string; canonicalName: string; alias: string }>;
};

export type WorldbookCategoryConsolidateMode = 'append' | 'replace' | 'keep' | 'rename';

export type WorldbookCategoryConsolidateRule = {
  sourceCategory: string;
  targetCategory: string;
};

export type ConsolidateWorldbookCategoriesOptions = {
  worldbook: StructuredWorldbookData;
  rules: WorldbookCategoryConsolidateRule[];
  mode?: WorldbookCategoryConsolidateMode;
  removeSourceCategory?: boolean;
};

export type ConsolidateWorldbookCategoriesResult = {
  worldbook: StructuredWorldbookData;
  movedCount: number;
  conflictCount: number;
  moved: Array<{
    sourceCategory: string;
    targetCategory: string;
    entryName: string;
    renamedTo?: string;
  }>;
};

export const DEFAULT_MERGE_PROMPT = `你是世界书条目合并专家。请将以下两个相同名称的世界书条目合并为一个，保留所有重要信息，去除重复内容。

## 合并规则
1. 关键词：合并两者的关键词，去重
2. 内容：整合两者的描述，保留所有独特信息，用markdown格式组织
3. 如有矛盾信息，保留更详细/更新的版本
4. 输出格式必须是JSON

## 条目A
{ENTRY_A}

## 条目B
{ENTRY_B}

请直接输出合并后的JSON格式条目：
{"关键词": [...], "内容": "..."}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeKeywordList(value: unknown): string[] {
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

function pickEntryContent(entry: Record<string, unknown>): string {
  const content = typeof entry['内容'] === 'string' ? entry['内容'] : '';
  const plain = typeof entry.content === 'string' ? entry.content : '';

  if (plain && (!content || plain.length > content.length)) {
    return plain;
  }

  return content;
}

function normalizeStructuredEntry(entry: Record<string, unknown>): StructuredWorldbookEntry {
  const next = deepClone(entry);
  const keywords = normalizeKeywordList(next['关键词'] ?? next.keywords);
  const content = pickEntryContent(next);

  delete next.content;
  delete next.keywords;

  if (keywords.length > 0) {
    next['关键词'] = keywords;
  }

  if (content) {
    next['内容'] = content;
  }

  return next;
}

function looksLikeEntryObject(value: Record<string, unknown>): boolean {
  return '关键词' in value || '内容' in value || 'keywords' in value || 'content' in value;
}

export function normalizeWorldbookData(data: unknown): StructuredWorldbookData {
  if (!isRecord(data)) {
    return {};
  }

  const result: StructuredWorldbookData = {};

  for (const [category, categoryData] of Object.entries(data)) {
    if (!isRecord(categoryData)) {
      continue;
    }

    const normalizedCategory: StructuredWorldbookCategory = {};

    if (looksLikeEntryObject(categoryData)) {
      normalizedCategory[category] = normalizeStructuredEntry(categoryData);
      result[category] = normalizedCategory;
      continue;
    }

    for (const [entryName, entryData] of Object.entries(categoryData)) {
      if (!isRecord(entryData)) {
        continue;
      }

      normalizedCategory[entryName] = normalizeStructuredEntry(entryData);
    }

    if (Object.keys(normalizedCategory).length > 0) {
      result[category] = normalizedCategory;
    }
  }

  return result;
}

function mergeObjectDeep(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const next = deepClone(target);

  for (const [key, sourceValue] of Object.entries(source)) {
    if (isRecord(sourceValue)) {
      const targetValue = isRecord(next[key]) ? (next[key] as Record<string, unknown>) : {};
      next[key] = mergeObjectDeep(targetValue, sourceValue);
      continue;
    }

    next[key] = deepClone(sourceValue);
  }

  return next;
}

export function mergeWorldbookData(target: StructuredWorldbookData, source: StructuredWorldbookData): StructuredWorldbookData {
  const normalizedTarget = normalizeWorldbookData(target);
  const normalizedSource = normalizeWorldbookData(source);

  return mergeObjectDeep(normalizedTarget, normalizedSource) as StructuredWorldbookData;
}

function mergeKeywords(existing: unknown, incoming: unknown): string[] {
  return Array.from(new Set([...normalizeKeywordList(existing), ...normalizeKeywordList(incoming)]));
}

function mergeContent(existing: unknown, incoming: unknown): string {
  const existingContent = typeof existing === 'string' ? existing.trim() : '';
  const incomingContent = typeof incoming === 'string' ? incoming.trim() : '';

  if (!existingContent) {
    return incomingContent;
  }
  if (!incomingContent) {
    return existingContent;
  }

  const fingerprint = incomingContent.slice(0, 50);
  if (fingerprint && existingContent.includes(fingerprint)) {
    return existingContent;
  }

  return `${existingContent}\n\n---\n\n${incomingContent}`;
}

export function mergeWorldbookDataIncremental(target: StructuredWorldbookData, source: StructuredWorldbookData): StructuredWorldbookData {
  const base = normalizeWorldbookData(target);
  const incoming = normalizeWorldbookData(source);
  const next = deepClone(base);

  for (const [category, categoryData] of Object.entries(incoming)) {
    if (!next[category]) {
      next[category] = {};
    }

    for (const [entryName, sourceEntry] of Object.entries(categoryData)) {
      const existingEntry = next[category][entryName];

      if (isRecord(existingEntry)) {
        const merged = {
          ...existingEntry,
          ...sourceEntry,
        };

        const mergedKeywords = mergeKeywords(existingEntry['关键词'], sourceEntry['关键词']);
        const mergedContent = mergeContent(existingEntry['内容'], sourceEntry['内容']);

        if (mergedKeywords.length > 0) {
          merged['关键词'] = mergedKeywords;
        }

        merged['内容'] = mergedContent;
        next[category][entryName] = merged;
      } else {
        next[category][entryName] = deepClone(sourceEntry);
      }
    }
  }

  return next;
}

export function findChangedEntries(oldWorldbook: StructuredWorldbookData, newWorldbook: StructuredWorldbookData): WorldbookChangedEntry[] {
  const changes: WorldbookChangedEntry[] = [];

  for (const [category, newCategory] of Object.entries(newWorldbook)) {
    const oldCategory = oldWorldbook[category] ?? {};

    for (const [entryName, newEntry] of Object.entries(newCategory)) {
      const oldEntry = oldCategory[entryName];
      if (!oldEntry) {
        changes.push({
          type: 'add',
          category,
          entryName,
          oldValue: null,
          newValue: deepClone(newEntry),
        });
        continue;
      }

      if (JSON.stringify(oldEntry) !== JSON.stringify(newEntry)) {
        changes.push({
          type: 'modify',
          category,
          entryName,
          oldValue: deepClone(oldEntry),
          newValue: deepClone(newEntry),
        });
      }
    }
  }

  for (const [category, oldCategory] of Object.entries(oldWorldbook)) {
    const newCategory = newWorldbook[category] ?? {};

    for (const [entryName, oldEntry] of Object.entries(oldCategory)) {
      if (!newCategory[entryName]) {
        changes.push({
          type: 'delete',
          category,
          entryName,
          oldValue: deepClone(oldEntry),
          newValue: null,
        });
      }
    }
  }

  return changes;
}

export async function mergeWorldbookDataWithHistory(options: MergeWorldbookWithHistoryOptions): Promise<{
  mergedWorldbook: StructuredWorldbookData;
  changedEntries: WorldbookChangedEntry[];
}> {
  const previousWorldbook = normalizeWorldbookData(options.target);
  const mergedWorldbook = options.incremental
    ? mergeWorldbookDataIncremental(previousWorldbook, options.source)
    : mergeWorldbookData(previousWorldbook, options.source);

  const changedEntries = findChangedEntries(previousWorldbook, mergedWorldbook);

  if (changedEntries.length > 0 && options.historyService) {
    await options.historyService.saveHistory({
      memoryIndex: Math.max(0, Math.trunc(options.memoryIndex)),
      memoryTitle: options.memoryTitle,
      previousWorldbook,
      newWorldbook: mergedWorldbook,
      changedEntries,
      fileHash: options.fileHash,
      volumeIndex: options.volumeIndex,
    });
  }

  return {
    mergedWorldbook,
    changedEntries,
  };
}

export function findDuplicateEntries(existing: StructuredWorldbookData, imported: StructuredWorldbookData): WorldbookDuplicateEntry[] {
  const normalizedExisting = normalizeWorldbookData(existing);
  const normalizedImported = normalizeWorldbookData(imported);

  const duplicates: WorldbookDuplicateEntry[] = [];

  for (const [category, importedCategory] of Object.entries(normalizedImported)) {
    const existingCategory = normalizedExisting[category];
    if (!existingCategory) {
      continue;
    }

    for (const [name, importedEntry] of Object.entries(importedCategory)) {
      const existingEntry = existingCategory[name];
      if (!existingEntry) {
        continue;
      }

      if (JSON.stringify(existingEntry) !== JSON.stringify(importedEntry)) {
        duplicates.push({
          category,
          name,
          existing: deepClone(existingEntry),
          imported: deepClone(importedEntry),
        });
      }
    }
  }

  return duplicates;
}

export function findNewEntries(existing: StructuredWorldbookData, imported: StructuredWorldbookData): WorldbookNewEntry[] {
  const normalizedExisting = normalizeWorldbookData(existing);
  const normalizedImported = normalizeWorldbookData(imported);

  const newEntries: WorldbookNewEntry[] = [];

  for (const [category, importedCategory] of Object.entries(normalizedImported)) {
    const existingCategory = normalizedExisting[category];

    for (const [name, entry] of Object.entries(importedCategory)) {
      if (!existingCategory || !existingCategory[name]) {
        newEntries.push({
          category,
          name,
          entry: deepClone(entry),
        });
      }
    }
  }

  return newEntries;
}

export function groupEntriesByCategory<T extends { category: string }>(entries: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  for (const item of entries) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push(item);
  }

  return grouped;
}

function normalizeNameToken(value: string): string {
  return value.trim().toLowerCase();
}

export function mergeWorldbookAliases(options: MergeWorldbookAliasesOptions): MergeWorldbookAliasesResult {
  const resultWorldbook = normalizeWorldbookData(options.worldbook);
  const mode = options.mode ?? 'append';
  const keepAliases = options.keepAliases ?? false;
  let mergedCount = 0;
  let missingCount = 0;
  const merged: MergeWorldbookAliasesResult['merged'] = [];

  for (const group of options.groups) {
    const category = group.category.trim();
    const canonicalName = group.canonicalName.trim();

    if (!category || !canonicalName) {
      continue;
    }

    const categoryData = resultWorldbook[category];
    const aliasNames = Array.from(new Set(group.aliases.map((item) => item.trim()).filter(Boolean))).filter(
      (alias) => normalizeNameToken(alias) !== normalizeNameToken(canonicalName),
    );

    if (!categoryData) {
      missingCount += aliasNames.length;
      continue;
    }

    let canonicalEntry = isRecord(categoryData[canonicalName]) ? deepClone(categoryData[canonicalName]) : null;

    for (const aliasName of aliasNames) {
      const aliasEntry = categoryData[aliasName];
      if (!isRecord(aliasEntry)) {
        missingCount += 1;
        continue;
      }

      if (canonicalEntry === null) {
        canonicalEntry = deepClone(aliasEntry);
      } else if (mode === 'replace') {
        canonicalEntry = deepClone(aliasEntry);
      } else if (mode === 'append') {
        canonicalEntry = buildFallbackMergedEntry(canonicalEntry, aliasEntry);
      }

      const mergedKeywords = mergeKeywords(canonicalEntry['关键词'] ?? canonicalEntry.keywords, [aliasName]);
      if (mergedKeywords.length > 0) {
        canonicalEntry['关键词'] = mergedKeywords;
      }

      categoryData[canonicalName] = deepClone(canonicalEntry);

      if (!keepAliases) {
        delete categoryData[aliasName];
      }

      mergedCount += 1;
      merged.push({
        category,
        canonicalName,
        alias: aliasName,
      });
    }
  }

  return {
    worldbook: resultWorldbook,
    mergedCount,
    missingCount,
    merged,
  };
}

export function consolidateWorldbookCategories(
  options: ConsolidateWorldbookCategoriesOptions,
): ConsolidateWorldbookCategoriesResult {
  const resultWorldbook = normalizeWorldbookData(options.worldbook);
  const mode = options.mode ?? 'append';
  const removeSourceCategory = options.removeSourceCategory ?? true;
  let movedCount = 0;
  let conflictCount = 0;
  const moved: ConsolidateWorldbookCategoriesResult['moved'] = [];

  for (const rule of options.rules) {
    const sourceCategory = rule.sourceCategory.trim();
    const targetCategory = rule.targetCategory.trim();

    if (!sourceCategory || !targetCategory || sourceCategory === targetCategory) {
      continue;
    }

    const sourceData = resultWorldbook[sourceCategory];
    if (!sourceData) {
      continue;
    }

    const targetData = ensureCategoryContainer(resultWorldbook, targetCategory);

    for (const [entryName, sourceEntry] of Object.entries(sourceData)) {
      if (!targetData[entryName]) {
        targetData[entryName] = deepClone(sourceEntry);
        movedCount += 1;
        moved.push({ sourceCategory, targetCategory, entryName });
        continue;
      }

      conflictCount += 1;

      if (mode === 'replace') {
        targetData[entryName] = deepClone(sourceEntry);
        movedCount += 1;
        moved.push({ sourceCategory, targetCategory, entryName });
        continue;
      }

      if (mode === 'rename') {
        const renamedTo = resolveRenamedEntryName(targetData, entryName);
        targetData[renamedTo] = deepClone(sourceEntry);
        movedCount += 1;
        moved.push({ sourceCategory, targetCategory, entryName, renamedTo });
        continue;
      }

      if (mode === 'append') {
        targetData[entryName] = buildFallbackMergedEntry(targetData[entryName], sourceEntry);
        movedCount += 1;
        moved.push({ sourceCategory, targetCategory, entryName });
        continue;
      }

      movedCount += 1;
      moved.push({ sourceCategory, targetCategory, entryName });
    }

    if (removeSourceCategory) {
      delete resultWorldbook[sourceCategory];
    }
  }

  return {
    worldbook: resultWorldbook,
    movedCount,
    conflictCount,
    moved,
  };
}

function buildLanguagePrefix(settings: NovelWorldbookSettings): string {
  return settings.language === 'zh' ? '请用中文回复。\n\n' : '';
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

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    candidates.push(trimmed.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // continue
    }
  }

  return null;
}

function findFirstEntryObject(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (isRecord(item)) {
        if (looksLikeEntryObject(item)) {
          return item;
        }

        const nested = findFirstEntryObject(item);
        if (nested) {
          return nested;
        }
      }
    }
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  if (looksLikeEntryObject(payload)) {
    return payload;
  }

  for (const value of Object.values(payload)) {
    const nested = findFirstEntryObject(value);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function buildFallbackMergedEntry(entryA: StructuredWorldbookEntry, entryB: StructuredWorldbookEntry): StructuredWorldbookEntry {
  const keywords = mergeKeywords(entryA['关键词'] ?? entryA.keywords, entryB['关键词'] ?? entryB.keywords);
  const content = mergeContent(
    pickEntryContent(entryA),
    pickEntryContent(entryB),
  );

  return {
    ...deepClone(entryA),
    ...deepClone(entryB),
    关键词: keywords,
    内容: content,
  };
}

function parseMergedEntryFromResponse(responseText: string): StructuredWorldbookEntry | null {
  const payload = extractJsonPayload(responseText);
  if (payload === null) {
    return null;
  }

  const entry = findFirstEntryObject(payload);
  if (!entry) {
    return null;
  }

  const normalized = normalizeStructuredEntry(entry);
  if (!normalized['内容'] && !normalized['关键词']) {
    return null;
  }

  return normalized;
}

export async function mergeEntriesWithAI(options: MergeEntriesWithAIOptions): Promise<MergeEntriesWithAIResult> {
  const customPrompt = options.customPrompt?.trim() || options.settings.customMergePrompt.trim();
  const promptTemplate = customPrompt || DEFAULT_MERGE_PROMPT;

  const prompt = promptTemplate
    .replace('{ENTRY_A}', JSON.stringify(options.entryA, null, 2))
    .replace('{ENTRY_B}', JSON.stringify(options.entryB, null, 2));

  const response = await callAPI(`${buildLanguagePrefix(options.settings)}${prompt}`, options.settings, {
    timeoutMs: options.settings.apiTimeout,
    signal: options.signal,
    requestId: options.requestId,
  });

  const parsedEntry = parseMergedEntryFromResponse(response.text);

  return {
    entry: parsedEntry ?? buildFallbackMergedEntry(options.entryA, options.entryB),
    prompt,
    responseText: response.text,
    outputTokens: response.outputTokens,
    raw: response.raw,
  };
}

function ensureCategoryContainer(worldbook: StructuredWorldbookData, category: string): StructuredWorldbookCategory {
  if (!worldbook[category]) {
    worldbook[category] = {};
  }
  return worldbook[category];
}

function resolveRenamedEntryName(categoryData: StructuredWorldbookCategory, baseName: string): string {
  let nextName = `${baseName}_2`;
  let counter = 2;

  while (categoryData[nextName]) {
    counter += 1;
    nextName = `${baseName}_${counter}`;
  }

  return nextName;
}

export async function performWorldbookMerge(options: PerformWorldbookMergeOptions): Promise<PerformWorldbookMergeResult> {
  const mode = options.mode;
  const resultWorldbook = normalizeWorldbookData(options.existingWorldbook);
  const normalizedImported = normalizeWorldbookData(options.importedWorldbook);

  const duplicates = findDuplicateEntries(resultWorldbook, normalizedImported);
  const newEntries = findNewEntries(resultWorldbook, normalizedImported);

  for (const item of newEntries) {
    ensureCategoryContainer(resultWorldbook, item.category)[item.name] = deepClone(item.entry);
  }

  let processedDuplicates = 0;
  const failedDuplicates: Array<{ duplicate: WorldbookDuplicateEntry; error: string }> = [];

  if (duplicates.length === 0) {
    return {
      worldbook: resultWorldbook,
      duplicates,
      newEntries,
      processedDuplicates,
      failedDuplicates,
    };
  }

  if (mode === 'ai') {
    if (!options.settings) {
      throw new Error('AI 合并模式需要提供 worldbook settings');
    }

    const settings = options.settings;
    const concurrency = Math.max(1, Math.trunc(options.concurrency ?? 3));
    const semaphore = new Semaphore(concurrency);

    const processOne = async (duplicate: WorldbookDuplicateEntry, index: number) => {
      await semaphore.acquire(options.signal);
      try {
        if (options.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }

        const merged = await mergeEntriesWithAI({
          entryA: duplicate.existing,
          entryB: duplicate.imported,
          settings,
          customPrompt: options.customPrompt,
          signal: options.signal,
          requestId: `merge-${duplicate.category}-${duplicate.name}-${index + 1}`,
        });

        ensureCategoryContainer(resultWorldbook, duplicate.category)[duplicate.name] = merged.entry;
        processedDuplicates += 1;
      } catch (error) {
        failedDuplicates.push({
          duplicate,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        semaphore.release();
      }
    };

    await Promise.allSettled(duplicates.map((duplicate, index) => processOne(duplicate, index)));

    return {
      worldbook: resultWorldbook,
      duplicates,
      newEntries,
      processedDuplicates,
      failedDuplicates,
    };
  }

  for (const duplicate of duplicates) {
    const categoryData = ensureCategoryContainer(resultWorldbook, duplicate.category);

    if (mode === 'replace') {
      categoryData[duplicate.name] = deepClone(duplicate.imported);
      processedDuplicates += 1;
      continue;
    }

    if (mode === 'keep') {
      processedDuplicates += 1;
      continue;
    }

    if (mode === 'rename') {
      const renamed = resolveRenamedEntryName(categoryData, duplicate.name);
      categoryData[renamed] = deepClone(duplicate.imported);
      processedDuplicates += 1;
      continue;
    }

    if (mode === 'append') {
      categoryData[duplicate.name] = buildFallbackMergedEntry(duplicate.existing, duplicate.imported);
      processedDuplicates += 1;
      continue;
    }
  }

  return {
    worldbook: resultWorldbook,
    duplicates,
    newEntries,
    processedDuplicates,
    failedDuplicates,
  };
}
