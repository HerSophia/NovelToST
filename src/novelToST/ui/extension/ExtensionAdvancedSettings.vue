<template>
  <section class="rounded-xl border border-white/10 bg-slate-900/65 p-3 shadow-lg">
    <header>
      <h3 class="text-xs font-semibold tracking-[0.1em] text-white uppercase">高级设置</h3>
      <p class="mt-1 text-[11px] text-slate-400">以下参数会与主页面 Workbench 共享同一份状态。</p>
    </header>

    <div class="mt-3 grid gap-3">
      <div class="grid gap-3 sm:grid-cols-3">
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
          hint="连续次数"
        />
        <BaseInput
          v-model.number="settings.replyWaitTime"
          label="回复后固定等待"
          type="number"
          min="0"
          hint="毫秒 (ms)"
        />
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
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

      <div class="grid gap-2">
        <BaseCheckbox v-model="settings.enableSendToastDetection">启用发送阶段弹窗检测</BaseCheckbox>
        <BaseInput
          v-model.number="settings.sendToastWaitTimeout"
          label="发送弹窗等待超时"
          type="number"
          min="1000"
          hint="毫秒 (ms)"
          :disabled="!settings.enableSendToastDetection"
        />
      </div>

      <div class="grid gap-2">
        <BaseCheckbox v-model="settings.enableReplyToastDetection">启用回复阶段弹窗检测</BaseCheckbox>
        <BaseInput
          v-model.number="settings.replyToastWaitTimeout"
          label="回复弹窗等待超时"
          type="number"
          min="1000"
          hint="毫秒 (ms)"
          :disabled="!settings.enableReplyToastDetection"
        />
      </div>

      <div class="grid gap-2 border-t border-white/10 pt-2">
        <BaseCheckbox v-model="settings.useRawContent">导出/提取优先使用 raw 内容</BaseCheckbox>
        <BaseCheckbox v-model="settings.reloadOnChatChange">聊天切换时自动重载脚本</BaseCheckbox>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useNovelSettingsStore } from '../../stores/settings.store';
import BaseCheckbox from '../base/BaseCheckbox.vue';
import BaseInput from '../base/BaseInput.vue';

const settingsStore = useNovelSettingsStore();
const { settings } = storeToRefs(settingsStore);
</script>
