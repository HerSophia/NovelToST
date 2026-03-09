<template>
  <div
    data-conversation-messages
    class="space-y-2 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-2"
    :class="maxHeightClass"
  >
    <p v-if="props.messages.length === 0" class="text-xs text-slate-500">
      {{ props.emptyText }}
    </p>

    <div
      v-for="message in props.messages"
      :key="message.id"
      data-conversation-message
      class="rounded-md border px-2 py-1.5 text-xs"
      :class="getMessageClass(message.role)"
    >
      <p class="mb-1 text-[10px] opacity-80">{{ getRoleLabel(message.role) }}</p>
      <p class="break-words whitespace-pre-wrap">{{ message.text }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ConversationMessageRole, ConversationMessageVM } from '../../../types/workbench-conversation';

const props = withDefaults(
  defineProps<{
    messages?: ConversationMessageVM[];
    emptyText?: string;
    maxHeight?: 'sm' | 'md' | 'lg';
  }>(),
  {
    messages: () => [],
    emptyText: '还没有对话记录。',
    maxHeight: 'md',
  },
);

const maxHeightClass = computed(() => {
  if (props.maxHeight === 'sm') return 'max-h-48';
  if (props.maxHeight === 'lg') return 'max-h-72';
  return 'max-h-64';
});

const getRoleLabel = (role: ConversationMessageRole): string => {
  if (role === 'assistant') return '🤖 AI';
  if (role === 'system') return '⚙️ 系统';
  return '🧑 你';
};

const getMessageClass = (role: ConversationMessageRole): string => {
  if (role === 'assistant') return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-50';
  if (role === 'system') return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  return 'border-white/10 bg-white/5 text-slate-100';
};
</script>
