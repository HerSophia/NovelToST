<template>
  <div
    v-if="props.message"
    data-outline-message-preview-modal
    class="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 p-4"
    @click.self="emit('close')"
  >
    <div class="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
      <div class="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p class="text-sm font-medium text-white">消息全文</p>
          <p class="text-[11px] text-slate-400">{{ getRoleLabel(props.message.role) }} · {{ props.message.createdAt }}</p>
        </div>
        <BaseButton variant="ghost" data-outline-action="close-message-preview" @click="emit('close')">关闭</BaseButton>
      </div>

      <div class="max-h-[calc(85vh-68px)] overflow-y-auto p-4">
        <p class="text-sm break-words whitespace-pre-wrap text-slate-100">{{ props.message.text }}</p>

        <section v-if="props.message.role === 'assistant'" class="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-medium text-cyan-100">结构化 JSON</p>
            <p v-if="props.relatedSnapshot" class="text-[11px] text-cyan-200/70">来源：草案 #{{ props.relatedSnapshot.version }}</p>
          </div>

          <pre
            v-if="props.structuredJson"
            data-outline-message-preview-structured-json
            class="max-h-72 overflow-auto rounded-md border border-white/10 bg-black/30 p-2 text-[11px] text-cyan-50"
          >{{ props.structuredJson }}</pre>

          <p v-else data-outline-message-preview-structured-empty class="text-[11px] text-slate-400">
            本条 AI 回复未关联到可展示的结构化 JSON（可能本轮解析失败或未生成草案）。
          </p>
        </section>

        <section
          v-if="props.message.role === 'assistant' && (props.parseError || !props.structuredJson)"
          class="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3"
        >
          <p class="text-xs text-amber-100">⚠️ {{ props.parseError || '当前消息未生成可应用结构化结果。' }}</p>

          <div class="mt-2 flex flex-wrap items-center gap-2">
            <BaseButton
              variant="ghost"
              data-outline-action="toggle-raw-response-preview"
              @click="emit('toggle-raw-response-preview')"
            >
              {{ props.showRawResponse ? '隐藏未解析原数据' : '查看未能解析出来的原数据' }}
            </BaseButton>

            <BaseButton
              variant="ghost"
              data-outline-action="copy-raw-response-preview"
              :disabled="!props.rawResponse"
              @click="emit('copy-raw-response')"
            >
              复制原数据
            </BaseButton>
          </div>

          <pre
            v-if="props.showRawResponse && props.rawResponse"
            data-outline-message-preview-raw-response
            class="mt-2 max-h-72 overflow-auto rounded-md border border-amber-300/20 bg-black/30 p-2 text-[11px] text-amber-50"
          >{{ props.rawResponse }}</pre>

          <p
            v-else-if="props.showRawResponse"
            data-outline-message-preview-raw-response-empty
            class="mt-2 text-[11px] text-amber-200/80"
          >
            未捕获到原始响应数据，请重试该轮请求后再查看。
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '../../base/BaseButton.vue';
import type { OutlineMessage, OutlineSnapshot } from '../../../types/outline';

const props = withDefaults(
  defineProps<{
    message?: OutlineMessage | null;
    relatedSnapshot?: OutlineSnapshot | null;
    structuredJson?: string;
    parseError?: string;
    showRawResponse?: boolean;
    rawResponse?: string;
  }>(),
  {
    message: null,
    relatedSnapshot: null,
    structuredJson: '',
    parseError: '',
    showRawResponse: false,
    rawResponse: '',
  },
);

const emit = defineEmits<{
  close: [];
  'toggle-raw-response-preview': [];
  'copy-raw-response': [];
}>();

const getRoleLabel = (role: OutlineMessage['role']) => {
  if (role === 'assistant') {
    return '🤖 AI';
  }

  if (role === 'system') {
    return '⚙️ 系统';
  }

  return '🧑 你';
};
</script>
