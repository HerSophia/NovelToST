<template>
  <BaseCard title="生成设置" collapsible :collapsed="collapsed" @update:collapsed="emit('update:collapsed', $event)">
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
        label="提示词"
        :rows="3"
        placeholder="输入用于指导生成的提示词..."
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
          hint="小于此长度视为生成失败"
        />
      </div>

      <div class="border-t border-white/10 pt-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">回复稳定判定</p>
        <div class="grid gap-4 sm:grid-cols-3">
          <BaseInput
            v-model.number="settings.stabilityCheckInterval"
            label="稳定检查间隔"
            type="number"
            min="200"
            hint="毫秒 (ms)"
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
            hint="毫秒 (ms)"
          />
        </div>
      </div>

      <div class="border-t border-white/10 pt-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">发送阶段弹窗检测</p>
        <BaseCheckbox v-model="settings.enableSendToastDetection">
          启用发送阶段弹窗检测
        </BaseCheckbox>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model.number="settings.sendToastWaitTimeout"
            label="发送弹窗等待超时"
            type="number"
            min="1000"
            hint="毫秒 (ms)"
            :disabled="!settings.enableSendToastDetection"
          />
          <BaseInput
            v-model.number="settings.sendPostToastWaitTime"
            label="发送弹窗结束后额外等待"
            type="number"
            min="0"
            hint="毫秒 (ms)"
            :disabled="!settings.enableSendToastDetection"
          />
        </div>
      </div>

      <div class="border-t border-white/10 pt-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">回复阶段弹窗检测</p>
        <BaseCheckbox v-model="settings.enableReplyToastDetection">
          启用回复阶段弹窗检测
        </BaseCheckbox>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model.number="settings.replyToastWaitTimeout"
            label="回复弹窗等待超时"
            type="number"
            min="1000"
            hint="毫秒 (ms)"
            :disabled="!settings.enableReplyToastDetection"
          />
          <BaseInput
            v-model.number="settings.replyPostToastWaitTime"
            label="回复弹窗结束后额外等待"
            type="number"
            min="0"
            hint="毫秒 (ms)"
            :disabled="!settings.enableReplyToastDetection"
          />
        </div>
      </div>

      <div class="border-t border-white/10 pt-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">超时与兼容选项</p>
        <div class="grid gap-4 sm:grid-cols-3">
          <BaseInput
            v-model.number="settings.maxWaitForResponseStart"
            label="等待回复开始超时"
            type="number"
            min="3000"
            hint="毫秒 (ms)"
          />
          <BaseInput
            v-model.number="settings.maxWaitForStable"
            label="等待回复稳定超时"
            type="number"
            min="5000"
            hint="毫秒 (ms)"
          />
          <BaseInput
            v-model.number="settings.retryBackoffMs"
            label="失败重试间隔"
            type="number"
            min="0"
            hint="毫秒 (ms)"
          />
        </div>

        <div class="mt-3 grid gap-2">
          <BaseCheckbox v-model="settings.useRawContent">
            导出/提取优先使用 raw 内容
          </BaseCheckbox>
          <BaseCheckbox v-model="settings.reloadOnChatChange">
            聊天切换时自动重载脚本
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

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  'update:collapsed': [value: boolean];
}>();

const settingsStore = useNovelSettingsStore();
const { settings } = storeToRefs(settingsStore);
</script>
