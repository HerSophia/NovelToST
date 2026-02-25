import _ from 'lodash';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { z } from 'zod';
import type { NovelSettings } from '../types';

const ScriptSettingsSchema = z
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
  })
  .prefault({});

const scriptVariableOption = {
  type: 'script' as const,
  script_id: getScriptId(),
};

function getDefaultSettings(): NovelSettings {
  return ScriptSettingsSchema.parse({});
}

function readSettingsFromVariables(): NovelSettings {
  const raw = getVariables(scriptVariableOption);
  const merged = _.merge({}, getDefaultSettings(), _.isPlainObject(raw) ? raw : {});
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

  const init = () => {
    settings.value = readSettingsFromVariables();
    initialized.value = true;
  };

  const reset = () => {
    settings.value = getDefaultSettings();
  };

  const patch = (payload: Partial<NovelSettings>) => {
    settings.value = ScriptSettingsSchema.parse({
      ...settings.value,
      ...payload,
    });
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
  };
});
