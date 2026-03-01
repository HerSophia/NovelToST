<template>
  <BaseCard
    title="导出设置"
    collapsible
    :collapsed="collapsed"
    :default-collapsed="true"
    @update:collapsed="emit('update:collapsed', $event)"
  >
    <template #actions>
      <HelpTriggerButton
        topic="export"
        title="查看导出帮助"
        @trigger="emit('open-help', 'export')"
      />
    </template>

    <div class="grid gap-4">
      <BaseCheckbox v-model="settings.exportAll">
        导出全部楼层
      </BaseCheckbox>

      <div class="grid gap-4 sm:grid-cols-2">
        <BaseInput
          v-model.number="settings.exportStartFloor"
          label="起始楼层"
          type="number"
          min="0"
          :disabled="settings.exportAll"
        />
        <BaseInput
          v-model.number="settings.exportEndFloor"
          label="结束楼层"
          type="number"
          min="0"
          :disabled="settings.exportAll"
        />
      </div>

      <div class="flex flex-wrap gap-4">
        <BaseCheckbox v-model="settings.exportIncludeAI">
          包含 AI 发言
        </BaseCheckbox>
        <BaseCheckbox v-model="settings.exportIncludeUser">
          包含用户发言
        </BaseCheckbox>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <BaseButton variant="primary" @click="$emit('export-txt')">
          导出 TXT
        </BaseButton>
        <BaseButton variant="secondary" @click="$emit('export-json')">
          导出 JSON
        </BaseButton>
      </div>

      <div v-if="snapshot" class="mt-2 rounded-lg border border-white/5 bg-white/5 p-3 text-xs text-slate-300">
        <div class="flex items-center justify-between">
          <span class="font-medium text-slate-200">最近导出</span>
          <span class="opacity-60">{{ snapshot.filename }}</span>
        </div>
        <div class="mt-1 flex gap-3 opacity-60">
          <span>{{ snapshot.chapterCount }} 条消息</span>
          <span>{{ snapshot.totalCharacters }} 字</span>
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useExportStore } from '../../stores/export.store';
import { useNovelSettingsStore } from '../../stores/settings.store';
import BaseButton from '../base/BaseButton.vue';
import BaseCard from '../base/BaseCard.vue';
import BaseCheckbox from '../base/BaseCheckbox.vue';
import BaseInput from '../base/BaseInput.vue';
import HelpTriggerButton from './help/HelpTriggerButton.vue';
import type { HelpTopicId } from '../help/help-topics';

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  'export-txt': [];
  'export-json': [];
  'update:collapsed': [value: boolean];
  'open-help': [topic: HelpTopicId];
}>();

const settingsStore = useNovelSettingsStore();
const exportStore = useExportStore();

const { settings } = storeToRefs(settingsStore);
const { lastSnapshot: snapshot } = storeToRefs(exportStore);
</script>
