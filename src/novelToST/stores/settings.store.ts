import _ from 'lodash';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { z } from 'zod';
import type { NovelSettings, NovelWorldbookSettings } from '../types';

export const WorldbookEntryConfigSchema = z.object({
  position: z.number().int().optional(),
  depth: z.number().int().optional(),
  order: z.number().int().optional(),
  autoIncrementOrder: z.boolean().optional(),
});

export const WorldbookSettingsSchema = z
  .object({
    chunkSize: z.number().int().min(1).default(15000),
    enablePlotOutline: z.boolean().default(false),
    enableLiteraryStyle: z.boolean().default(false),
    language: z.string().min(1).default('zh'),
    customWorldbookPrompt: z.string().default(''),
    customPlotPrompt: z.string().default(''),
    customStylePrompt: z.string().default(''),
    useVolumeMode: z.boolean().default(false),
    apiTimeout: z.number().int().min(1000).default(120000),
    parallelEnabled: z.boolean().default(true),
    parallelConcurrency: z.number().int().min(1).default(3),
    parallelMode: z.enum(['independent', 'batch']).default('independent'),
    useTavernApi: z.boolean().default(true),
    customMergePrompt: z.string().default(''),
    categoryLightSettings: z.record(z.string(), z.boolean()).nullable().default(null),
    defaultWorldbookEntries: z.string().default(''),
    customRerollPrompt: z.string().default(''),
    customApiProvider: z.string().min(1).default('gemini'),
    customApiKey: z.string().default(''),
    customApiEndpoint: z.string().default(''),
    customApiModel: z.string().default('gemini-2.5-flash'),
    forceChapterMarker: z.boolean().default(true),
    chapterRegexPattern: z.string().default('第[零一二三四五六七八九十百千万0-9]+[章回卷节部篇]'),
    useCustomChapterRegex: z.boolean().default(false),
    defaultWorldbookEntriesUI: z.array(z.unknown()).default([]),
    categoryDefaultConfig: z.record(z.string(), WorldbookEntryConfigSchema).default({}),
    entryPositionConfig: z.record(z.string(), WorldbookEntryConfigSchema).default({}),
    customSuffixPrompt: z.string().default(''),
    allowRecursion: z.boolean().default(false),
    filterResponseTags: z.string().default('thinking,/think'),
    debugMode: z.boolean().default(false),
  })
  .prefault({});

export const ScriptSettingsSchema = z
  .object({
    totalChapters: z.number().int().min(1).default(1000),
    currentChapter: z.number().int().min(0).default(0),
    prompt: z.string().min(1).default('继续推进剧情，保证剧情流畅自然，注意人物性格一致性'),

    autoSaveInterval: z.number().int().min(1).default(50),
    maxRetries: z.number().int().min(1).default(3),
    minChapterLength: z.number().int().min(0).default(100),

    exportAll: z.boolean().default(true),
    exportStartFloor: z.number().int().min(0).default(0),
    exportEndFloor: z.number().int().min(0).default(99999),
    exportIncludeUser: z.boolean().default(false),
    exportIncludeAI: z.boolean().default(true),

    extractMode: z.enum(['all', 'tags']).default('all'),
    extractTags: z.string().default(''),
    tagSeparator: z.string().default('\n\n'),

    replyWaitTime: z.number().int().min(0).default(5000),
    stabilityCheckInterval: z.number().int().min(200).default(1000),
    stabilityRequiredCount: z.number().int().min(1).default(3),
    enableSendToastDetection: z.boolean().default(true),
    sendToastWaitTimeout: z.number().int().min(1000).default(60000),
    sendPostToastWaitTime: z.number().int().min(0).default(1000),
    enableReplyToastDetection: z.boolean().default(true),
    replyToastWaitTimeout: z.number().int().min(1000).default(300000),
    replyPostToastWaitTime: z.number().int().min(0).default(2000),
    maxWaitForResponseStart: z.number().int().min(3000).default(120000),
    maxWaitForStable: z.number().int().min(5000).default(180000),
    retryBackoffMs: z.number().int().min(0).default(5000),

    reloadOnChatChange: z.boolean().default(false),
    persistDebounceMs: z.number().int().min(100).default(300),
    useRawContent: z.boolean().default(true),

    worldbook: WorldbookSettingsSchema,
  })
  .prefault({});

const LEGACY_WORLDBOOK_KEYS = [
  'chunkSize',
  'enablePlotOutline',
  'enableLiteraryStyle',
  'language',
  'customWorldbookPrompt',
  'customPlotPrompt',
  'customStylePrompt',
  'useVolumeMode',
  'apiTimeout',
  'parallelEnabled',
  'parallelConcurrency',
  'parallelMode',
  'useTavernApi',
  'customMergePrompt',
  'categoryLightSettings',
  'defaultWorldbookEntries',
  'customRerollPrompt',
  'customApiProvider',
  'customApiKey',
  'customApiEndpoint',
  'customApiModel',
  'forceChapterMarker',
  'chapterRegexPattern',
  'useCustomChapterRegex',
  'defaultWorldbookEntriesUI',
  'categoryDefaultConfig',
  'entryPositionConfig',
  'customSuffixPrompt',
  'allowRecursion',
  'filterResponseTags',
  'debugMode',
] as const satisfies ReadonlyArray<keyof NovelWorldbookSettings>;

const scriptVariableOption = {
  type: 'script' as const,
  script_id: getScriptId(),
};

function getDefaultSettings(): NovelSettings {
  return ScriptSettingsSchema.parse({});
}

function extractLegacyWorldbookSettings(raw: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = {};
  for (const key of LEGACY_WORLDBOOK_KEYS) {
    if (raw[key] !== undefined) {
      migrated[key] = raw[key];
    }
  }
  return migrated;
}

function normalizeRawSettings(raw: unknown): Record<string, unknown> {
  if (!_.isPlainObject(raw)) {
    return {};
  }

  const normalized = { ...(raw as Record<string, unknown>) };
  const legacyWorldbook = extractLegacyWorldbookSettings(normalized);
  const nestedWorldbook = _.isPlainObject(normalized.worldbook) ? (normalized.worldbook as Record<string, unknown>) : {};

  if (Object.keys(legacyWorldbook).length > 0 || Object.keys(nestedWorldbook).length > 0) {
    normalized.worldbook = {
      ...legacyWorldbook,
      ...nestedWorldbook,
    };
  }

  return normalized;
}

function readSettingsFromVariables(): NovelSettings {
  const raw = getVariables(scriptVariableOption);
  const merged = _.merge({}, getDefaultSettings(), normalizeRawSettings(raw));
  const parsed = ScriptSettingsSchema.safeParse(merged);
  if (!parsed.success) {
    console.warn('[novelToST] 设置解析失败，已回退默认设置', parsed.error);
    toastr.warning('NovelToST 设置解析失败，已回退到默认值');
    return getDefaultSettings();
  }
  return parsed.data;
}

export const useNovelSettingsStore = defineStore('novelToST/settings', () => {
  const settings = ref<NovelSettings>(getDefaultSettings());
  const initialized = ref(false);

  type SettingsPatchPayload = Partial<Omit<NovelSettings, 'worldbook'>> & {
    worldbook?: Partial<NovelWorldbookSettings>;
  };

  const init = () => {
    settings.value = readSettingsFromVariables();
    initialized.value = true;
  };

  const reset = () => {
    settings.value = getDefaultSettings();
  };

  const patch = (payload: SettingsPatchPayload) => {
    const nextSettings: NovelSettings = {
      ...settings.value,
      ...payload,
      worldbook: payload.worldbook
        ? {
            ...settings.value.worldbook,
            ...payload.worldbook,
          }
        : settings.value.worldbook,
    };

    settings.value = ScriptSettingsSchema.parse(nextSettings);
  };

  const setCurrentChapter = (chapter: number) => {
    settings.value.currentChapter = Math.max(0, Math.trunc(chapter));
  };

  return {
    settings,
    initialized,
    init,
    reset,
    patch,
    setCurrentChapter,
    scriptVariableOption,
    ScriptSettingsSchema,
    WorldbookSettingsSchema,
  };
});
