import type { NovelWorldbookSettings, WorldbookEntryConfig } from '../../types';
import type { WorldbookEntry } from '../../types/worldbook';
import {
  findDuplicateEntries,
  findNewEntries,
  mergeWorldbookAliases,
  normalizeWorldbookData,
  performWorldbookMerge,
  type StructuredWorldbookCategory,
  type StructuredWorldbookData,
  type StructuredWorldbookEntry,
  type WorldbookAliasMergeGroup,
  type WorldbookAliasMergeMode,
  type WorldbookDuplicateEntry,
  type WorldbookMergeMode,
  type WorldbookNewEntry,
} from './merge.service';
import { getCategoryLightState } from './category.service';
import {
  buildEntryConfigKey,
  getCategoryAutoIncrement,
  getCategoryBaseOrder,
  resolveEntryConfig,
} from './entry-config.service';

function isPlainObject(value: unknown): value is Record<string, unknown> {
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

function toIntOrUndefined(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

function extractStructuredKeywords(entry: StructuredWorldbookEntry): string[] {
  const keywords = normalizeStringList(entry['关键词'] ?? entry.keywords ?? entry.key ?? entry.keys);
  return Array.from(new Set(keywords));
}

function extractStructuredContent(entry: StructuredWorldbookEntry): string {
  const contentRaw = entry['内容'] ?? entry.content;
  return typeof contentRaw === 'string' ? contentRaw.trim() : '';
}

function ensureCategory(worldbook: StructuredWorldbookData, category: string): StructuredWorldbookCategory {
  if (!worldbook[category]) {
    worldbook[category] = {};
  }
  return worldbook[category];
}

function countStructuredEntries(worldbook: StructuredWorldbookData): number {
  return Object.values(worldbook).reduce((sum, categoryEntries) => {
    return sum + Object.keys(categoryEntries).length;
  }, 0);
}

function resolveCategoryAndNameFromStEntry(raw: Record<string, unknown>, index: number): { category: string; name: string } {
  let category = '未分类';
  let name = '';

  if (typeof raw.comment === 'string' && raw.comment.trim()) {
    const comment = raw.comment.trim();
    const parts = comment.split(' - ');
    if (parts.length >= 2) {
      category = parts[0]?.trim() || category;
      name = parts.slice(1).join(' - ').trim();
    } else {
      name = comment;
    }
  }

  if (category === '未分类' && typeof raw.group === 'string' && raw.group.trim()) {
    const normalizedGroup = raw.group.trim();
    const separatorIndex = normalizedGroup.indexOf('_');
    category = separatorIndex > 0 ? normalizedGroup.slice(0, separatorIndex).trim() || category : normalizedGroup;
  }

  if (!name && typeof raw.name === 'string' && raw.name.trim()) {
    name = raw.name.trim();
  }

  if (!name && typeof raw.uid === 'number' && Number.isFinite(raw.uid)) {
    name = `条目_${Math.trunc(raw.uid)}`;
  }

  if (!name) {
    name = `条目_${index + 1}`;
  }

  return {
    category: category.trim() || '未分类',
    name: name.trim() || `条目_${index + 1}`,
  };
}

function buildStructuredEntryFromSt(raw: Record<string, unknown>, fallbackName: string): StructuredWorldbookEntry {
  const keywords = normalizeStringList(raw.key ?? raw.keys ?? raw.keywords ?? raw['关键词']);
  const normalizedKeywords = Array.from(new Set(keywords.map((item) => item.trim()).filter(Boolean)));
  const content = typeof raw.content === 'string' ? raw.content.trim() : typeof raw['内容'] === 'string' ? raw['内容'].trim() : '';

  return {
    关键词: normalizedKeywords.length > 0 ? normalizedKeywords : [fallbackName],
    内容: content,
  };
}

function extractImportedEntryMeta(raw: Record<string, unknown>): ImportedEntryMeta {
  const meta: ImportedEntryMeta = {
    position: toIntOrUndefined(raw.position),
    depth: toIntOrUndefined(raw.depth),
    order: toIntOrUndefined(raw.order),
    disable: typeof raw.disable === 'boolean' ? raw.disable : undefined,
  };

  return meta;
}

function hasMeta(meta: ImportedEntryMeta): boolean {
  return meta.position !== undefined || meta.depth !== undefined || meta.order !== undefined || meta.disable !== undefined;
}

export type SillyTavernWorldbookEntry = {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  selectiveLogic: number;
  addMemo: boolean;
  order: number;
  position: number;
  disable: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  delayUntilRecursion: boolean;
  probability: number;
  depth: number;
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  useGroupScoring: boolean | null;
  scanDepth: number | null;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  automationId: string;
  role: number;
  vectorized: boolean;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
};

export type SillyTavernWorldbookFile = {
  entries: SillyTavernWorldbookEntry[];
  originalData: {
    name: string;
    description: string;
    version: number;
    author: string;
  };
};

export type ConvertEntriesToSillyTavernOptions = {
  entries: ReadonlyArray<WorldbookEntry>;
  settings: Pick<NovelWorldbookSettings, 'allowRecursion' | 'categoryLightSettings' | 'entryPositionConfig' | 'categoryDefaultConfig'>;
  metadata?: {
    name?: string;
    description?: string;
    version?: number;
    author?: string;
  };
};

export type ImportedEntryMeta = {
  position?: number;
  depth?: number;
  order?: number;
  disable?: boolean;
};

export type ParsedWorldbookImport = {
  sourceFormat: 'sillytavern' | 'internal';
  worldbook: StructuredWorldbookData;
  internalDuplicates: WorldbookDuplicateEntry[];
  entryMeta: Record<string, ImportedEntryMeta>;
  totalEntries: number;
};

export type BuildWorldbookImportPreviewOptions = {
  existingWorldbook: StructuredWorldbookData;
  imported: ParsedWorldbookImport;
};

export type WorldbookImportPreview = {
  sourceFormat: 'sillytavern' | 'internal';
  totalEntries: number;
  newEntries: WorldbookNewEntry[];
  duplicatesWithExisting: WorldbookDuplicateEntry[];
  internalDuplicates: WorldbookDuplicateEntry[];
  allDuplicates: WorldbookDuplicateEntry[];
};

export type WorldbookImportAliasMergeOptions = {
  groups: WorldbookAliasMergeGroup[];
  mode?: WorldbookAliasMergeMode;
  keepAliases?: boolean;
};

export type WorldbookImportAliasMergeSummary = {
  applied: boolean;
  groups: number;
  mergedCount: number;
  missingCount: number;
};

export type PerformWorldbookImportMergeOptions = {
  existingWorldbook: StructuredWorldbookData;
  imported: ParsedWorldbookImport;
  mode: WorldbookMergeMode;
  customPrompt?: string;
  concurrency?: number;
  settings?: NovelWorldbookSettings;
  signal?: AbortSignal;
  aliasMerge?: WorldbookImportAliasMergeOptions;
};

export type PerformWorldbookImportMergeResult = {
  worldbook: StructuredWorldbookData;
  newEntries: WorldbookNewEntry[];
  duplicatesWithExisting: WorldbookDuplicateEntry[];
  internalDuplicates: WorldbookDuplicateEntry[];
  allDuplicates: WorldbookDuplicateEntry[];
  processedDuplicates: number;
  failedDuplicates: Array<{ duplicate: WorldbookDuplicateEntry; error: string }>;
  aliasMerge: WorldbookImportAliasMergeSummary;
};

export type ConvertStructuredWorldbookToEntriesOptions = {
  worldbook: StructuredWorldbookData;
  existingEntries?: ReadonlyArray<WorldbookEntry>;
  entryMeta?: Record<string, ImportedEntryMeta>;
  settings?: Pick<NovelWorldbookSettings, 'entryPositionConfig' | 'categoryDefaultConfig'>;
  idPrefix?: string;
};

export function buildStructuredWorldbookFromEntries(entries: ReadonlyArray<WorldbookEntry>): StructuredWorldbookData {
  const structured: StructuredWorldbookData = {};

  for (const entry of entries) {
    const category = entry.category.trim() || '未分类';
    const name = entry.name.trim() || '未命名条目';
    ensureCategory(structured, category)[name] = {
      关键词: Array.from(new Set(entry.keywords.map((keyword) => keyword.trim()).filter(Boolean))),
      内容: entry.content,
    };
  }

  return structured;
}

export function convertEntriesToSillyTavernFormat(options: ConvertEntriesToSillyTavernOptions): SillyTavernWorldbookFile {
  const entries: SillyTavernWorldbookEntry[] = [];
  const categoryOrderCursor = new Map<string, number>();

  for (const [index, entry] of options.entries.entries()) {
    const category = entry.category.trim() || '未分类';
    const name = entry.name.trim() || `条目_${index + 1}`;

    const resolvedConfig = resolveEntryConfig({
      category,
      entryName: name,
      fallback: {
        position: entry.position,
        depth: entry.depth,
        order: entry.order,
      } as WorldbookEntryConfig,
      entryPositionConfig: options.settings.entryPositionConfig,
      categoryDefaultConfig: options.settings.categoryDefaultConfig,
    });

    const autoIncrement = getCategoryAutoIncrement(category, options.settings.categoryDefaultConfig);
    const baseOrder = getCategoryBaseOrder(category, options.settings.categoryDefaultConfig);
    const currentCategoryCursor = categoryOrderCursor.get(category) ?? 0;

    const actualOrder = autoIncrement ? baseOrder + currentCategoryCursor : resolvedConfig.order;
    if (autoIncrement) {
      categoryOrderCursor.set(category, currentCategoryCursor + 1);
    }

    const keywords = Array.from(new Set(entry.keywords.map((keyword) => keyword.trim()).filter(Boolean)));
    const normalizedKeywords = keywords.length > 0 ? keywords : [name];
    const isGreenLight = getCategoryLightState(category, options.settings.categoryLightSettings);

    entries.push({
      uid: index,
      key: normalizedKeywords,
      keysecondary: [],
      comment: `${category} - ${name}`,
      content: entry.content.trim(),
      constant: !isGreenLight,
      selective: isGreenLight,
      selectiveLogic: 0,
      addMemo: true,
      order: actualOrder,
      position: entry.position ?? resolvedConfig.position,
      disable: entry.disable ?? false,
      excludeRecursion: !options.settings.allowRecursion,
      preventRecursion: !options.settings.allowRecursion,
      delayUntilRecursion: false,
      probability: 100,
      depth: entry.depth ?? resolvedConfig.depth,
      group: `${category}_${name}`,
      groupOverride: false,
      groupWeight: 100,
      useGroupScoring: null,
      scanDepth: null,
      caseSensitive: false,
      matchWholeWords: false,
      automationId: '',
      role: 0,
      vectorized: false,
      sticky: null,
      cooldown: null,
      delay: null,
    });
  }

  return {
    entries,
    originalData: {
      name: options.metadata?.name ?? 'NovelToST 导出世界书',
      description: options.metadata?.description ?? '由 NovelToST 导出为 SillyTavern 世界书格式',
      version: options.metadata?.version ?? 1,
      author: options.metadata?.author ?? 'NovelToST',
    },
  };
}

export function parseWorldbookImport(rawText: string): ParsedWorldbookImport {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`导入文件 JSON 解析失败：${message}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error('导入文件格式无效：根节点必须是对象');
  }

  if ('entries' in parsed) {
    const entriesRaw = parsed.entries;
    const entriesArray = Array.isArray(entriesRaw)
      ? entriesRaw
      : isPlainObject(entriesRaw)
        ? Object.values(entriesRaw)
        : [];

    const worldbook: StructuredWorldbookData = {};
    const internalDuplicates: WorldbookDuplicateEntry[] = [];
    const entryMeta: Record<string, ImportedEntryMeta> = {};

    entriesArray.forEach((item, index) => {
      if (!isPlainObject(item)) {
        return;
      }

      const { category, name } = resolveCategoryAndNameFromStEntry(item, index);
      const structuredEntry = buildStructuredEntryFromSt(item, name);
      const categoryData = ensureCategory(worldbook, category);

      const key = buildEntryConfigKey(category, name);
      const meta = extractImportedEntryMeta(item);

      if (categoryData[name]) {
        internalDuplicates.push({
          category,
          name,
          existing: categoryData[name],
          imported: structuredEntry,
        });
        return;
      }

      categoryData[name] = structuredEntry;
      if (hasMeta(meta)) {
        entryMeta[key] = meta;
      }
    });

    return {
      sourceFormat: 'sillytavern',
      worldbook,
      internalDuplicates,
      entryMeta,
      totalEntries: entriesArray.length,
    };
  }

  const sourceWorldbook = isPlainObject(parsed.merged) ? parsed.merged : parsed;
  const normalized = normalizeWorldbookData(sourceWorldbook);

  return {
    sourceFormat: 'internal',
    worldbook: normalized,
    internalDuplicates: [],
    entryMeta: {},
    totalEntries: countStructuredEntries(normalized),
  };
}

export function buildWorldbookImportPreview(options: BuildWorldbookImportPreviewOptions): WorldbookImportPreview {
  const normalizedExisting = normalizeWorldbookData(options.existingWorldbook);
  const duplicatesWithExisting = findDuplicateEntries(normalizedExisting, options.imported.worldbook);
  const newEntries = findNewEntries(normalizedExisting, options.imported.worldbook);
  const allDuplicates = [...options.imported.internalDuplicates, ...duplicatesWithExisting];

  return {
    sourceFormat: options.imported.sourceFormat,
    totalEntries: options.imported.totalEntries,
    newEntries,
    duplicatesWithExisting,
    internalDuplicates: options.imported.internalDuplicates,
    allDuplicates,
  };
}

export async function performWorldbookImportMerge(
  options: PerformWorldbookImportMergeOptions,
): Promise<PerformWorldbookImportMergeResult> {
  const primary = await performWorldbookMerge({
    existingWorldbook: options.existingWorldbook,
    importedWorldbook: options.imported.worldbook,
    mode: options.mode,
    customPrompt: options.customPrompt,
    concurrency: options.concurrency,
    settings: options.settings,
    signal: options.signal,
  });

  let mergedWorldbook = primary.worldbook;
  let processedDuplicates = primary.processedDuplicates;
  const failedDuplicates = [...primary.failedDuplicates];

  for (const duplicate of options.imported.internalDuplicates) {
    const oneByOneWorldbook: StructuredWorldbookData = {
      [duplicate.category]: {
        [duplicate.name]: duplicate.imported,
      },
    };

    const oneByOneResult = await performWorldbookMerge({
      existingWorldbook: mergedWorldbook,
      importedWorldbook: oneByOneWorldbook,
      mode: options.mode,
      customPrompt: options.customPrompt,
      concurrency: options.concurrency,
      settings: options.settings,
      signal: options.signal,
    });

    mergedWorldbook = oneByOneResult.worldbook;
    processedDuplicates += oneByOneResult.processedDuplicates;
    failedDuplicates.push(...oneByOneResult.failedDuplicates);
  }

  const allDuplicates = [...options.imported.internalDuplicates, ...primary.duplicates];

  let aliasMerge: WorldbookImportAliasMergeSummary = {
    applied: false,
    groups: 0,
    mergedCount: 0,
    missingCount: 0,
  };

  if (options.aliasMerge && options.aliasMerge.groups.length > 0) {
    const aliasResult = mergeWorldbookAliases({
      worldbook: mergedWorldbook,
      groups: options.aliasMerge.groups,
      mode: options.aliasMerge.mode,
      keepAliases: options.aliasMerge.keepAliases,
    });

    mergedWorldbook = aliasResult.worldbook;
    aliasMerge = {
      applied: true,
      groups: options.aliasMerge.groups.length,
      mergedCount: aliasResult.mergedCount,
      missingCount: aliasResult.missingCount,
    };
  }

  return {
    worldbook: mergedWorldbook,
    newEntries: primary.newEntries,
    duplicatesWithExisting: primary.duplicates,
    internalDuplicates: options.imported.internalDuplicates,
    allDuplicates,
    processedDuplicates,
    failedDuplicates,
    aliasMerge,
  };
}

export function convertStructuredWorldbookToEntries(options: ConvertStructuredWorldbookToEntriesOptions): WorldbookEntry[] {
  const existingMap = new Map<string, WorldbookEntry>();
  for (const entry of options.existingEntries ?? []) {
    existingMap.set(buildEntryConfigKey(entry.category, entry.name), entry);
  }

  const idPrefix = options.idPrefix ?? `import-${Date.now()}`;
  let createdIdCursor = 1;

  const result: WorldbookEntry[] = [];

  for (const [categoryName, categoryEntries] of Object.entries(options.worldbook)) {
    const category = categoryName.trim() || '未分类';
    if (!isPlainObject(categoryEntries)) {
      continue;
    }

    for (const [entryNameRaw, rawEntry] of Object.entries(categoryEntries)) {
      const entryName = entryNameRaw.trim();
      if (!entryName || !isPlainObject(rawEntry)) {
        continue;
      }

      const key = buildEntryConfigKey(category, entryName);
      const existing = existingMap.get(key);
      const meta = options.entryMeta?.[key];

      const keywords = extractStructuredKeywords(rawEntry);
      const content = extractStructuredContent(rawEntry);
      if (!content && keywords.length === 0) {
        continue;
      }

      const resolvedConfig = resolveEntryConfig({
        category,
        entryName,
        fallback: {
          position: existing?.position ?? meta?.position,
          depth: existing?.depth ?? meta?.depth,
          order: existing?.order ?? meta?.order,
        },
        entryPositionConfig: options.settings?.entryPositionConfig,
        categoryDefaultConfig: options.settings?.categoryDefaultConfig,
      });

      result.push({
        id: existing?.id ?? `${idPrefix}-${createdIdCursor++}`,
        category,
        name: entryName,
        keywords,
        content,
        position: existing?.position ?? meta?.position ?? resolvedConfig.position,
        depth: existing?.depth ?? meta?.depth ?? resolvedConfig.depth,
        order: existing?.order ?? meta?.order ?? resolvedConfig.order,
        disable: existing?.disable ?? meta?.disable,
        sourceChunkIds: existing ? [...existing.sourceChunkIds] : [],
      });
    }
  }

  return result;
}
