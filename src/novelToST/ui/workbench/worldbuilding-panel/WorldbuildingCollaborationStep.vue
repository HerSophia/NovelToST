<template>
  <div
    class="space-y-2 rounded-lg border border-white/10 bg-slate-900/70 p-3"
    data-worldbuilding-step="2-collaboration"
  >
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.12em] text-emerald-200 uppercase">步骤 2</p>
        <h3 class="mt-1 text-sm font-medium text-white">和 AI 对话协作</h3>
      </div>

      <div class="flex items-center gap-2">
        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="toggle-step-2-collaboration"
          class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
          :aria-expanded="!props.collapsed"
          aria-controls="worldbuilding-step-panel-2-collaboration"
          @click="emit('toggle-collapse')"
        >
          {{ props.collapsed ? '展开' : '收起' }}
        </BaseButton>

        <HelpTriggerButton
          topic="worldbuilding"
          title="查看对话协作帮助"
          data-worldbuilding-help-trigger="2-collaboration"
          @trigger="emit('open-help')"
        />
      </div>
    </div>

    <div
      v-show="!props.collapsed"
      id="worldbuilding-step-panel-2-collaboration"
      data-worldbuilding-step-content="2-collaboration"
      class="space-y-2"
    >
      <p class="text-xs text-slate-400">输入你的需求，按扩写 / 精修 / 一致性检查推进，再生成候选条目。</p>

      <div class="rounded-lg border border-white/10 bg-black/10 p-3" data-worldbuilding-chat>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span
              v-if="props.aiBusy"
              data-worldbuilding-ai-busy
              class="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 text-[11px] text-cyan-100"
            >
              AI 正在处理：{{ props.aiBusyAction }}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <BaseButton
              type="button"
              variant="ghost"
              data-worldbuilding-action="refresh-hints"
              class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
              @click="emit('refresh-hints')"
            >
              刷新协作提示
            </BaseButton>

            <BaseButton
              type="button"
              variant="ghost"
              data-worldbuilding-action="clear-messages"
              class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="props.activeMessages.length === 0"
              @click="emit('clear-messages')"
            >
              清空本会话对话
            </BaseButton>
          </div>
        </div>

        <WorkbenchConversationMessages
          data-worldbuilding-chat-list
          class="mt-2"
          :messages="conversationMessages"
          max-height="lg"
          empty-text="还没有消息。先写需求，再点下方动作。"
        />

        <WorkbenchConversationComposer
          :model-value="props.messageInput"
          data-worldbuilding-input
          :rows="3"
          label="你的想法"
          placeholder="描述你希望 AI 补充或修改的内容…（输入 @ 可引用设定/故事线/节点/细纲/世界书）"
          hint=""
          class="mt-2"
          @update:model-value="(value: string) => emit('update:messageInput', value)"
          @input="handleChatInput"
          @caret-change="handleChatCaretChange"
          @keydown="handleChatKeydown"
          @composition-start="handleChatCompositionStart"
          @composition-end="handleChatCompositionEnd"
        />

        <div
          v-if="props.selectedMentions.length > 0"
          data-worldbuilding-mention-chip-list
          class="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2"
        >
          <span class="text-[11px] text-cyan-100/80">本轮引用</span>
          <span
            v-for="mention in props.selectedMentions"
            :key="`${mention.kind}:${mention.id}`"
            data-worldbuilding-mention-chip
            class="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[11px] text-cyan-50"
          >
            <span>{{ mention.label }}</span>
            <BaseButton
              type="button"
              variant="ghost"
              data-worldbuilding-action="remove-mention"
              class="min-h-0 border-0 bg-transparent p-0 text-cyan-200/80 transition hover:bg-transparent hover:text-cyan-100"
              @click="emit('remove-mention', mention)"
            >
              ✕
            </BaseButton>
          </span>
        </div>

        <div
          v-if="props.showMentionPopup"
          data-worldbuilding-mention-popup
          class="mt-2 max-h-56 overflow-y-auto rounded-md border border-white/10 bg-slate-900/95 p-1"
        >
          <p class="px-1 py-1 text-[10px] text-slate-400">@{{ props.mentionQuery || '...' }} 的引用候选</p>

          <BaseSegmentedSelect
            class="mb-1 px-1"
            :model-value="props.activeSourceFilter"
            :options="mentionSourceFilterOptions"
            size="sm"
            group-data-attr-name="data-worldbuilding-mention-source-filter-group"
            item-data-attr-name="data-worldbuilding-mention-source-filter"
            @update:model-value="handleMentionSourceFilterModelUpdate"
          />

          <p v-if="props.mentionCandidates.length === 0" class="px-2 py-2 text-[11px] text-slate-500">
            当前没有匹配候选
          </p>
          <BaseButton
            v-for="(candidate, index) in props.mentionCandidates"
            :key="`${candidate.kind}:${candidate.id}`"
            :data-worldbuilding-mention-kind="candidate.kind"
            data-worldbuilding-mention-item
            type="button"
            variant="ghost"
            block
            class="justify-start rounded-md px-2 py-1.5 text-left text-xs transition"
            :class="
              index === props.activeMentionCandidateIndex
                ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-50'
                : 'border-transparent text-slate-200 hover:border-white/10 hover:bg-white/5'
            "
            @mousedown.prevent="emit('apply-mention-candidate', candidate)"
          >
            <span class="w-full min-w-0">
              <p class="font-medium">{{ candidate.label }}</p>
              <p class="mt-0.5 text-[11px] text-slate-400">{{ getWorldbuildingMentionKindLabel(candidate.kind) }} · {{ candidate.description }}</p>
            </span>
          </BaseButton>
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <BaseButton
            type="button"
            variant="ghost"
            data-worldbuilding-action="expand"
            class="rounded-md border border-cyan-400/60 bg-cyan-500/20 px-2 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!props.canRunDraftActions"
            @click="emit('run-expand')"
          >
            {{ props.aiBusyAction === 'expand' ? '扩写中...' : '继续扩写' }}
          </BaseButton>

          <BaseButton
            type="button"
            variant="ghost"
            data-worldbuilding-action="refine"
            class="rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2 py-1 text-xs text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!props.canRunDraftActions"
            @click="emit('run-refine')"
          >
            {{ props.aiBusyAction === 'refine' ? '精修中...' : '精修表达' }}
          </BaseButton>

          <BaseButton
            type="button"
            variant="ghost"
            data-worldbuilding-action="consistency"
            class="rounded-md border border-amber-400/60 bg-amber-500/20 px-2 py-1 text-xs text-amber-100 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!props.canRunDraftActions"
            @click="emit('run-consistency')"
          >
            {{ props.aiBusyAction === 'consistency' ? '检查中...' : '一致性检查' }}
          </BaseButton>

          <BaseButton
            type="button"
            variant="ghost"
            data-worldbuilding-action="generate-candidates"
            class="rounded-md border border-violet-400/60 bg-violet-500/20 px-2 py-1 text-xs text-violet-100 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!props.canRunCandidateAction"
            @click="emit('run-generate-candidates')"
          >
            {{ props.aiBusyAction === 'candidates' ? '生成中...' : '生成世界书条目' }}
          </BaseButton>
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <BaseButton
            variant="ghost"
            data-worldbuilding-action="retry-last-round"
            class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!props.canRetryLastRound"
            @click="emit('retry-last-round')"
          >
            🔁 重试上一次
          </BaseButton>

          <BaseButton
            variant="ghost"
            data-worldbuilding-action="delete-last-round"
            class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!props.canDeleteLastRound"
            @click="emit('delete-last-round')"
          >
            🗑 删除上一次
          </BaseButton>
        </div>

        <WorkbenchConversationFeedback
          data-worldbuilding-parse-warning
          class="mt-2"
          :warning-text="props.lastParseWarning"
          safety-text="当前草案不会被覆盖。你可以重新描述需求让 AI 再试一次。"
          @clear="emit('clear-parse-warning')"
        />

        <div
          v-if="props.lastConsistencyIssues.length > 0"
          data-worldbuilding-consistency-issues
          class="mt-2 rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-xs text-amber-100"
        >
          <p class="font-medium">一致性提醒（建议先处理再提交）：</p>
          <ul class="mt-1 list-disc space-y-0.5 pl-4">
            <li v-for="(issue, index) in props.lastConsistencyIssues" :key="`issue-${index}`">{{ issue }}</li>
          </ul>
        </div>

        <div class="mt-3 rounded-lg border border-white/10 bg-slate-900/70 p-3">
          <h3 class="text-xs font-medium tracking-[0.08em] text-slate-300 uppercase">
            协作提示（预设 / 角色卡）
          </h3>
          <ul class="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-300">
            <li v-for="(hint, index) in props.collaborationHints" :key="`hint-${index}`">{{ hint }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HelpTriggerButton from '../../components/help/HelpTriggerButton.vue';
import BaseButton from '../../base/BaseButton.vue';
import type { OutlineMentionCandidate } from '../../../core/outline-mention.service';
import BaseSegmentedSelect from '../../base/BaseSegmentedSelect.vue';
import type { OutlineMentionRef } from '../../../types/outline';
import type { WorldbuildingAIBusyAction, WorldbuildingMessage } from '../../../types/worldbuilding';
import type {
  WorkbenchMentionSourceFilter,
  WorkbenchMentionSourceFilterId,
} from '../shared/mention-source-filter';
import { getWorkbenchMentionKindLabel } from '../shared/mention-kind-label';
import WorkbenchConversationComposer from '../shared/WorkbenchConversationComposer.vue';
import WorkbenchConversationFeedback from '../shared/WorkbenchConversationFeedback.vue';
import WorkbenchConversationMessages from '../shared/WorkbenchConversationMessages.vue';
import type { ConversationMessageVM } from '../../../types/workbench-conversation';

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
    aiBusy?: boolean;
    aiBusyAction?: WorldbuildingAIBusyAction | null;
    activeMessages?: WorldbuildingMessage[];
    messageInput?: string;
    selectedMentions?: OutlineMentionRef[];
    mentionCandidates?: OutlineMentionCandidate[];
    sourceFilters?: WorkbenchMentionSourceFilter[];
    activeSourceFilter?: WorkbenchMentionSourceFilterId;
    showMentionPopup?: boolean;
    activeMentionCandidateIndex?: number;
    mentionQuery?: string;
    canRunDraftActions?: boolean;
    canRunCandidateAction?: boolean;
    lastParseWarning?: string | null;
    canRetryLastRound?: boolean;
    canDeleteLastRound?: boolean;
    lastConsistencyIssues?: string[];
    collaborationHints?: string[];
  }>(),
  {
    collapsed: false,
    aiBusy: false,
    aiBusyAction: null,
    activeMessages: () => [],
    messageInput: '',
    selectedMentions: () => [],
    mentionCandidates: () => [],
    sourceFilters: () => [],
    activeSourceFilter: 'all',
    showMentionPopup: false,
    activeMentionCandidateIndex: 0,
    mentionQuery: '',
    canRunDraftActions: false,
    canRunCandidateAction: false,
    lastParseWarning: null,
    canRetryLastRound: false,
    canDeleteLastRound: false,
    lastConsistencyIssues: () => [],
    collaborationHints: () => [],
  },
);

const emit = defineEmits<{
  'toggle-collapse': [];
  'open-help': [];
  'refresh-hints': [];
  'clear-messages': [];
  'update:messageInput': [value: string];
  'chat-input': [event: Event];
  'chat-caret-change': [event: Event];
  'chat-keydown': [event: KeyboardEvent];
  'chat-composition-start': [];
  'chat-composition-end': [event: CompositionEvent];
  'remove-mention': [mention: OutlineMentionRef];
  'switch-mention-source-filter': [filterId: WorkbenchMentionSourceFilterId];
  'apply-mention-candidate': [candidate: OutlineMentionCandidate];
  'run-expand': [];
  'run-refine': [];
  'run-consistency': [];
  'run-generate-candidates': [];
  'retry-last-round': [];
  'delete-last-round': [];
  'clear-parse-warning': [];
}>();

const mentionSourceFilterOptions = computed(() => {
  return props.sourceFilters.map(filter => ({
    value: filter.id,
    label: filter.label,
  }));
});

const getWorldbuildingMentionKindLabel = getWorkbenchMentionKindLabel;

const conversationMessages = computed<ConversationMessageVM[]>(() =>
  props.activeMessages.map(m => ({ id: m.id, role: m.role, text: m.text })),
);

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
</script>
