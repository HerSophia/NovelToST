<template>
  <section data-workbench-llm-panel class="space-y-3 text-sm text-slate-200">
    <!-- ═══ 顶部介绍 ═══ -->
    <div class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="font-semibold">⚙️ AI 模型配置</p>
          <p class="mt-1 text-amber-100/90">
            在这里集中管理 AI 的连接方式和参数。配置好后，大纲工坊和续写功能都会使用这些设置。
          </p>
        </div>

        <HelpTriggerButton
          topic="llm"
          title="查看 AI 配置帮助"
          data-llm-help-trigger="overview"
          @trigger="emit('open-help', 'llm')"
        />
      </div>
    </div>

    <!-- ═══ 区域1：连接方式 ═══ -->
    <div data-llm-global-settings class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
      <h3 class="text-xs font-semibold tracking-[0.1em] text-slate-300 uppercase">🔌 连接方式</h3>
      <p class="mt-1 text-[11px] text-slate-500">选择 AI 的调用通道。推荐直接使用酒馆自带的连接。</p>

      <div class="mt-3 grid gap-3">
        <BaseCheckbox v-model="wb.useTavernApi" data-llm-setting="use-tavern-api">
          使用酒馆内置连接（推荐）
        </BaseCheckbox>
        <p v-if="wb.useTavernApi" class="pl-5 text-[11px] text-slate-500">
          将直接使用 SillyTavern 当前配置的 API 和模型，无需额外设置。
        </p>

        <!-- 自定义 API 配置（仅在不使用酒馆时显示） -->
        <div v-if="!wb.useTavernApi" class="space-y-3 rounded-lg border border-white/10 bg-black/15 p-2.5">
          <p class="text-[11px] font-medium text-slate-300">自定义 API 设置</p>

          <BaseDropdownSelect
            v-model="wb.customApiProvider"
            :options="customProviderOptions"
            label="服务商"
            data-llm-setting="custom-provider"
            list-data-attr-name="data-llm-setting-custom-provider-list"
            item-data-attr-name="data-llm-setting-custom-provider-option"
          />

          <BaseInput
            v-model="wb.customApiEndpoint"
            label="接口地址"
            placeholder="https://api.openai.com/v1"
            data-llm-setting="custom-endpoint"
          />

          <BaseInput
            v-model="wb.customApiKey"
            type="password"
            label="API 密钥"
            placeholder="sk-..."
            data-llm-setting="custom-key"
          />

          <div class="grid gap-2 sm:grid-cols-2">
            <BaseInput
              v-model="wb.customApiModel"
              label="模型名称"
              placeholder="gpt-4o / gemini-2.5-flash"
              data-llm-setting="custom-model"
            />

            <BaseDropdownSelect
              v-if="modelOptions.length > 0"
              :model-value="wb.customApiModel"
              :options="customModelOptions"
              label="从已获取列表选择"
              data-llm-setting="custom-model-options"
              list-data-attr-name="data-llm-setting-custom-model-list"
              item-data-attr-name="data-llm-setting-custom-model-option"
              @update:model-value="wb.customApiModel = String($event)"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <BaseButton
              variant="secondary"
              data-llm-action="fetch-models"
              :disabled="modelFetchLoading || apiTestLoading"
              @click="fetchModelList"
            >
              {{ modelFetchLoading ? '获取中…' : '获取模型列表' }}
            </BaseButton>

            <BaseButton
              variant="secondary"
              data-llm-action="quick-test-api"
              :disabled="modelFetchLoading || apiTestLoading"
              @click="quickTestApi"
            >
              {{ apiTestLoading ? '测试中…' : '🧪 测试连接' }}
            </BaseButton>
          </div>

          <p v-if="modelStatusMessage" data-llm-model-status class="text-[11px]" :class="statusClass">
            {{ modelStatusMessage }}
          </p>
        </div>

        <!-- 超时设置 -->
        <details class="rounded-lg border border-white/10 bg-black/10">
          <summary class="cursor-pointer p-2.5 text-[11px] text-slate-400 transition hover:text-slate-300">
            高级：超时设置
          </summary>
          <div class="border-t border-white/10 p-2.5">
            <BaseInput
              v-model.number="wb.apiTimeout"
              type="number"
              :min="5000"
              label="请求超时时间（毫秒）"
              hint="AI 回复较慢时可适当增大。默认 120000（2 分钟）"
              data-llm-setting="api-timeout"
            />
          </div>
        </details>
      </div>
    </div>

    <!-- ═══ 区域2：配置预设 ═══ -->
    <div data-llm-preset-section class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
      <h3 class="text-xs font-semibold tracking-[0.1em] text-slate-300 uppercase">💾 配置预设</h3>
      <p class="mt-1 text-[11px] text-slate-500">
        保存当前的连接配置为预设，方便在不同 API / 模型间快速切换。
      </p>

      <div class="mt-3 grid gap-3">
        <!-- 选择已有预设 -->
        <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <BaseDropdownSelect
            :model-value="selectedPresetId"
            :options="presetSelectOptions"
            label="已保存的预设"
            data-llm-preset="select"
            list-data-attr-name="data-llm-preset-select-list"
            item-data-attr-name="data-llm-preset-select-option"
            @update:model-value="handlePresetSelect"
          />

          <BaseButton
            variant="success"
            data-llm-action="apply-preset"
            :disabled="!selectedPresetId"
            @click="handleApplySelectedPreset"
          >
            应用
          </BaseButton>

          <BaseButton
            variant="danger"
            data-llm-action="delete-preset"
            :disabled="!selectedPresetId"
            @click="handleDeleteSelectedPreset"
          >
            删除
          </BaseButton>
        </div>

        <!-- 保存新预设 -->
        <div class="rounded-lg border border-white/10 bg-black/10 p-2.5">
          <p class="mb-2 text-[11px] font-medium text-slate-400">保存当前配置</p>
          <BaseInput
            v-model="presetNameInput"
            label="预设名称"
            placeholder="如：本地 Ollama / 云端 GPT-4o"
            data-llm-preset="name-input"
          />

          <div class="mt-2 flex flex-wrap items-center gap-2">
            <BaseButton variant="primary" data-llm-action="save-preset" @click="handleSavePresetAsNew">
              保存为新预设
            </BaseButton>

            <BaseButton
              variant="ghost"
              data-llm-action="overwrite-preset"
              :disabled="!selectedPresetId"
              @click="handleOverwritePreset"
            >
              覆盖所选预设
            </BaseButton>
          </div>
        </div>

        <p class="text-[10px] text-slate-500">
          ⚠️ 预设会保存 API 密钥等敏感信息，请仅在可信环境中使用。
        </p>
      </div>
    </div>

    <!-- ═══ 区域3：大纲 AI 专属参数 ═══ -->
    <div data-llm-outline-settings class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
      <h3 class="text-xs font-semibold tracking-[0.1em] text-slate-300 uppercase">📖 工坊 AI 参数</h3>
      <p class="mt-1 text-[11px] text-slate-500">
        为大纲工坊、设定工坊等 AI 对话功能配置参数。不影响续写。
      </p>

      <div class="mt-3 grid gap-3 rounded-lg border border-white/10 bg-black/15 p-2.5">
        <div class="grid gap-2 sm:grid-cols-2">
          <BaseDropdownSelect
            :model-value="outlineStore.ai.provider"
            :options="outlineProviderOptions"
            label="使用哪个连接"
            data-llm-outline-setting="provider"
            list-data-attr-name="data-llm-outline-setting-provider-list"
            item-data-attr-name="data-llm-outline-setting-provider-option"
            @update:model-value="value => setOutlineAIProvider(String(value ?? ''))"
          />

          <div>
            <BaseInput
              :model-value="outlineStore.ai.temperature"
              type="number"
              :min="0"
              :max="2"
              :step="0.1"
              label="创造力（Temperature）"
              hint="越高越有创意但可能跑偏，推荐 0.7~1.0"
              data-llm-outline-setting="temperature"
              @update:model-value="setOutlineAITemperature"
            />
          </div>
        </div>

        <BaseInput
          :model-value="outlineStore.ai.model"
          label="指定模型（可选）"
          placeholder="留空则自动使用当前连接的默认模型"
          data-llm-outline-setting="model"
          @update:model-value="value => setOutlineAIModel(String(value ?? ''))"
        />

        <!-- data-attr 保留 outline 前缀以兼容测试，实际作用域已扩展为全局（设定工坊 + 大纲工坊） -->
        <div data-llm-outline-mention-settings class="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2.5">
          <p class="text-[11px] font-medium text-cyan-100">📎 @ 引用配置</p>
          <p class="mt-1 text-[11px] text-cyan-100/70">控制各工坊中 @ 世界书条目候选项的标签展示方式，对设定工坊和大纲工坊同时生效。</p>

          <div class="mt-2 grid gap-2">
            <BaseCheckbox
              :model-value="outlineStore.mentionConfig.worldbookEntryLabel.includeWorldbookName"
              data-llm-outline-mention-setting="include-worldbook-name"
              @update:model-value="value => setOutlineMentionIncludeWorldbookName(Boolean(value))"
            >
              世界书条目标签显示世界书名
            </BaseCheckbox>
            <BaseCheckbox
              :model-value="outlineStore.mentionConfig.worldbookEntryLabel.includeTriggerKeywords"
              data-llm-outline-mention-setting="include-trigger-keywords"
              @update:model-value="value => setOutlineMentionIncludeTriggerKeywords(Boolean(value))"
            >
              世界书条目标签显示触发词
            </BaseCheckbox>
            <BaseCheckbox
              :model-value="outlineStore.mentionConfig.worldbookEntryLabel.includeStrategyType"
              data-llm-outline-mention-setting="include-strategy-type"
              @update:model-value="value => setOutlineMentionIncludeStrategyType(Boolean(value))"
            >
              世界书条目标签显示策略类型
            </BaseCheckbox>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useLLMConfigControl } from '../../composables/useLLMConfigControl';
import { useOutlineStore } from '../../stores/outline.store';
import { useNovelSettingsStore } from '../../stores/settings.store';
import BaseButton from '../base/BaseButton.vue';
import BaseCheckbox from '../base/BaseCheckbox.vue';
import BaseDropdownSelect from '../base/BaseDropdownSelect.vue';
import BaseInput from '../base/BaseInput.vue';
import HelpTriggerButton from '../components/help/HelpTriggerButton.vue';
import type { HelpTopicId } from '../help/help-topics';

const emit = defineEmits<{
  'open-help': [topic: HelpTopicId];
}>();

const settingsStore = useNovelSettingsStore();
const outlineStore = useOutlineStore();
const { settings } = storeToRefs(settingsStore);

const wb = computed(() => settings.value.worldbook);

const {
  modelOptions,
  modelStatusType,
  modelStatusMessage,
  modelFetchLoading,
  apiTestLoading,
  presetNameInput,
  llmPresets,
  activePresetId,
  fetchModelList,
  quickTestApi,
  applyPresetById,
  saveCurrentAsPreset,
  deletePresetById,
  setOutlineAIProvider,
  setOutlineAIModel,
  setOutlineAITemperature,
  setOutlineMentionIncludeWorldbookName,
  setOutlineMentionIncludeTriggerKeywords,
  setOutlineMentionIncludeStrategyType,
} = useLLMConfigControl();

const selectedPresetId = ref('');

const customProviderOptions = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-compatible', label: 'OpenAI 兼容接口' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'gemini-proxy', label: 'Gemini（代理）' },
  { value: 'deepseek', label: 'DeepSeek' },
];

const customModelOptions = computed(() => {
  return modelOptions.value.map(model => ({
    value: model,
    label: model,
  }));
});

const presetSelectOptions = computed(() => {
  return [
    { value: '', label: '— 请选择 —' },
    ...llmPresets.value.map(preset => ({ value: preset.id, label: preset.name })),
  ];
});

const outlineProviderOptions = [
  { value: 'tavern', label: '跟随酒馆设置' },
  { value: 'custom', label: '使用上方的自定义 API' },
];

watch(
  activePresetId,
  value => {
    selectedPresetId.value = value ?? '';

    const preset = llmPresets.value.find(item => item.id === selectedPresetId.value);
    if (preset) {
      presetNameInput.value = preset.name;
    }
  },
  { immediate: true },
);

const statusClass = computed(() => {
  switch (modelStatusType.value) {
    case 'success':
      return 'text-emerald-400';
    case 'error':
      return 'text-rose-400';
    case 'loading':
      return 'text-amber-300';
    default:
      return 'text-slate-400';
  }
});

const handlePresetSelect = (value: string | number) => {
  selectedPresetId.value = String(value ?? '');
};

const handleApplySelectedPreset = () => {
  if (!selectedPresetId.value) {
    toastr.warning('请先选择一个预设');
    return;
  }

  applyPresetById(selectedPresetId.value);
};

const handleSavePresetAsNew = () => {
  saveCurrentAsPreset(presetNameInput.value);
};

const handleOverwritePreset = () => {
  if (!selectedPresetId.value) {
    toastr.warning('请先选择要覆盖的预设');
    return;
  }

  saveCurrentAsPreset(presetNameInput.value, {
    overwritePresetId: selectedPresetId.value,
  });
};

const handleDeleteSelectedPreset = () => {
  if (!selectedPresetId.value) {
    toastr.warning('请先选择要删除的预设');
    return;
  }

  const deleted = deletePresetById(selectedPresetId.value);
  if (deleted) {
    selectedPresetId.value = activePresetId.value ?? '';
  }
};
</script>
