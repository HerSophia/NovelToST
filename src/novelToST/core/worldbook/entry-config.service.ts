import type { NovelWorldbookSettings, WorldbookEntryConfig } from '../../types';
import type { WorldbookEntry } from '../../types/worldbook';
import type { WorldbookCategoryDefinition } from './category.service';

export const ENTRY_CONFIG_KEY_SEPARATOR = '::';

export type ResolvedWorldbookEntryConfig = {
  position: number;
  depth: number;
  order: number;
  autoIncrementOrder: boolean;
};

export type WorldbookDefaultEntryUI = {
  category: string;
  name: string;
  keywords: string[];
  content: string;
  position?: number;
  depth?: number;
  order?: number;
  disable?: boolean;
};

export type ResolveEntryConfigOptions = {
  category: string;
  entryName: string;
  fallback?: WorldbookEntryConfig;
  entryPositionConfig?: Record<string, WorldbookEntryConfig>;
  categoryDefaultConfig?: Record<string, WorldbookEntryConfig>;
  categoryDefinitions?: ReadonlyArray<WorldbookCategoryDefinition>;
};

export type ApplyDefaultWorldbookEntriesOptions = {
  settings: Pick<NovelWorldbookSettings, 'defaultWorldbookEntriesUI' | 'defaultWorldbookEntries'>;
  baseEntries?: WorldbookEntry[];
  entryPositionConfig?: Record<string, WorldbookEntryConfig>;
};

export type ApplyDefaultWorldbookEntriesResult = {
  entries: WorldbookEntry[];
  appliedCount: number;
  source: 'ui' | 'legacy' | 'none';
  nextEntryPositionConfig: Record<string, WorldbookEntryConfig>;
};

export const DEFAULT_ENTRY_CONFIG: ResolvedWorldbookEntryConfig = {
  position: 0,
  depth: 4,
  order: 100,
  autoIncrementOrder: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

function normalizeStringArray(value: unknown): string[] {
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

function sanitizePartialConfig(value: unknown): WorldbookEntryConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const position = toInteger(value.position);
  const depth = toInteger(value.depth);
  const order = toInteger(value.order);
  const autoIncrementOrder = typeof value.autoIncrementOrder === 'boolean' ? value.autoIncrementOrder : undefined;

  if (position === undefined && depth === undefined && order === undefined && autoIncrementOrder === undefined) {
    return null;
  }

  return {
    position,
    depth,
    order,
    autoIncrementOrder,
  };
}

function mergeResolvedConfig(
  base: ResolvedWorldbookEntryConfig,
  partial: WorldbookEntryConfig | undefined,
): ResolvedWorldbookEntryConfig {
  if (!partial) {
    return base;
  }

  return {
    position: partial.position !== undefined ? Math.trunc(partial.position) : base.position,
    depth: partial.depth !== undefined ? Math.max(0, Math.trunc(partial.depth)) : base.depth,
    order: partial.order !== undefined ? Math.trunc(partial.order) : base.order,
    autoIncrementOrder: partial.autoIncrementOrder !== undefined ? Boolean(partial.autoIncrementOrder) : base.autoIncrementOrder,
  };
}

export function buildEntryConfigKey(category: string, entryName: string): string {
  return `${category.trim()}${ENTRY_CONFIG_KEY_SEPARATOR}${entryName.trim()}`;
}

export function parseEntryConfigKey(key: string): { category: string; entryName: string } | null {
  const separatorIndex = key.indexOf(ENTRY_CONFIG_KEY_SEPARATOR);
  if (separatorIndex <= 0) {
    return null;
  }

  const category = key.slice(0, separatorIndex).trim();
  const entryName = key.slice(separatorIndex + ENTRY_CONFIG_KEY_SEPARATOR.length).trim();
  if (!category || !entryName) {
    return null;
  }

  return {
    category,
    entryName,
  };
}

export function normalizeEntryConfigMap(raw: Record<string, WorldbookEntryConfig> | null | undefined): Record<string, WorldbookEntryConfig> {
  if (!raw) {
    return {};
  }

  const result: Record<string, WorldbookEntryConfig> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!key.trim()) {
      continue;
    }

    const sanitized = sanitizePartialConfig(value);
    if (!sanitized) {
      continue;
    }

    result[key] = sanitized;
  }

  return result;
}

function getCategoryDefinition(category: string, categoryDefinitions: ReadonlyArray<WorldbookCategoryDefinition> | undefined): WorldbookCategoryDefinition | undefined {
  if (!categoryDefinitions) {
    return undefined;
  }
  const safeCategory = category.trim();
  return categoryDefinitions.find((item) => item.name === safeCategory);
}

export function resolveEntryConfig(options: ResolveEntryConfigOptions): ResolvedWorldbookEntryConfig {
  const safeCategory = options.category.trim();
  const safeEntryName = options.entryName.trim();
  const key = buildEntryConfigKey(safeCategory, safeEntryName);

  const normalizedEntryMap = normalizeEntryConfigMap(options.entryPositionConfig);
  const normalizedCategoryMap = normalizeEntryConfigMap(options.categoryDefaultConfig);

  const categoryDefinition = getCategoryDefinition(safeCategory, options.categoryDefinitions);

  const definitionConfig: WorldbookEntryConfig | undefined = categoryDefinition
    ? {
        position: categoryDefinition.defaultPosition,
        depth: categoryDefinition.defaultDepth,
        order: categoryDefinition.defaultOrder,
        autoIncrementOrder: categoryDefinition.autoIncrementOrder,
      }
    : undefined;

  const categoryConfig = normalizedCategoryMap[safeCategory];
  const entryConfig = normalizedEntryMap[key];

  let resolved = mergeResolvedConfig(DEFAULT_ENTRY_CONFIG, options.fallback);
  resolved = mergeResolvedConfig(resolved, definitionConfig);
  resolved = mergeResolvedConfig(resolved, categoryConfig);
  resolved = mergeResolvedConfig(resolved, entryConfig);

  return resolved;
}

export const getEntryConfig = resolveEntryConfig;

export function getCategoryAutoIncrement(
  category: string,
  categoryDefaultConfig: Record<string, WorldbookEntryConfig> | undefined,
  categoryDefinitions?: ReadonlyArray<WorldbookCategoryDefinition>,
): boolean {
  const safeCategory = category.trim();
  const normalizedCategoryMap = normalizeEntryConfigMap(categoryDefaultConfig);

  const categoryConfig = normalizedCategoryMap[safeCategory];
  if (categoryConfig?.autoIncrementOrder !== undefined) {
    return Boolean(categoryConfig.autoIncrementOrder);
  }

  const categoryDefinition = getCategoryDefinition(safeCategory, categoryDefinitions);
  if (categoryDefinition) {
    return Boolean(categoryDefinition.autoIncrementOrder);
  }

  return DEFAULT_ENTRY_CONFIG.autoIncrementOrder;
}

export function getCategoryBaseOrder(
  category: string,
  categoryDefaultConfig: Record<string, WorldbookEntryConfig> | undefined,
  categoryDefinitions?: ReadonlyArray<WorldbookCategoryDefinition>,
): number {
  const safeCategory = category.trim();
  const normalizedCategoryMap = normalizeEntryConfigMap(categoryDefaultConfig);

  const categoryConfig = normalizedCategoryMap[safeCategory];
  if (categoryConfig?.order !== undefined) {
    return Math.trunc(categoryConfig.order);
  }

  const categoryDefinition = getCategoryDefinition(safeCategory, categoryDefinitions);
  if (categoryDefinition) {
    return Math.trunc(categoryDefinition.defaultOrder);
  }

  return DEFAULT_ENTRY_CONFIG.order;
}

export function setEntryConfig(
  entryPositionConfig: Record<string, WorldbookEntryConfig> | undefined,
  category: string,
  entryName: string,
  config: WorldbookEntryConfig,
): Record<string, WorldbookEntryConfig> {
  const key = buildEntryConfigKey(category, entryName);
  const sanitized = sanitizePartialConfig(config);
  if (!sanitized) {
    return normalizeEntryConfigMap(entryPositionConfig);
  }

  return {
    ...normalizeEntryConfigMap(entryPositionConfig),
    [key]: sanitized,
  };
}

export function setCategoryDefaultConfig(
  categoryDefaultConfig: Record<string, WorldbookEntryConfig> | undefined,
  category: string,
  config: WorldbookEntryConfig,
): Record<string, WorldbookEntryConfig> {
  const safeCategory = category.trim();
  if (!safeCategory) {
    return normalizeEntryConfigMap(categoryDefaultConfig);
  }

  const sanitized = sanitizePartialConfig(config);
  if (!sanitized) {
    return normalizeEntryConfigMap(categoryDefaultConfig);
  }

  return {
    ...normalizeEntryConfigMap(categoryDefaultConfig),
    [safeCategory]: sanitized,
  };
}

export function renameEntryConfigKey(
  entryPositionConfig: Record<string, WorldbookEntryConfig> | undefined,
  category: string,
  oldEntryName: string,
  newEntryName: string,
): Record<string, WorldbookEntryConfig> {
  const normalized = normalizeEntryConfigMap(entryPositionConfig);

  const oldKey = buildEntryConfigKey(category, oldEntryName);
  const newKey = buildEntryConfigKey(category, newEntryName);

  if (!normalized[oldKey]) {
    return normalized;
  }

  const next = {
    ...normalized,
    [newKey]: normalized[oldKey],
  };

  delete next[oldKey];
  return next;
}

function normalizeOneDefaultEntry(raw: unknown): WorldbookDefaultEntryUI | null {
  if (!isRecord(raw)) {
    return null;
  }

  const category = typeof raw.category === 'string' ? raw.category.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';

  if (!category || !name) {
    return null;
  }

  const keywords = normalizeStringArray(raw.keywords ?? raw['关键词']);
  const content = typeof raw.content === 'string' ? raw.content : typeof raw['内容'] === 'string' ? raw['内容'] : '';

  const position = toInteger(raw.position);
  const depth = toInteger(raw.depth);
  const order = toInteger(raw.order);

  return {
    category,
    name,
    keywords,
    content,
    position,
    depth,
    order,
    disable: typeof raw.disable === 'boolean' ? raw.disable : undefined,
  };
}

export function normalizeDefaultWorldbookEntriesUI(rawEntries: unknown): WorldbookDefaultEntryUI[] {
  if (!Array.isArray(rawEntries)) {
    return [];
  }

  const result: WorldbookDefaultEntryUI[] = [];
  const seen = new Set<string>();

  for (const entry of rawEntries) {
    const normalized = normalizeOneDefaultEntry(entry);
    if (!normalized) {
      continue;
    }

    const key = buildEntryConfigKey(normalized.category, normalized.name);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

export function parseLegacyDefaultWorldbookEntries(rawJson: string): WorldbookDefaultEntryUI[] {
  const trimmed = rawJson.trim();
  if (!trimmed) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return [];
  }

  if (!isRecord(parsed)) {
    return [];
  }

  const result: WorldbookDefaultEntryUI[] = [];

  for (const [category, categoryData] of Object.entries(parsed)) {
    if (!isRecord(categoryData)) {
      continue;
    }

    for (const [entryName, entryData] of Object.entries(categoryData)) {
      if (!isRecord(entryData)) {
        continue;
      }

      const keywords = normalizeStringArray(entryData['关键词'] ?? entryData.keywords);
      const contentRaw = entryData['内容'] ?? entryData.content;
      const content = typeof contentRaw === 'string' ? contentRaw : '';

      result.push({
        category,
        name: entryName,
        keywords,
        content,
      });
    }
  }

  return result;
}

function buildDefaultEntry(entry: WorldbookDefaultEntryUI, index: number, previous?: WorldbookEntry): WorldbookEntry {
  const baseId = `default-entry-${index + 1}`;

  return {
    id: previous?.id ?? `${baseId}-${entry.category}-${entry.name}`,
    category: entry.category,
    name: entry.name,
    keywords: entry.keywords,
    content: entry.content,
    disable: entry.disable,
    position: entry.position,
    depth: entry.depth,
    order: entry.order,
    sourceChunkIds: previous?.sourceChunkIds ?? [],
  };
}

export function applyDefaultWorldbookEntries(options: ApplyDefaultWorldbookEntriesOptions): ApplyDefaultWorldbookEntriesResult {
  const baseEntries = options.baseEntries ? [...options.baseEntries] : [];
  const entriesMap = new Map<string, WorldbookEntry>();

  for (const entry of baseEntries) {
    entriesMap.set(buildEntryConfigKey(entry.category, entry.name), { ...entry });
  }

  let nextEntryPositionConfig = normalizeEntryConfigMap(options.entryPositionConfig);

  const normalizedUIEntries = normalizeDefaultWorldbookEntriesUI(options.settings.defaultWorldbookEntriesUI);

  let defaultEntries: WorldbookDefaultEntryUI[] = [];
  let source: ApplyDefaultWorldbookEntriesResult['source'] = 'none';

  if (normalizedUIEntries.length > 0) {
    defaultEntries = normalizedUIEntries;
    source = 'ui';
  } else if (options.settings.defaultWorldbookEntries.trim()) {
    defaultEntries = parseLegacyDefaultWorldbookEntries(options.settings.defaultWorldbookEntries);
    if (defaultEntries.length > 0) {
      source = 'legacy';
    }
  }

  defaultEntries.forEach((entry, index) => {
    const key = buildEntryConfigKey(entry.category, entry.name);
    const previous = entriesMap.get(key);
    entriesMap.set(key, buildDefaultEntry(entry, index, previous));

    if (entry.position !== undefined || entry.depth !== undefined || entry.order !== undefined) {
      nextEntryPositionConfig = setEntryConfig(nextEntryPositionConfig, entry.category, entry.name, {
        position: entry.position,
        depth: entry.depth,
        order: entry.order,
      });
    }
  });

  return {
    entries: Array.from(entriesMap.values()),
    appliedCount: defaultEntries.length,
    source,
    nextEntryPositionConfig,
  };
}
