import type { NovelLLMConfigPreset, NovelWorldbookSettings } from '../types';

export type LLMPresetRouteSettings = Pick<
  NovelWorldbookSettings,
  'useTavernApi' | 'apiTimeout' | 'customApiProvider' | 'customApiEndpoint' | 'customApiModel' | 'customApiKey'
>;

const DEFAULT_PRESET_NAME = '未命名配置';

function normalizeOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTimeout(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Math.max(1000, Math.trunc(fallback));
  }

  return Math.max(1000, Math.trunc(value));
}

export function createLLMPresetId(now: number = Date.now()): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `llm-preset-${now}-${random}`;
}

export function normalizeLLMPresetName(name: string): string {
  const normalized = normalizeOptionalString(name);
  return normalized || DEFAULT_PRESET_NAME;
}

export function ensureUniqueLLMPresetName(
  name: string,
  presets: ReadonlyArray<Pick<NovelLLMConfigPreset, 'id' | 'name'>>,
  excludeId: string | null = null,
): string {
  const baseName = normalizeLLMPresetName(name);
  const normalizedExcludeId = normalizeOptionalString(excludeId ?? '');

  const normalizedExistingNames = new Set(
    presets
      .filter(item => normalizeOptionalString(item.id) !== normalizedExcludeId)
      .map(item => normalizeOptionalString(item.name).toLowerCase())
      .filter(Boolean),
  );

  if (!normalizedExistingNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let suffix = 2;
  while (suffix < 1000) {
    const candidate = `${baseName} (${suffix})`;
    if (!normalizedExistingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
    suffix += 1;
  }

  return `${baseName} (${Date.now()})`;
}

export function captureLLMPresetFromWorldbookSettings(
  settings: LLMPresetRouteSettings,
  options: {
    id?: string;
    name?: string;
    now?: string;
  } = {},
): NovelLLMConfigPreset {
  const now = normalizeOptionalString(options.now) || new Date().toISOString();
  const normalizedId = normalizeOptionalString(options.id) || createLLMPresetId();

  return {
    id: normalizedId,
    name: normalizeLLMPresetName(options.name ?? ''),
    useTavernApi: settings.useTavernApi === true,
    apiTimeout: normalizeTimeout(settings.apiTimeout, 120000),
    customApiProvider: normalizeOptionalString(settings.customApiProvider) || 'gemini',
    customApiEndpoint: normalizeOptionalString(settings.customApiEndpoint),
    customApiModel: normalizeOptionalString(settings.customApiModel) || 'gemini-2.5-flash',
    customApiKey: normalizeOptionalString(settings.customApiKey),
    createdAt: now,
    updatedAt: now,
  };
}

export function applyLLMPresetToWorldbookSettings(
  preset: Pick<
    NovelLLMConfigPreset,
    'useTavernApi' | 'apiTimeout' | 'customApiProvider' | 'customApiEndpoint' | 'customApiModel' | 'customApiKey'
  >,
): LLMPresetRouteSettings {
  return {
    useTavernApi: preset.useTavernApi === true,
    apiTimeout: normalizeTimeout(preset.apiTimeout, 120000),
    customApiProvider: normalizeOptionalString(preset.customApiProvider) || 'gemini',
    customApiEndpoint: normalizeOptionalString(preset.customApiEndpoint),
    customApiModel: normalizeOptionalString(preset.customApiModel) || 'gemini-2.5-flash',
    customApiKey: normalizeOptionalString(preset.customApiKey),
  };
}

export function upsertLLMPreset(
  presets: ReadonlyArray<NovelLLMConfigPreset>,
  preset: NovelLLMConfigPreset,
): NovelLLMConfigPreset[] {
  const normalizedId = normalizeOptionalString(preset.id);
  if (!normalizedId) {
    return [...presets];
  }

  const nextPreset: NovelLLMConfigPreset = {
    ...preset,
    id: normalizedId,
  };

  const existingIndex = presets.findIndex(item => normalizeOptionalString(item.id) === normalizedId);
  if (existingIndex < 0) {
    return [...presets, nextPreset];
  }

  const next = [...presets];
  next[existingIndex] = nextPreset;
  return next;
}

export function removeLLMPreset(presets: ReadonlyArray<NovelLLMConfigPreset>, presetId: string): NovelLLMConfigPreset[] {
  const normalizedId = normalizeOptionalString(presetId);
  if (!normalizedId) {
    return [...presets];
  }

  return presets.filter(item => normalizeOptionalString(item.id) !== normalizedId);
}
