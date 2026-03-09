<template>
  <BaseCard
    title="标签提取工具"
    collapsible
    :collapsed="collapsed"
    :default-collapsed="true"
    @update:collapsed="emit('update:collapsed', $event)"
  >
    <template #actions>
      <HelpTriggerButton
        topic="extract"
        title="查看标签提取帮助"
        @trigger="emit('open-help', 'extract')"
      />

      <BaseButton variant="ghost" size="sm" @click.stop="emit('refresh-preview')">
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </BaseButton>
    </template>

    <div class="grid gap-4">
      <BaseDropdownSelect
        v-model="settings.extractMode"
        label="提取模式"
        :options="extractModeOptions"
        data-tag-extract-mode-select
        list-data-attr-name="data-tag-extract-mode-list"
        item-data-attr-name="data-tag-extract-mode-option"
      />

      <div v-if="settings.extractMode === 'tags'" class="grid gap-4 sm:grid-cols-2">
        <BaseInput
          v-model="settings.extractTags"
          label="提取标签"
          placeholder="例如: content detail 正文"
          hint="使用空格或逗号分隔多个标签"
        />
        <BaseDropdownSelect
          v-model="separatorToken"
          label="内容分隔符"
          :options="separatorTokenOptions"
          data-tag-extract-separator-select
          list-data-attr-name="data-tag-extract-separator-list"
          item-data-attr-name="data-tag-extract-separator-option"
        />
      </div>

      <div class="mt-2">
        <label class="mb-2 block text-xs font-medium text-slate-400">预览结果</label>
        <div class="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs leading-relaxed text-slate-300">
          {{ preview || '暂无预览内容，请点击刷新按钮。' }}
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useExportStore } from '../../stores/export.store';
import { useNovelSettingsStore } from '../../stores/settings.store';
import BaseButton from '../base/BaseButton.vue';
import BaseCard from '../base/BaseCard.vue';
import BaseInput from '../base/BaseInput.vue';
import BaseDropdownSelect from '../base/BaseDropdownSelect.vue';
import HelpTriggerButton from './help/HelpTriggerButton.vue';
import type { HelpTopicId } from '../help/help-topics';
import type { ExtractMode } from '../../types';

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  'refresh-preview': [];
  'update:collapsed': [value: boolean];
  'open-help': [topic: HelpTopicId];
}>();

const settingsStore = useNovelSettingsStore();
const exportStore = useExportStore();

const { settings } = storeToRefs(settingsStore);
const { latestPreview: preview } = storeToRefs(exportStore);

const extractModeOptions: Array<{ value: ExtractMode; label: string }> = [
  { value: 'all', label: '全部内容（无过滤）' },
  { value: 'tags', label: '标签提取模式' },
];

const separatorTokenOptions: Array<{ value: string; label: string }> = [
  { value: '\\n\\n', label: '双换行 (段落)' },
  { value: '\\n', label: '单换行' },
  { value: '', label: '无分隔' },
];

const separatorToken = computed({
  get: () => settings.value.tagSeparator.replaceAll('\n', '\\n'),
  set: value => {
    settings.value.tagSeparator = value.replaceAll('\\n', '\n');
  },
});
</script>
