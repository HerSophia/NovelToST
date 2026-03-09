<template>
  <section data-workbench-outline-panel class="space-y-3">
    <!-- ═══ 顶部介绍 ═══ -->
    <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="font-semibold">📖 大纲工坊</p>
          <p class="mt-1 text-emerald-100/90">
            通过对话让 AI 帮你构建故事骨架——故事线、剧情节点、阶段划分。每次 AI 产出的大纲会保存为「草案」，你可以随时预览和应用。
          </p>
        </div>

        <HelpTriggerButton
          topic="outline"
          title="查看大纲工坊帮助"
          data-outline-help-trigger="overview"
          @trigger="openOutlineHelp"
        />
      </div>
    </div>

    <!-- ═══ 全局开关 ═══ -->
    <div class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
      <div class="space-y-2">
        <BaseCheckbox :model-value="outlineStore.enabled" @update:model-value="value => outlineStore.setEnabled(Boolean(value))">
          启用大纲辅助写作
        </BaseCheckbox>
        <p class="pl-5 text-[11px] text-slate-400">开启后，AI 续写时会自动参考大纲内容来保持剧情一致。</p>

        <BaseDropdownSelect
          :model-value="outlineStore.missingDetailPolicy"
          label="缺少章节细纲时"
          :options="missingDetailPolicyOptions"
          hint="控制在续写时找不到当前章节的细纲时如何处理"
          data-outline-missing-detail-policy-select
          list-data-attr-name="data-outline-missing-detail-policy-list"
          item-data-attr-name="data-outline-missing-detail-policy-option"
          @update:model-value="handlePolicyChange"
        />
      </div>
    </div>

    <!-- ═══ 大纲规划 ═══ -->
    <div data-outline-planning class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-white">📊 大纲规划</h3>

        <div class="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
          <BaseInput
            :model-value="outlineStore.totalChapterTarget"
            type="number"
            :min="0"
            label="目标总章数"
            data-outline-total-chapter-target
            @update:model-value="handleTotalChapterTargetChange"
/>
          <p class="self-end pb-2 text-[11px] text-slate-400">
            设为 0 时使用全局设置的章数（当前生效 {{ chapterCount }} 章）。
          </p>
        </div>

        <BaseTextarea
          :model-value="outlineStore.synopsis"
          :rows="2"
          label="故事梗概"
          placeholder="用几句话概括整个故事的核心情节…"
          data-outline-synopsis
          @update:model-value="handleSynopsisChange"
        />

        <p v-if="outlineStore.foundationSyncInfo" data-outline-foundation-sync-info class="text-[11px] text-slate-400">
          🔗 上次同步故事基底：{{ outlineStore.foundationSyncInfo.syncedAt }}
        </p>
      </div>
    </div>

    <!-- ═══ 主体：对话 + 内容区 ═══ -->
    <div class="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
      <OutlineSessionSidebar
        v-model:session-title="sessionTitleInput"
        v-model:session-seed="sessionSeedInput"
        :sessions="outlineChatSessions"
        :active-session-id="activeOutlineChatSession?.id ?? null"
        @create-session="createSession"
        @select-session="setActiveOutlineChatSession"
      />

      <!-- ──── 右栏：内容区 ──── -->
      <div class="space-y-3">
        <!-- 未选择对话时的引导 -->
        <div
          v-if="!activeOutlineChatSession"
          data-outline-empty
          class="rounded-xl border border-dashed border-white/15 bg-slate-900/40 p-6 text-center"
        >
          <p class="text-sm text-slate-300">👈 选择左侧的对话，或创建一个新对话开始</p>
          <p class="mt-2 text-xs text-slate-500">在对话中告诉 AI 你的故事构想，它会帮你生成结构化的大纲草案。</p>
        </div>

        <template v-else>
          <OutlineChatStep
            v-model:chat-input="outlineChatInput"
            :collapsed="isStepCollapsed('2-chat')"
            :ai-busy-action="aiBusyAction"
            :active-messages="activeOutlineChatMessages"
            :selected-mentions="selectedOutlineMentions"
            :mention-candidates="outlineMentionCandidates"
            :source-filters="outlineMentionSourceFilters"
            :active-source-filter="activeOutlineMentionSourceFilter"
            :show-mention-popup="showOutlineMentionPopup"
            :active-mention-candidate-index="activeOutlineMentionCandidateIndex"
            :mention-query="outlineMentionQuery"
            :can-run-outline-chat="canRunOutlineChat"
            :can-retry-last-chat-request="canRetryLastOutlineChatRequest"
            :can-delete-last-chat-request="canDeleteLastOutlineChatRequest"
            :last-outline-chat-parse-error="lastOutlineChatParseError"
            @toggle-collapse="toggleStepCollapse('2-chat')"
            @chat-input="handleOutlineChatInput"
            @chat-caret-change="handleOutlineChatCaretChange"
            @chat-keydown="handleOutlineChatInputKeydown"
            @chat-composition-start="handleOutlineChatCompositionStart"
            @chat-composition-end="handleOutlineChatCompositionEnd"
            @remove-mention="removeOutlineMention"
            @switch-mention-source-filter="switchOutlineMentionSourceFilter"
            @apply-mention-candidate="applyOutlineMentionCandidate"
            @send-chat="sendChatRound"
            @retry-last-chat-request="retryLastChatRequest"
            @delete-last-chat-request="requestDeleteLastChatRequest"
            @clear-parse-warning="clearOutlineChatParseError"
            @open-message-preview="openMessagePreview"
          />

          <!-- 待确认的故事基底修改建议 -->
          <div
            v-if="hasPendingFoundationPatch"
            data-outline-pending-foundation-patch
            class="rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-3"
          >
            <p class="text-xs font-medium text-indigo-100">💡 AI 建议修改故事基底</p>
            <p class="mt-1 text-[11px] text-indigo-200/80">
              大纲对话中 AI 提出了对故事基底的修改建议。你可以选择接受写入或忽略。
            </p>
            <div class="mt-2 flex items-center gap-2">
              <BaseButton variant="primary" data-outline-action="accept-foundation-patch" @click="acceptFoundationPatch">
                ✅ 接受修改
              </BaseButton>
              <BaseButton variant="ghost" data-outline-action="reject-foundation-patch" @click="rejectFoundationPatch">
                忽略
              </BaseButton>
            </div>
          </div>

          <OutlineSnapshotStep
            :collapsed="isStepCollapsed('3-snapshot')"
            :snapshots="activeOutlineChatSnapshots"
            :active-snapshot-id="activeOutlineChatSnapshot?.id ?? null"
            :active-snapshot="activeOutlineChatSnapshot"
            :active-snapshot-detail-chapter-count="activeSnapshotDetailChapterCount"
            :applied-snapshot-id="activeOutlineChatSession?.appliedSnapshotId ?? null"
            @toggle-collapse="toggleStepCollapse('3-snapshot')"
            @select-snapshot="selectSnapshot"
            @apply-snapshot-safe="applySnapshotSafely"
          />
        </template>

        <OutlineNodeEditorStep
          :collapsed="isStepCollapsed('4-node-edit')"
          :storylines="outlineStore.sortedStorylines"
          :master-outline-nodes="outlineStore.sortedMasterOutline"
          :selected-storyline="selectedStoryline"
          :show-selected-storyline-detail="showSelectedStorylineDetail"
          :filtered-master-outline-nodes="filteredMasterOutlineNodes"
          :locked-storyline-ids="outlineStore.lockedStorylineIds"
          :locked-node-ids="outlineStore.lockedNodeIds"
          @toggle-collapse="toggleStepCollapse('4-node-edit')"
          @open-help="openOutlineHelp"
          @append-storyline="appendStoryline"
          @select-storyline="selectStoryline"
          @toggle-storyline-detail="toggleStorylineDetail"
          @patch-storyline-text="patchStorylineText"
          @patch-storyline-type="patchStorylineType"
          @patch-storyline-status="patchStorylineStatus"
          @remove-selected-storyline="removeSelectedStoryline"
          @append-node="appendNode"
          @patch-master-node-text="patchMasterNodeText"
          @patch-master-node-chapter="patchMasterNodeChapter"
          @patch-master-node-status="patchMasterNodeStatus"
          @patch-master-node-storyline="patchMasterNodeStoryline"
          @patch-master-node-phase="patchMasterNodePhase"
          @patch-master-turning-points="patchMasterTurningPoints"
          @patch-master-node-list-field="patchMasterNodeListField"
          @patch-storyline-list-field="patchStorylineListField"
          @patch-master-node-tension-level="patchMasterNodeTensionLevel"
          @remove-master-node="outlineStore.removeMasterOutlineNode"
          @toggle-storyline-lock="outlineStore.toggleStorylineLock"
          @toggle-node-lock="outlineStore.toggleNodeLock"
        />

        <!-- ── 细纲工坊占位 ── -->
        <div data-outline-step="5-detail-placeholder" class="rounded-xl border border-dashed border-white/20 bg-slate-900/45 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-medium text-slate-300">🔮 细纲工坊</h3>
              <p class="mt-0.5 text-[11px] text-slate-400">将在后续版本中支持——按节点逐章生成详细细纲。</p>
            </div>

            <BaseButton variant="ghost" data-outline-action="open-detail-workshop" :disabled="true">即将推出</BaseButton>
          </div>
        </div>
      </div>
    </div>

    <OutlineCompatToolsBlock
      :ai-busy-action="aiBusyAction"
      :can-generate-master-outline="canGenerateMasterOutline"
      :can-derive-details="canDeriveDetails"
      @generate-master="generateMaster"
      @derive-details="deriveDetails"
      @open-help="openOutlineHelp"
    />

    <OutlineMessagePreviewModal
      :message="previewMessage"
      :related-snapshot="previewMessageRelatedSnapshot"
      :structured-json="previewMessageStructuredJson"
      :parse-error="previewMessageParseError"
      :show-raw-response="showRawResponseInPreview"
      :raw-response="previewMessageRawResponse"
      @close="closeMessagePreview"
      @toggle-raw-response-preview="toggleRawResponsePreview"
      @copy-raw-response="copyPreviewRawResponse"
    />

    <OutlineSnapshotStructuredModal :snapshot="previewSnapshot" :snapshot-details="previewSnapshotDetails" @close="closeSnapshotPreview" />

    <FoundationGenerationReminderModal
      :state="foundationGenerationReminder"
      @close="cancelFoundationGenerationReminder"
      @confirm="confirmFoundationGenerationReminder"
    />

    <OutlineDeleteLastChatRequestModal
      :open="showDeleteLastChatRequestModal"
      @close="cancelDeleteLastChatRequest"
      @confirm="confirmDeleteLastChatRequest"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useOutlineControl } from '../../composables/useOutlineControl';
import { useStepCollapse } from './composables/useStepCollapse';
import { useWorkbenchMentionInput } from './composables/useWorkbenchMentionInput';
import { useFoundationStore } from '../../stores/foundation.store';
import { useOutlineStore } from '../../stores/outline.store';
import type {
  MasterOutlineNode,
  NarrativePhase,
  OutlineMessage,
  OutlineMissingDetailPolicy,
  OutlineNodeStatus,
  Storyline,
  OutlineSnapshot,
  StorylineType,
} from '../../types/outline';
import BaseButton from '../base/BaseButton.vue';
import BaseCheckbox from '../base/BaseCheckbox.vue';
import BaseDropdownSelect from '../base/BaseDropdownSelect.vue';
import BaseInput from '../base/BaseInput.vue';
import BaseTextarea from '../base/BaseTextarea.vue';
import OutlineChatStep from './outline-panel/OutlineChatStep.vue';
import OutlineCompatToolsBlock from './outline-panel/OutlineCompatToolsBlock.vue';
import OutlineMessagePreviewModal from './outline-panel/OutlineMessagePreviewModal.vue';
import OutlineNodeEditorStep from './outline-panel/OutlineNodeEditorStep.vue';
import OutlineSessionSidebar from './outline-panel/OutlineSessionSidebar.vue';
import OutlineSnapshotStep from './outline-panel/OutlineSnapshotStep.vue';
import OutlineSnapshotStructuredModal from './outline-panel/OutlineSnapshotStructuredModal.vue';
import HelpTriggerButton from '../components/help/HelpTriggerButton.vue';
import FoundationGenerationReminderModal from './shared/FoundationGenerationReminderModal.vue';
import OutlineDeleteLastChatRequestModal from './shared/OutlineDeleteLastChatRequestModal.vue';
import type { HelpTopicId } from '../help/help-topics';

type OutlineStepId = '2-chat' | '3-snapshot' | '4-node-edit' | '5-detail-placeholder';

type OutlineStepCollapseState = Record<OutlineStepId, boolean>;

type OutlineMessageDebugMeta = {
  parseError: string;
  rawResponse: string;
};

const defaultStepCollapseState: OutlineStepCollapseState = {
  '2-chat': false,
  '3-snapshot': false,
  '4-node-edit': false,
  '5-detail-placeholder': false,
};

const emit = defineEmits<{
  (event: 'open-help', topic: HelpTopicId): void;
}>();

const outlineStore = useOutlineStore();
const foundationStore = useFoundationStore();
const {
  aiBusyAction,
  chapterCount,
  canGenerateMasterOutline,
  canDeriveDetails,
  canRunOutlineChat,
  canDeleteLastOutlineChatRequest,
  canRetryLastOutlineChatRequest,
  hasPendingFoundationPatch,
  acceptFoundationPatch,
  rejectFoundationPatch,
  outlineChatInput,
  lastOutlineChatParseError,
  foundationGenerationReminder,
  cancelFoundationGenerationReminder,
  confirmFoundationGenerationReminder,
  outlineChatSessions,
  activeOutlineChatSession,
  activeOutlineChatMessages,
  activeOutlineChatSnapshots,
  activeOutlineChatSnapshot,
  clearOutlineChatParseError,
  createOutlineChatSession,
  setActiveOutlineChatSession,
  setActiveOutlineChatSnapshot,
  runOutlineChatRound,
  applyOutlineSnapshot,
  deleteLastOutlineChatRequest,
  retryLastOutlineChatRequest,
  generateMaster,
  deriveDetails,
} = useOutlineControl();

const sessionTitleInput = ref('');
const sessionSeedInput = ref('');
const showDeleteLastChatRequestModal = ref(false);
const missingDetailPolicyOptions: Array<{ value: OutlineMissingDetailPolicy; label: string }> = [
  { value: 'warn_fallback', label: '提示并继续（用大纲代替，推荐）' },
  { value: 'strict_block', label: '阻止续写（需先补齐细纲）' },
];

const {
  isStepCollapsed,
  toggleStepCollapse,
} = useStepCollapse<OutlineStepId>(defaultStepCollapseState);
const previewMessage = ref<OutlineMessage | null>(null);
const previewSnapshot = ref<OutlineSnapshot | null>(null);
const selectedStorylineId = ref<string | null>(null);
const showRawResponseInPreview = ref(false);
const showSelectedStorylineDetail = ref(true);
const buildOutlineMentionContext = () => {
  return {
    foundation: foundationStore.foundation,
    storylines: outlineStore.sortedStorylines,
    masterOutline: outlineStore.sortedMasterOutline,
    detailsByChapter: outlineStore.detailsByChapter,
    mentionConfig: outlineStore.mentionConfig,
  };
};

const {
  selectedMentions: selectedOutlineMentions,
  mentionCandidates: outlineMentionCandidates,
  sourceFilters: outlineMentionSourceFilters,
  activeSourceFilter: activeOutlineMentionSourceFilter,
  showMentionPopup: showOutlineMentionPopup,
  activeMentionCandidateIndex: activeOutlineMentionCandidateIndex,
  mentionQuery: outlineMentionQuery,
  switchMentionSourceFilter: switchOutlineMentionSourceFilter,
  applyMentionCandidate: applyOutlineMentionCandidate,
  removeMention: removeOutlineMention,
  handleInput: handleOutlineChatInput,
  handleCaretChange: handleOutlineChatCaretChange,
  handleInputKeydown: handleOutlineChatInputKeydown,
  handleCompositionStart: handleOutlineChatCompositionStart,
  handleCompositionEnd: handleOutlineChatCompositionEnd,
  resetMentionPopupState: resetOutlineMentionPopupState,
  buildMentionPayload: buildOutlineMentionPayload,
  resetMentionContextState: resetOutlineMentionContextState,
} = useWorkbenchMentionInput({
  modelValue: outlineChatInput,
  buildContext: buildOutlineMentionContext,
  searchLimit: 8,
});

const activeSnapshotDetailChapterCount = computed(() => {
  const snapshot = activeOutlineChatSnapshot.value;
  if (!snapshot) {
    return 0;
  }

  return Object.keys(snapshot.detailsByChapter).length;
});

const selectedStoryline = computed(() => {
  const storylineId = selectedStorylineId.value;
  if (!storylineId) {
    return null;
  }

  return outlineStore.sortedStorylines.find(storyline => storyline.id === storylineId) ?? null;
});

const filteredMasterOutlineNodes = computed(() => {
  const storyline = selectedStoryline.value;
  if (!storyline) {
    return [];
  }

  return outlineStore.sortedMasterOutline.filter(node => (node.storylineId ?? '') === storyline.id);
});

const previewSnapshotDetails = computed(() => {
  const snapshot = previewSnapshot.value;
  if (!snapshot) {
    return [];
  }
  return Object.values(snapshot.detailsByChapter).sort((left, right) => left.chapter - right.chapter);
});

const previewMessageRelatedSnapshot = computed<OutlineSnapshot | null>(() => {
  const message = previewMessage.value;
  const session = activeOutlineChatSession.value;
  if (!message || message.role !== 'assistant' || !session) {
    return null;
  }

  const messageIndex = session.messages.findIndex(item => item.id === message.id);
  if (messageIndex < 0) {
    return null;
  }

  const messageTimestamp = Date.parse(message.createdAt);
  const nextUserMessage = session.messages.slice(messageIndex + 1).find(item => item.role === 'user') ?? null;
  const nextUserTimestamp = nextUserMessage ? Date.parse(nextUserMessage.createdAt) : Number.NaN;

  const matchedSnapshot = session.snapshots.find(snapshot => {
    const snapshotTimestamp = Date.parse(snapshot.createdAt);
    if (!Number.isFinite(snapshotTimestamp)) {
      return false;
    }

    if (Number.isFinite(messageTimestamp) && snapshotTimestamp < messageTimestamp) {
      return false;
    }

    if (Number.isFinite(nextUserTimestamp) && snapshotTimestamp >= nextUserTimestamp) {
      return false;
    }

    return true;
  });

  return matchedSnapshot ?? null;
});

const previewMessageStructuredJson = computed(() => {
  const snapshot = previewMessageRelatedSnapshot.value;
  if (!snapshot) {
    return '';
  }

  return JSON.stringify({ storylines: snapshot.storylines, nodes: snapshot.masterOutline, detailsByChapter: snapshot.detailsByChapter }, null, 2);
});

const previewMessageDebugMeta = computed<OutlineMessageDebugMeta | null>(() => {
  const message = previewMessage.value;
  if (!message || message.role !== 'assistant') {
    return null;
  }

  const candidate = message as OutlineMessage & {
    parseError?: unknown;
    rawResponse?: unknown;
  };
  const parseError = typeof candidate.parseError === 'string' ? candidate.parseError.trim() : '';
  if (!parseError) {
    return null;
  }

  return {
    parseError,
    rawResponse: typeof candidate.rawResponse === 'string' ? candidate.rawResponse : '',
  };
});

const previewMessageParseError = computed(() => {
  return previewMessageDebugMeta.value?.parseError ?? '';
});

const previewMessageRawResponse = computed(() => {
  return previewMessageDebugMeta.value?.rawResponse ?? '';
});

const toggleRawResponsePreview = () => {
  showRawResponseInPreview.value = !showRawResponseInPreview.value;
};

const copyPreviewRawResponse = async () => {
  const text = previewMessageRawResponse.value;
  if (!text) {
    toastr.warning('暂无可复制的原始响应数据');
    return;
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toastr.success('已复制原始响应数据');
      return;
    }

    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toastr.success('已复制原始响应数据');
    }
  } catch {
    toastr.warning('复制失败，请手动选中原数据复制');
  }
};

const handlePolicyChange = (value: unknown) => {
  const policy = value === 'strict_block' ? 'strict_block' : 'warn_fallback';
  outlineStore.setMissingDetailPolicy(policy as OutlineMissingDetailPolicy);
};

const createSession = () => {
  const session = createOutlineChatSession({
    title: sessionTitleInput.value,
    seed: sessionSeedInput.value,
  });

  sessionTitleInput.value = '';
  sessionSeedInput.value = '';
  toastr.success(`已创建对话：${session.title || '未命名对话'}`);
};

const openOutlineHelp = () => {
  emit('open-help', 'outline');
};

const sendChatRound = async () => {
  const mentionPayload = buildOutlineMentionPayload();
  const result = await runOutlineChatRound({
    mentions: mentionPayload,
  });

  if (result) {
    selectedOutlineMentions.value = [];
    resetOutlineMentionPopupState();
  }
};

const requestDeleteLastChatRequest = () => {
  if (!canDeleteLastOutlineChatRequest.value) {
    return;
  }

  showDeleteLastChatRequestModal.value = true;
};

const cancelDeleteLastChatRequest = () => {
  showDeleteLastChatRequestModal.value = false;
};

const confirmDeleteLastChatRequest = () => {
  const sessionId = activeOutlineChatSession.value?.id ?? null;
  showDeleteLastChatRequestModal.value = false;

  if (!canDeleteLastOutlineChatRequest.value || !sessionId) {
    return;
  }

  deleteLastOutlineChatRequest(sessionId);
};

const retryLastChatRequest = async () => {
  await retryLastOutlineChatRequest(activeOutlineChatSession.value?.id ?? null);
};

const openMessagePreview = (message: OutlineMessage) => {
  previewMessage.value = message;
  showRawResponseInPreview.value = false;
};

const closeMessagePreview = () => {
  previewMessage.value = null;
  showRawResponseInPreview.value = false;
};

const selectSnapshot = (snapshot: OutlineSnapshot) => {
  const session = activeOutlineChatSession.value;
  if (!session) {
    return;
  }

  setActiveOutlineChatSnapshot(snapshot.id, session.id);
  previewSnapshot.value = snapshot;
};

const closeSnapshotPreview = () => {
  previewSnapshot.value = null;
};

const selectStoryline = (storylineId: string) => {
  const normalizedStorylineId = storylineId.trim();
  if (!normalizedStorylineId) {
    return;
  }

  if (selectedStorylineId.value === normalizedStorylineId) {
    showSelectedStorylineDetail.value = !showSelectedStorylineDetail.value;
    return;
  }

  selectedStorylineId.value = normalizedStorylineId;
  showSelectedStorylineDetail.value = true;
};

const toggleStorylineDetail = () => {
  if (!selectedStoryline.value) {
    return;
  }

  showSelectedStorylineDetail.value = !showSelectedStorylineDetail.value;
};

const removeSelectedStoryline = () => {
  const storyline = selectedStoryline.value;
  if (!storyline) {
    return;
  }

  outlineStore.removeStoryline(storyline.id);
  selectedStorylineId.value = null;
  showSelectedStorylineDetail.value = true;
};

const applySnapshotSafely = () => {
  const session = activeOutlineChatSession.value;
  const snapshot = activeOutlineChatSnapshot.value;
  if (!session || !snapshot) {
    toastr.warning('请先选择一个草案');
    return;
  }

  applyOutlineSnapshot(snapshot.id, {
    sessionId: session.id,
    applyDetails: false,
  });
};

watch(
  () => activeOutlineChatSession.value?.id ?? null,
  () => {
    previewMessage.value = null;
    showDeleteLastChatRequestModal.value = false;
    previewSnapshot.value = null;
    resetOutlineMentionContextState();
  },
);

watch(
  () => outlineStore.sortedStorylines.map(storyline => storyline.id),
  storylineIds => {
    if (!selectedStorylineId.value) {
      return;
    }
    if (!storylineIds.includes(selectedStorylineId.value)) {
      selectedStorylineId.value = null;
    }
  },
);

const appendStoryline = () => {
  outlineStore.createStoryline({
    title: `故事线 ${outlineStore.storylines.length + 1}`,
    type: outlineStore.storylines.some(line => line.type === 'main') ? 'subplot' : 'main',
    status: 'draft',
  });
};

const patchStorylineText = (storylineId: string, field: keyof Pick<Storyline, 'title' | 'description'>, value: unknown) => {
  const payload: Partial<Storyline> = {};
  payload[field] = String(value ?? '');
  outlineStore.patchStoryline(storylineId, payload);
};

const patchStorylineType = (storylineId: string, value: unknown) => {
  const normalized = String(value ?? '').trim();
  const type: StorylineType =
    normalized === 'main' || normalized === 'subplot' || normalized === 'parallel' ? normalized : 'subplot';

  outlineStore.patchStoryline(storylineId, { type });
};

const patchStorylineStatus = (storylineId: string, value: unknown) => {
  const status: OutlineNodeStatus = value === 'approved' ? 'approved' : 'draft';
  outlineStore.patchStoryline(storylineId, { status });
};

const appendNode = () => {
  const last = outlineStore.sortedMasterOutline.at(-1);
  const nextStart = last ? last.chapterEnd + 1 : 1;
  const defaultStorylineId = selectedStoryline.value?.id ?? '';

  if (!defaultStorylineId) {
    toastr.info('请先点击一个故事线，再新增节点');
    return;
  }

  outlineStore.appendMasterOutlineNode({
    title: `节点 ${outlineStore.masterOutline.length + 1}`,
    chapterStart: nextStart,
    chapterEnd: nextStart,
    storylineId: defaultStorylineId,
    summary: '',
    turningPoints: [],
    phase: 'custom',
    status: 'draft',
  });
};

const patchMasterNodeText = (nodeId: string, field: keyof Pick<MasterOutlineNode, 'title' | 'summary' | 'emotionalTone'>, value: unknown) => {
  const payload: Partial<MasterOutlineNode> = {};
  payload[field] = String(value ?? '');
  outlineStore.patchMasterOutlineNode(nodeId, payload);
};

const handleTotalChapterTargetChange = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  const target = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  outlineStore.setTotalChapterTarget(target);
};

const handleSynopsisChange = (value: unknown) => {
  outlineStore.setSynopsis(String(value ?? ''));
};

const patchStorylineListField = (
  storylineId: string,
  field: keyof Pick<Storyline, 'themeKeywords' | 'linkedCharacters'>,
  text: string,
) => {
  const values = text
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
  const payload: Partial<Storyline> = {};
  payload[field] = values;
  outlineStore.patchStoryline(storylineId, payload);
};

const patchMasterNodeTensionLevel = (nodeId: string, value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  const tensionLevel = Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.min(10, Math.round(parsed))) : undefined;
  outlineStore.patchMasterOutlineNode(nodeId, { tensionLevel });
};

const patchMasterNodeChapter = (nodeId: string, field: keyof Pick<MasterOutlineNode, 'chapterStart' | 'chapterEnd'>, value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  const chapterValue = Number.isFinite(parsed) ? parsed : 1;

  const payload: Partial<MasterOutlineNode> = {};
  payload[field] = chapterValue;
  outlineStore.patchMasterOutlineNode(nodeId, payload);
};

const patchMasterNodeStatus = (nodeId: string, value: unknown) => {
  const status: OutlineNodeStatus = value === 'approved' ? 'approved' : 'draft';
  outlineStore.patchMasterOutlineNode(nodeId, { status });
};

const patchMasterNodeStoryline = (nodeId: string, value: unknown) => {
  outlineStore.patchMasterOutlineNode(nodeId, {
    storylineId: String(value ?? '').trim(),
  });
};

const patchMasterNodePhase = (nodeId: string, value: unknown) => {
  const normalized = String(value ?? '').trim();
  const phase: NarrativePhase =
    normalized === 'setup' ||
    normalized === 'confrontation' ||
    normalized === 'climax' ||
    normalized === 'resolution' ||
    normalized === 'custom'
      ? normalized
      : 'custom';

  outlineStore.patchMasterOutlineNode(nodeId, { phase });
};

const patchMasterTurningPoints = (nodeId: string, text: string) => {
  const turningPoints = text
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);

  outlineStore.patchMasterOutlineNode(nodeId, {
    turningPoints,
  });
};

const patchMasterNodeListField = (
  nodeId: string,
  field: keyof Pick<MasterOutlineNode, 'keywords' | 'characters' | 'locations' | 'foreshadowing' | 'payoffs'>,
  text: string,
) => {
  const values = text
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);

  const payload: Partial<MasterOutlineNode> = {};
  payload[field] = values;
  outlineStore.patchMasterOutlineNode(nodeId, payload);
};
</script>
