<template>
  <section data-foundation-chat class="space-y-3 rounded-lg border border-white/10 bg-slate-900/70 p-3">
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.12em] text-indigo-200 uppercase">AI 协作</p>
        <h3 class="mt-1 text-sm font-medium text-white">让 AI 帮你补故事基底</h3>
      </div>

      <HelpTriggerButton
        topic="foundation"
        title="查看故事基底帮助"
        data-foundation-help-trigger="chat"
        @trigger="emit('open-help')"
      />
    </div>

    <p class="text-xs text-slate-400">写清你这一轮想补什么。可以让 AI 看整体，也可以只补某一块。AI 会优先补最影响起步的内容，并尽量把结果写成可以直接放进表单的内容。</p>

    <div class="flex flex-wrap items-center gap-2">
      <span
        v-if="props.aiBusy"
        data-foundation-ai-busy
        class="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 text-[11px] text-cyan-100"
      >
        AI 正在处理：{{ busyLabel }}
      </span>

      <BaseButton
        type="button"
        variant="ghost"
        data-foundation-action="clear-messages"
        class="ml-auto rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="props.messages.length === 0"
        @click="emit('clear-messages')"
      >
        清空记录
      </BaseButton>
    </div>

    <div class="rounded-md border border-white/10 bg-black/20 p-2">
      <p class="mb-1 text-[11px] text-slate-400">常用提问</p>
      <div class="flex flex-wrap gap-1.5">
        <BaseButton
          v-for="prompt in quickPromptOptions"
          :key="prompt.id"
          type="button"
          variant="ghost"
          data-foundation-quick-prompt
          class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="props.aiBusy"
          @click="applyQuickPrompt(prompt.text)"
        >
          {{ prompt.label }}
        </BaseButton>
      </div>
    </div>

    <WorkbenchConversationMessages
      data-foundation-chat-list
      :messages="conversationMessages"
      max-height="lg"
      empty-text="还没有协作记录。你可以先说一句想写什么，或者点上面的常用提问。"
    />

    <WorkbenchConversationComposer
      :model-value="props.messageInput"
      data-foundation-input
      :rows="4"
      label="你的想法"
      placeholder="如：请先补题材、一句话故事和主角现在最想做什么。"
      hint="快捷键：Ctrl + Enter（Mac 为 Command + Enter）可直接执行整体协作。"
      @update:model-value="(value: string) => emit('update:message-input', value)"
      @submit="handleComposerSubmit"
    />

    <div class="flex flex-wrap items-center gap-2">
      <BaseButton
        type="button"
        variant="primary"
        data-foundation-action="collaborate"
        class="rounded-md border border-indigo-400/60 bg-indigo-500/20 px-2 py-1 text-xs text-indigo-100 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="props.aiBusy"
        @click="emit('run-collaborate')"
      >
        {{ props.aiBusy && props.aiBusyModuleId === null ? '处理中…' : '让 AI 看整体' }}
      </BaseButton>

      <BaseButton
        v-for="option in props.moduleOptions"
        :key="option.id"
        type="button"
        variant="ghost"
        :data-foundation-action="`module-assist-${option.id}`"
        class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="props.aiBusy"
        @click="emit('run-module-assist', option.id)"
      >
        {{ props.aiBusy && props.aiBusyModuleId === option.id ? `正在补${option.label}…` : `只补${option.label}` }}
      </BaseButton>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <BaseButton
        variant="ghost"
        data-foundation-action="retry-last-round"
        class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!props.canRetryLastRound"
        @click="emit('retry-last-round')"
      >
        🔁 重试上一次
      </BaseButton>

      <BaseButton
        variant="ghost"
        data-foundation-action="delete-last-round"
        class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!props.canDeleteLastRound"
        @click="emit('delete-last-round')"
      >
        🗑 删除上一次
      </BaseButton>
    </div>

    <WorkbenchConversationFeedback
      data-foundation-parse-warning
      :warning-text="props.lastParseWarning"
      safety-text="已填写的内容没有变化。你可以重新描述需求让 AI 再试一次。"
      @clear="emit('clear-parse-warning')"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseButton from '../../base/BaseButton.vue';
import HelpTriggerButton from '../../components/help/HelpTriggerButton.vue';
import WorkbenchConversationComposer from '../shared/WorkbenchConversationComposer.vue';
import WorkbenchConversationFeedback from '../shared/WorkbenchConversationFeedback.vue';
import WorkbenchConversationMessages from '../shared/WorkbenchConversationMessages.vue';
import type { FoundationMessage, FoundationModuleId } from '../../../types/foundation';
import type { ConversationMessageVM } from '../../../types/workbench-conversation';

type FoundationQuickPrompt = {
  id: string;
  label: string;
  text: string;
};

const quickPromptOptions: FoundationQuickPrompt[] = [
  {
    id: 'kickstart',
    label: '从零起步',
    text: '我现在只有一个模糊想法。请先帮我补题材、一句话故事和主角的基本信息。每项写得短一点，要能直接填进表单。',
  },
  {
    id: 'goal-and-cost',
    label: '补齐起步必填',
    text: '请先检查起步必填还有哪些缺口，优先补题材、一句话故事和主角现在最想做什么。默认只补最关键的几项。',
  },
  {
    id: 'core-logline',
    label: '打磨一句话故事',
    text: '请只打磨一句话故事。尽量用一句话写清：主角是谁、想做什么、最大的阻碍是什么。不要写成剧情简介。',
  },
  {
    id: 'consistency-check',
    label: '一致性检查',
    text: '请检查主角、对手、冲突和终局方向之间有没有冲突。如果有，请指出并给出可直接写回表单的修改。',
  },
  {
    id: 'endgame-constraint',
    label: '推进建议补充',
    text: '在不大改已有内容的前提下，请优先补关键关系、冲突结构和世界需求。要让后续大纲更容易往下走。',
  },
  {
    id: 'fill-gaps',
    label: '补空白字段',
    text: '请按“起步必填 → 建议补充 → 精细控制”的顺序，只补现在最需要的空白字段。没有把握的内容先不要硬填。',
  },
];

const props = withDefaults(
  defineProps<{
    messageInput?: string;
    aiBusy?: boolean;
    aiBusyModuleId?: FoundationModuleId | null;
    messages?: FoundationMessage[];
    lastParseWarning?: string | null;
    canRetryLastRound?: boolean;
    canDeleteLastRound?: boolean;
    moduleOptions?: Array<{ id: FoundationModuleId; label: string }>;
  }>(),
  {
    messageInput: '',
    aiBusy: false,
    aiBusyModuleId: null,
    messages: () => [],
    lastParseWarning: null,
    canRetryLastRound: false,
    canDeleteLastRound: false,
    moduleOptions: () => [],
  },
);

const emit = defineEmits<{
  'update:message-input': [value: string];
  'run-collaborate': [];
  'run-module-assist': [moduleId: FoundationModuleId];
  'clear-messages': [];
  'retry-last-round': [];
  'delete-last-round': [];
  'clear-parse-warning': [];
  'open-help': [];
}>();

const busyLabel = computed(() => {
  if (props.aiBusyModuleId === null) {
    return '整体';
  }

  const target = props.moduleOptions.find(option => option.id === props.aiBusyModuleId);
  return target?.label ?? props.aiBusyModuleId;
});

const conversationMessages = computed<ConversationMessageVM[]>(() =>
  props.messages.map(m => ({ id: m.id, role: m.role, text: m.text })),
);

const handleComposerSubmit = () => {
  if (props.aiBusy) {
    return;
  }

  emit('run-collaborate');
};

const applyQuickPrompt = (text: string) => {
  const base = props.messageInput.trim();
  if (!base) {
    emit('update:message-input', text);
    return;
  }

  emit('update:message-input', `${base}\n${text}`);
};
</script>
