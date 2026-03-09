import { computed, ref } from 'vue';
import {
  applyLLMPresetToWorldbookSettings,
  captureLLMPresetFromWorldbookSettings,
  createLLMPresetId,
  ensureUniqueLLMPresetName,
  removeLLMPreset,
  upsertLLMPreset,
} from '../core/llm-preset.service';
import { fetchCustomApiModels, quickTestWorldbookApi } from '../core/worldbook/api.service';
import { useOutlineStore } from '../stores/outline.store';
import { useNovelSettingsStore } from '../stores/settings.store';

const LLM_REQUEST_PREFIX = 'llm-config';

let llmRequestCounter = 0;

function nextLLMRequestId(): string {
  llmRequestCounter += 1;
  return `${LLM_REQUEST_PREFIX}-${Date.now()}-${llmRequestCounter}`;
}

type ApiStatusType = 'idle' | 'loading' | 'success' | 'error';

type SavePresetOptions = {
  overwritePresetId?: string | null;
};

function normalizeOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTemperature(value: unknown): number {
  const fallback = 0.8;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const clamped = Math.min(2, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

export function useLLMConfigControl() {
  const settingsStore = useNovelSettingsStore();
  const outlineStore = useOutlineStore();

  const modelOptions = ref<string[]>([]);
  const modelStatusType = ref<ApiStatusType>('idle');
  const modelStatusMessage = ref('');
  const modelFetchLoading = ref(false);
  const apiTestLoading = ref(false);

  const presetNameInput = ref('');

  const worldbookSettings = computed(() => settingsStore.settings.worldbook);
  const llmPresets = computed(() => worldbookSettings.value.llmPresets ?? []);
  const activePresetId = computed(() => worldbookSettings.value.activeLLMPresetId ?? null);

  const activePreset = computed(() => {
    const presetId = activePresetId.value;
    if (!presetId) {
      return null;
    }

    return llmPresets.value.find(item => item.id === presetId) ?? null;
  });

  const setModelStatus = (type: ApiStatusType, message = '') => {
    modelStatusType.value = type;
    modelStatusMessage.value = message;
  };

  const fetchModelList = async (): Promise<void> => {
    if (modelFetchLoading.value) {
      return;
    }

    const settings = worldbookSettings.value;
    if (settings.useTavernApi) {
      setModelStatus('error', '当前为 SillyTavern API 模式，无需拉取模型列表');
      toastr.warning('当前为 SillyTavern API 模式，无需拉取模型列表');
      return;
    }

    modelFetchLoading.value = true;
    setModelStatus('loading', '正在拉取模型列表...');

    try {
      const result = await fetchCustomApiModels(settings, {
        timeoutMs: settings.apiTimeout,
      });

      modelOptions.value = result.models;
      if (result.models.length === 0) {
        setModelStatus('error', '未拉取到模型，请检查 Endpoint 与权限');
        toastr.warning('未拉取到模型，请手动填写模型名称');
        return;
      }

      const currentModel = settings.customApiModel.trim();
      if (!currentModel || !result.models.includes(currentModel)) {
        settingsStore.patch({
          worldbook: {
            customApiModel: result.models[0],
          },
        });
      }

      setModelStatus('success', `已拉取 ${result.models.length} 个模型`);
      toastr.success(`模型列表拉取成功，共 ${result.models.length} 个`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      modelOptions.value = [];
      setModelStatus('error', message);
      toastr.error(message, '模型列表拉取失败');
    } finally {
      modelFetchLoading.value = false;
    }
  };

  const quickTestApi = async (): Promise<void> => {
    if (apiTestLoading.value) {
      return;
    }

    const settings = worldbookSettings.value;
    apiTestLoading.value = true;
    setModelStatus('loading', '正在测试 API 连接...');

    try {
      const result = await quickTestWorldbookApi(settings, {
        timeoutMs: settings.apiTimeout,
        requestId: nextLLMRequestId(),
      });

      setModelStatus('success', `连接成功（${result.elapsedMs}ms，${result.provider}）`);
      toastr.success(`API 连接测试成功（${result.elapsedMs}ms）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setModelStatus('error', message);
      toastr.error(message, 'API 测试失败');
    } finally {
      apiTestLoading.value = false;
    }
  };

  const applyPresetById = (presetId: string): boolean => {
    const normalizedPresetId = normalizeOptionalString(presetId);
    if (!normalizedPresetId) {
      toastr.warning('请先选择要应用的预设');
      return false;
    }

    const preset = llmPresets.value.find(item => item.id === normalizedPresetId);
    if (!preset) {
      toastr.warning('所选预设不存在，可能已被删除');
      return false;
    }

    settingsStore.patch({
      worldbook: {
        ...applyLLMPresetToWorldbookSettings(preset),
        activeLLMPresetId: preset.id,
      },
    });

    presetNameInput.value = preset.name;
    toastr.success(`已应用预设：${preset.name}`);
    return true;
  };

  const saveCurrentAsPreset = (name: string, options: SavePresetOptions = {}) => {
    const normalizedOverwritePresetId = normalizeOptionalString(options.overwritePresetId ?? '');
    const existingPreset = normalizedOverwritePresetId
      ? llmPresets.value.find(item => item.id === normalizedOverwritePresetId) ?? null
      : null;

    const now = new Date().toISOString();
    const nextPresetId = existingPreset?.id ?? createLLMPresetId();

    const requestedName = normalizeOptionalString(name) || existingPreset?.name || '未命名配置';
    const finalName = ensureUniqueLLMPresetName(requestedName, llmPresets.value, existingPreset?.id ?? null);

    const capturedPreset = captureLLMPresetFromWorldbookSettings(worldbookSettings.value, {
      id: nextPresetId,
      name: finalName,
      now,
    });

    const nextPreset = {
      ...capturedPreset,
      createdAt: existingPreset?.createdAt || now,
      updatedAt: now,
    };

    const nextPresets = upsertLLMPreset(llmPresets.value, nextPreset);

    settingsStore.patch({
      worldbook: {
        llmPresets: nextPresets,
        activeLLMPresetId: nextPreset.id,
      },
    });

    presetNameInput.value = nextPreset.name;

    if (existingPreset) {
      toastr.success(`已更新预设：${nextPreset.name}`);
    } else {
      toastr.success(`已保存预设：${nextPreset.name}`);
    }

    return nextPreset;
  };

  const deletePresetById = (presetId: string): boolean => {
    const normalizedPresetId = normalizeOptionalString(presetId);
    if (!normalizedPresetId) {
      toastr.warning('请先选择要删除的预设');
      return false;
    }

    const preset = llmPresets.value.find(item => item.id === normalizedPresetId);
    if (!preset) {
      toastr.warning('所选预设不存在，可能已被删除');
      return false;
    }

    if (typeof globalThis.confirm === 'function') {
      const confirmed = globalThis.confirm(`确认删除预设「${preset.name}」？该操作不可撤销。`);
      if (!confirmed) {
        return false;
      }
    }

    const nextPresets = removeLLMPreset(llmPresets.value, preset.id);
    const nextActivePresetId = activePresetId.value === preset.id ? null : activePresetId.value;

    settingsStore.patch({
      worldbook: {
        llmPresets: nextPresets,
        activeLLMPresetId: nextActivePresetId,
      },
    });

    if (nextActivePresetId === null) {
      presetNameInput.value = '';
    }

    toastr.success(`已删除预设：${preset.name}`);
    return true;
  };


  const setOutlineAIProvider = (value: string) => {
    const normalized = normalizeOptionalString(value);
    outlineStore.setAIConfig({
      provider: normalized === 'custom' ? 'custom' : 'tavern',
    });
  };

  const setOutlineAIModel = (value: string) => {
    outlineStore.setAIConfig({
      model: normalizeOptionalString(value),
    });
  };

  const setOutlineAITemperature = (value: unknown) => {
    outlineStore.setAIConfig({
      temperature: normalizeTemperature(Number(value)),
    });
  };

  const setOutlineMentionIncludeWorldbookName = (value: boolean) => {
    outlineStore.patchMentionConfig({
      worldbookEntryLabel: {
        includeWorldbookName: Boolean(value),
      },
    });
  };

  const setOutlineMentionIncludeTriggerKeywords = (value: boolean) => {
    outlineStore.patchMentionConfig({
      worldbookEntryLabel: {
        includeTriggerKeywords: Boolean(value),
      },
    });
  };

  const setOutlineMentionIncludeStrategyType = (value: boolean) => {
    outlineStore.patchMentionConfig({
      worldbookEntryLabel: {
        includeStrategyType: Boolean(value),
      },
    });
  };

  const resetPresetNameInput = () => {
    presetNameInput.value = activePreset.value?.name ?? '';
  };

  return {
    modelOptions,
    modelStatusType,
    modelStatusMessage,
    modelFetchLoading,
    apiTestLoading,

    presetNameInput,
    llmPresets,
    activePresetId,
    activePreset,

    fetchModelList,
    quickTestApi,
    applyPresetById,
    saveCurrentAsPreset,
    deletePresetById,
    resetPresetNameInput,

    setOutlineAIProvider,
    setOutlineAIModel,
    setOutlineAITemperature,
    setOutlineMentionIncludeWorldbookName,
    setOutlineMentionIncludeTriggerKeywords,
    setOutlineMentionIncludeStrategyType,
  };
}
