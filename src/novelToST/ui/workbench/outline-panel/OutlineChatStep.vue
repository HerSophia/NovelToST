<template>
  <div data-outline-step="2-chat" class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
    <div class="mb-2 flex items-start justify-between gap-2">
      <div>
        <h3 class="text-sm font-medium text-white">与 AI 对话</h3>
        <p class="mt-0.5 text-[11px] text-slate-400">描述你的想法，AI 会生成或修改大纲草案</p>
      </div>

      <div class="flex items-center gap-2">
        <span
          v-if="props.aiBusyAction === 'outline_chat'"
          class="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 text-[11px] text-cyan-100"
        >
          ✍️ AI 正在构思…
        </span>

        <button
          type="button"
          data-outline-action="toggle-step-2-chat"
          class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
          :aria-expanded="!props.collapsed"
          aria-controls="outline-step-panel-2-chat"
          @click="emit('toggle-collapse')"
        >
          {{ props.collapsed ? '展开' : '收起' }}
        </button>
      </div>
    </div>

    <div
      v-show="!props.collapsed"
      id="outline-step-panel-2-chat"
      data-outline-step-content="2-chat"
      class="space-y-2"
    >
      <div
        data-outline-chat-list
        class="max-h-72 space-y-2 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-2"
      >
        <div v-if="props.activeMessages.length === 0" class="space-y-2 p-2 text-xs text-slate-400">
          <p>还没有消息。试试这样开始：</p>
          <ul class="space-y-1 text-slate-500">
            <li>💡 "我想写一个关于__的故事，主角是__"</li>
            <li>🎯 "请帮我把故事分成几个大的阶段"</li>
            <li>📝 "我已经有一个想法：__，请扩展成大纲"</li>
          </ul>
        </div>

        <button
          v-for="message in props.activeMessages"
          :key="message.id"
          data-outline-chat-message
          class="w-full rounded-md border px-2 py-1.5 text-left text-xs transition hover:bg-white/10"
          :class="getMessageClass(message.role)"
          type="button"
          @click="emit('open-message-preview', message)"
        >
          <p class="mb-1 text-[10px] font-medium opacity-80">{{ getRoleLabel(message.role) }}</p>
          <p class="break-words whitespace-pre-wrap">{{ message.text }}</p>
        </button>
      </div>

      <div class="space-y-2">
        <BaseTextarea
          v-model="chatInputModel"
          data-outline-chat-input
          :rows="3"
          label="你的想法"
          placeholder="描述故事构想、修改要求，或让 AI 细化某个部分…&#10;例如：我想写一个赛博朋克世界的复仇故事（输入 @ 可引用设定/故事线/节点/细纲/世界书）"
          @input="handleChatInput"
          @click="handleChatCaretChange"
          @focus="handleChatCaretChange"
          @keydown="handleChatKeydown"
          @compositionstart="handleChatCompositionStart"
          @compositionend="handleChatCompositionEnd"
        />

        <div
          v-if="props.selectedMentions.length > 0"
          data-outline-mention-chip-list
          class="flex flex-wrap items-center gap-1.5 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2"
        >
          <span class="text-[11px] text-cyan-100/80">本轮引用：</span>
          <span
            v-for="mention in props.selectedMentions"
            :key="`${mention.kind}:${mention.id}`"
            data-outline-mention-chip
            class="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[11px] text-cyan-50"
          >
            <span>{{ mention.label }}</span>
            <button
              type="button"
              data-outline-action="remove-outline-mention"
              class="text-cyan-200/80 transition hover:text-cyan-100"
              @click="emit('remove-mention', mention)"
            >
              ×
            </button>
          </span>
        </div>

        <div
          v-if="props.showMentionPopup"
          data-outline-mention-popup
          class="max-h-56 overflow-y-auto rounded-md border border-white/10 bg-slate-900/95 p-1"
        >
          <p class="px-1 py-1 text-[10px] text-slate-400">@{{ props.mentionQuery || '...' }} 的引用候选</p>

          <BaseSegmentedSelect
            class="mb-1 px-1"
            :model-value="props.activeSourceFilter"
            :options="mentionSourceFilterOptions"
            size="sm"
            group-data-attr-name="data-outline-mention-source-filter-group"
            item-data-attr-name="data-outline-mention-source-filter"
            @update:model-value="handleMentionSourceFilterModelUpdate"
          />

          <p v-if="props.mentionCandidates.length === 0" class="px-2 py-2 text-[11px] text-slate-500">当前来源没有匹配候选</p>

          <button
            v-for="(candidate, index) in props.mentionCandidates"
            :key="`${candidate.kind}:${candidate.id}`"
            type="button"
            :data-outline-mention-source-kind="candidate.kind"
            data-outline-mention-item
            class="w-full rounded-md border px-2 py-1.5 text-left text-xs transition"
            :class="index === props.activeMentionCandidateIndex ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-50' : 'border-transparent text-slate-200 hover:border-white/10 hover:bg-white/5'"
            @mousedown.prevent="emit('apply-mention-candidate', candidate)"
          >
            <p class="font-medium">{{ candidate.label }}</p>
            <p class="mt-0.5 text-[11px] text-slate-400">{{ getOutlineMentionKindLabel(candidate.kind) }} · {{ candidate.description }}</p>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <BaseButton
          variant="primary"
          data-outline-action="send-chat"
          :disabled="!props.canRunOutlineChat"
          @click="emit('send-chat')"
        >
          {{ props.aiBusyAction === 'outline_chat' ? '构思中…' : '💬 发送' }}
        </BaseButton>

        <BaseButton
          variant="ghost"
          data-outline-action="retry-last-chat-request"
          :disabled="!props.canRetryLastChatRequest"
          @click="emit('retry-last-chat-request')"
        >
          🔁 重试上一次
        </BaseButton>

        <BaseButton
          variant="ghost"
          data-outline-action="delete-last-chat-request"
          :disabled="!props.canDeleteLastChatRequest"
          @click="emit('delete-last-chat-request')"
        >
          🗑 删除上一次
        </BaseButton>
      </div>

      <WorkbenchConversationFeedback
        data-outline-parse-warning
        :warning-text="props.lastOutlineChatParseError"
        safety-text="放心，现有的大纲数据不会被覆盖。你可以重新描述需求让 AI 再试一次。"
        @clear="emit('clear-parse-warning')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { OutlineMentionCandidate } from '../../../core/outline-mention.service';
import type { OutlineMentionRef, OutlineMessage } from '../../../types/outline';
import BaseButton from '../../base/BaseButton.vue';
import BaseTextarea from '../../base/BaseTextarea.vue';
import BaseSegmentedSelect from '../../base/BaseSegmentedSelect.vue';
import WorkbenchConversationFeedback from '../shared/WorkbenchConversationFeedback.vue';
import {
  type WorkbenchMentionSourceFilter,
  type WorkbenchMentionSourceFilterId,
} from '../shared/mention-source-filter';
import { getWorkbenchMentionKindLabel } from '../shared/mention-kind-label';

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
    aiBusyAction?: string | null;
    activeMessages?: OutlineMessage[];
    chatInput?: string;
    selectedMentions?: OutlineMentionRef[];
    mentionCandidates?: OutlineMentionCandidate[];
    sourceFilters?: WorkbenchMentionSourceFilter[];
    activeSourceFilter?: WorkbenchMentionSourceFilterId;
    showMentionPopup?: boolean;
    activeMentionCandidateIndex?: number;
    mentionQuery?: string;
    canRunOutlineChat?: boolean;
    canRetryLastChatRequest?: boolean;
    canDeleteLastChatRequest?: boolean;
    lastOutlineChatParseError?: string | null;
  }>(),
  {
    collapsed: false,
    aiBusyAction: null,
    activeMessages: () => [],
    chatInput: '',
    selectedMentions: () => [],
    mentionCandidates: () => [],
    sourceFilters: () => [],
    activeSourceFilter: 'all',
    showMentionPopup: false,
    activeMentionCandidateIndex: 0,
    mentionQuery: '',
    canRunOutlineChat: false,
    canRetryLastChatRequest: false,
    canDeleteLastChatRequest: false,
    lastOutlineChatParseError: null,
  },
);

const emit = defineEmits<{
  'toggle-collapse': [];
  'update:chatInput': [value: string];
  'chat-input': [event: Event];
  'chat-caret-change': [event: Event];
  'chat-keydown': [event: KeyboardEvent];
  'chat-composition-start': [];
  'chat-composition-end': [event: CompositionEvent];
  'remove-mention': [mention: OutlineMentionRef];
  'switch-mention-source-filter': [filterId: WorkbenchMentionSourceFilterId];
  'apply-mention-candidate': [candidate: OutlineMentionCandidate];
  'send-chat': [];
  'retry-last-chat-request': [];
  'delete-last-chat-request': [];
  'clear-parse-warning': [];
  'open-message-preview': [message: OutlineMessage];
}>();

const chatInputModel = computed({
  get: () => props.chatInput,
  set: value => emit('update:chatInput', value),
});

const mentionSourceFilterOptions = computed(() => {
  return props.sourceFilters.map(filter => ({
    value: filter.id,
    label: filter.label,
  }));
});

const getOutlineMentionKindLabel = getWorkbenchMentionKindLabel;

const handleChatInput = (event: Event) => {
  emit('chat-input', event);
};

const handleChatCaretChange = (event: Event) => {
  emit('chat-caret-change', event);
};

const handleChatKeydown = (event: KeyboardEvent) => {
  emit('chat-keydown', event);
};

const handleChatCompositionStart = () => {
  emit('chat-composition-start');
};

const handleChatCompositionEnd = (event: CompositionEvent) => {
  emit('chat-composition-end', event);
};

const handleMentionSourceFilterModelUpdate = (value: string | number) => {
  if (typeof value !== 'string') {
    return;
  }

  if (!props.sourceFilters.some(filter => filter.id === value)) {
    return;
  }

  emit('switch-mention-source-filter', value as WorkbenchMentionSourceFilterId);
};

const getRoleLabel = (role: OutlineMessage['role']) => {
  if (role === 'assistant') {
    return '🤖 AI';
  }

  if (role === 'system') {
    return '⚙️ 系统';
  }

  return '🧑 你';
};

const getMessageClass = (role: OutlineMessage['role']) => {
  if (role === 'assistant') {
    return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-50';
  }

  if (role === 'system') {
    return 'border-amber-400/30 bg-amber-500/10 text-amber-50';
  }

  return 'border-white/10 bg-white/5 text-slate-100';
};
</script>
