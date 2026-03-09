<template>
  <BaseCard title="生成设置" collapsible :collapsed="collapsed" @update:collapsed="emit('update:collapsed', $event)">
    <template #actions>
      <HelpTriggerButton
        topic="generate"
        title="查看生成流程帮助"
        @trigger="emit('open-help', 'generate')"
      />
      <HelpTriggerButton
        topic="advanced"
        title="查看高级参数帮助"
        @trigger="emit('open-help', 'advanced')"
      />
    </template>

    <div class="grid gap-4">
      <BaseInput
        v-model.number="settings.totalChapters"
        label="目标章节数"
        type="number"
        min="1"
        hint="设置要生成的总章节数量"
      />

      <BaseTextarea
        v-model="settings.prompt"
        label="续写提示词"
        :rows="3"
        placeholder="告诉 AI 接下来要写什么…（启用大纲后，此处作为补充要求）"
      />

      <div class="grid gap-4 sm:grid-cols-3">
        <BaseInput
          v-model.number="settings.autoSaveInterval"
          label="自动保存间隔"
          type="number"
          min="1"
          hint="每生成多少章保存一次"
        />
        <BaseInput
          v-model.number="settings.maxRetries"
          label="最大重试次数"
          type="number"
          min="1"
          hint="单章失败最大重试数"
        />
        <BaseInput
          v-model.number="settings.minChapterLength"
          label="最小章节长度"
          type="number"
          min="0"
          hint="AI 输出少于此字数会判定为失败并重试"
        />
      </div>

      <div class="border-t border-white/10 pt-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">回复完成检测</p>
        <div class="grid gap-4 sm:grid-cols-3">
          <BaseInput
            v-model.number="settings.stabilityCheckInterval"
            label="稳定检查间隔"
            type="number"
            min="200"
            hint="毫秒（如 3000 = 3 秒）"
          />
          <BaseInput
            v-model.number="settings.stabilityRequiredCount"
            label="稳定所需次数"
            type="number"
            min="1"
            hint="连续检测多少次无变化"
          />
          <BaseInput
            v-model.number="settings.replyWaitTime"
            label="回复后固定等待"
            type="number"
            min="0"
            hint="毫秒（如 3000 = 3 秒）"
          />
        </div>
      </div>

      <div class="border-t border-white/10 pt-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">发送确认检测（高级）</p>
        <BaseCheckbox v-model="settings.enableSendToastDetection">
          启用发送确认检测
        </BaseCheckbox>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model.number="settings.sendToastWaitTimeout"
            label="发送弹窗等待超时"
            type="number"
            min="1000"
            hint="毫秒（如 5000 = 5 秒）"
            :disabled="!settings.enableSendToastDetection"
          />
          <BaseInput
            v-model.number="settings.sendPostToastWaitTime"
            label="发送弹窗结束后额外等待"
            type="number"
            min="0"
            hint="毫秒（如 1000 = 1 秒）"
            :disabled="!settings.enableSendToastDetection"
          />
        </div>
      </div>

      <div class="border-t border-white/10 pt-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">回复完成确认（高级）</p>
        <BaseCheckbox v-model="settings.enableReplyToastDetection">
          启用回复完成确认检测
        </BaseCheckbox>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model.number="settings.replyToastWaitTimeout"
            label="回复弹窗等待超时"
            type="number"
            min="1000"
            hint="毫秒（如 5000 = 5 秒）"
            :disabled="!settings.enableReplyToastDetection"
          />
          <BaseInput
            v-model.number="settings.replyPostToastWaitTime"
            label="回复弹窗结束后额外等待"
            type="number"
            min="0"
            hint="毫秒（如 1000 = 1 秒）"
            :disabled="!settings.enableReplyToastDetection"
          />
        </div>
      </div>

      <div class="border-t border-white/10 pt-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">超时设置与兼容选项</p>
        <div class="grid gap-4 sm:grid-cols-3">
          <BaseInput
            v-model.number="settings.maxWaitForResponseStart"
            label="等待回复开始超时"
            type="number"
            min="3000"
            hint="毫秒（如 30000 = 30 秒）"
          />
          <BaseInput
            v-model.number="settings.maxWaitForStable"
            label="等待回复稳定超时"
            type="number"
            min="5000"
            hint="毫秒（如 60000 = 60 秒）"
          />
          <BaseInput
            v-model.number="settings.retryBackoffMs"
            label="失败重试间隔"
            type="number"
            min="0"
            hint="毫秒（如 3000 = 3 秒）"
          />
        </div>

        <div class="mt-3 grid gap-2">
          <BaseCheckbox v-model="settings.useRawContent">
            导出时使用原始文本（不含 HTML 样式）
          </BaseCheckbox>
          <BaseCheckbox v-model="settings.reloadOnChatChange">
            切换聊天时自动刷新插件
          </BaseCheckbox>
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useNovelSettingsStore } from '../../stores/settings.store';
import BaseCard from '../base/BaseCard.vue';
import BaseCheckbox from '../base/BaseCheckbox.vue';
import BaseInput from '../base/BaseInput.vue';
import BaseTextarea from '../base/BaseTextarea.vue';
import HelpTriggerButton from './help/HelpTriggerButton.vue';
import type { HelpTopicId } from '../help/help-topics';

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  'update:collapsed': [value: boolean];
  'open-help': [topic: HelpTopicId];
}>();

const settingsStore = useNovelSettingsStore();
const { settings } = storeToRefs(settingsStore);
</script>
