<template>
  <section class="space-y-3 text-sm text-slate-200" data-workbench-view="worldbuilding-panel">
    <div class="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
      <p class="font-semibold">设定工坊（一步一步完成世界观沉淀）</p>
      <p class="mt-1 text-cyan-100/90">
        先建会话，再和 AI 协作，最后提交到世界书。解析失败只提醒，不会覆盖你当前草案。
      </p>
    </div>

    <div class="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div class="space-y-3">
        <WorldbuildingSessionStep
          :collapsed="isStepCollapsed('1-session')"
          :type-options="typeOptions"
          :selected-type="selectedType"
          :session-title="sessionTitle"
          :session-seed="sessionSeed"
          :session-count="worldbuildingStore.sessionCount"
          :sessions="worldbuildingStore.sessions"
          :active-session-id="worldbuildingStore.activeSessionId"
          @toggle-collapse="toggleStepCollapse('1-session')"
          @open-help="emit('open-help', 'worldbuilding')"
          @update:selected-type="handleSelectedTypeUpdate"
          @update:session-title="handleSessionTitleUpdate"
          @update:session-seed="handleSessionSeedUpdate"
          @create-session="createSession"
          @select-session="handleSessionSelect"
        />

        <WorldbuildingSessionInfoPanel
          :collapsed="isStepCollapsed('1-session')"
          :active-session="activeSession"
          :type-options="typeOptions"
          :session-edit-title="sessionEditTitle"
          :session-edit-type="sessionEditType"
          :session-edit-seed="sessionEditSeed"
          @update:session-edit-title="handleSessionEditTitleUpdate"
          @update:session-edit-type="handleSessionEditTypeUpdate"
          @update:session-edit-seed="handleSessionEditSeedUpdate"
          @add-version="addVersion"
          @apply-session-edit="applySessionEdit"
          @open-remove-session-confirm="openRemoveSessionConfirmModal"
          @reset-session-edit="resetSessionEditor"
          @select-version="handleSessionVersionSelect"
        />
      </div>

      <div class="space-y-3">
        <div
          v-if="!activeSession"
          data-worldbuilding-empty
          class="rounded-lg border border-dashed border-white/15 bg-slate-900/40 p-5 text-center text-sm text-slate-400"
        >
          请先在左侧创建或选择会话，再继续步骤 2~4。
        </div>

        <template v-else>
          <WorldbuildingCollaborationStep
            v-model:message-input="messageInput"
            :collapsed="isStepCollapsed('2-collaboration')"
            :ai-busy="aiBusy"
            :ai-busy-action="aiBusyAction"
            :active-messages="activeMessages"
            :selected-mentions="selectedWorldbuildingMentions"
            :mention-candidates="worldbuildingMentionCandidates"
            :source-filters="worldbuildingMentionSourceFilters"
            :active-source-filter="activeWorldbuildingMentionSourceFilter"
            :show-mention-popup="showWorldbuildingMentionPopup"
            :active-mention-candidate-index="activeWorldbuildingMentionCandidateIndex"
            :mention-query="worldbuildingMentionQuery"
            :can-run-draft-actions="canRunDraftActions"
            :can-run-candidate-action="canRunCandidateAction"
            :last-parse-warning="lastParseWarning"
            :can-retry-last-round="canRetryLastRound"
            :can-delete-last-round="canDeleteLastRound"
            :last-consistency-issues="lastConsistencyIssues"
            :collaboration-hints="collaborationHints"
            @toggle-collapse="toggleStepCollapse('2-collaboration')"
            @open-help="emit('open-help', 'worldbuilding')"
            @refresh-hints="refreshEnvironmentHints"
            @clear-messages="clearConversation"
            @chat-input="handleWorldbuildingChatInput"
            @chat-caret-change="handleWorldbuildingChatCaretChange"
            @chat-keydown="handleWorldbuildingChatInputKeydown"
            @chat-composition-start="handleWorldbuildingChatCompositionStart"
            @chat-composition-end="handleWorldbuildingChatCompositionEnd"
            @remove-mention="removeWorldbuildingMention"
            @switch-mention-source-filter="switchWorldbuildingMentionSourceFilter"
            @apply-mention-candidate="applyWorldbuildingMentionCandidate"
            @run-expand="runExpandAction"
            @run-refine="runRefineAction"
            @run-consistency="runConsistencyAction"
            @run-generate-candidates="runGenerateCandidatesAction"
            @retry-last-round="handleRetryLastRound"
            @delete-last-round="handleDeleteLastRound"
            @clear-parse-warning="handleClearParseWarning"
          />
          <WorldbuildingDraftLockStep
            :collapsed="isStepCollapsed('3-draft-locks')"
            :active-version="activeVersion"
            :active-draft="activeDraft"
            :lockable-fields="lockableFields"
            :locked-field-label-map="lockedFieldLabelMap"
            @toggle-collapse="toggleStepCollapse('3-draft-locks')"
            @open-help="emit('open-help', 'worldbuilding')"
            @toggle-field-lock="toggleFieldLock"
          />

          <WorldbuildingBindingCommitStep
            v-model:selected-worldbook-name="selectedWorldbookNameModel"
            v-model:sync-outline-after-commit="syncOutlineAfterCommit"
            :collapsed="isStepCollapsed('4-binding-commit')"
            :chat-worldbook-binding="chatWorldbookBinding"
            :chat-binding-loading="chatBindingLoading"
            :chat-binding-applying="chatBindingApplying"
            :worldbook-list-loading="worldbookListLoading"
            :selectable-worldbooks="selectableWorldbooks"
            :checked-candidate-count="worldbuildingStore.checkedCandidateCount"
            :candidates="worldbuildingStore.candidates"
            :can-build-commit-preview="canBuildCommitPreview"
            :can-open-commit-confirm="canOpenCommitConfirm"
            :commit-preview-loading="commitPreviewLoading"
            :committing="committing"
            :commit-preview="commitPreview"
            :commit-receipt="commitReceipt"
            :outline-sync-receipt="outlineSyncReceipt"
            @toggle-collapse="toggleStepCollapse('4-binding-commit')"
            @open-help="emit('open-help', 'worldbuilding')"
            @refresh-chat-binding="refreshChatWorldbookBinding()"
            @use-chat-binding-target="useChatBindingAsSubmitTarget"
            @bind-chat-worldbook="bindCurrentTargetToChat"
            @refresh-worldbooks="refreshWorldbookOptions"
            @candidate-checked-changed="onCandidateCheckedChanged"
            @build-commit-preview="handleBuildCommitPreviewClick"
            @open-commit-confirm="openCommitConfirmModal"
          />

        </template>
      </div>
    </div>

    <WorldbuildingCommitConfirmModal
      :visible="showCommitConfirmModal"
      :selected-worldbook-name="worldbuildingStore.selectedWorldbookName"
      :checked-candidate-count="worldbuildingStore.checkedCandidateCount"
      :commit-preview="commitPreview"
      :sync-outline-after-commit="syncOutlineAfterCommit"
      :committing="committing"
      @close="closeCommitConfirmModal"
      @confirm="confirmCommitCandidates"
    />

    <WorldbuildingRemoveSessionConfirmModal
      :visible="showRemoveSessionConfirmModal"
      :session-title="activeSession?.title || '未命名会话'"
      @close="closeRemoveSessionConfirmModal"
      @confirm="confirmRemoveSession"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import WorldbuildingCommitConfirmModal from './worldbuilding-panel/WorldbuildingCommitConfirmModal.vue';
import WorldbuildingRemoveSessionConfirmModal from './worldbuilding-panel/WorldbuildingRemoveSessionConfirmModal.vue';
import WorldbuildingBindingCommitStep from './worldbuilding-panel/WorldbuildingBindingCommitStep.vue';
import WorldbuildingCollaborationStep from './worldbuilding-panel/WorldbuildingCollaborationStep.vue';
import WorldbuildingDraftLockStep from './worldbuilding-panel/WorldbuildingDraftLockStep.vue';
import WorldbuildingSessionInfoPanel from './worldbuilding-panel/WorldbuildingSessionInfoPanel.vue';
import WorldbuildingSessionStep from './worldbuilding-panel/WorldbuildingSessionStep.vue';
import type { HelpTopicId } from '../help/help-topics';
import { useWorldbuildingControl } from '../../composables/useWorldbuildingControl';
import { useStepCollapse } from './composables/useStepCollapse';
import { useWorkbenchMentionInput } from './composables/useWorkbenchMentionInput';
import {
  bindChatWorldbook,
  getChatWorldbookBindingSnapshot,
  type ChatWorldbookBindingSnapshot,
} from '../../core/worldbook-binding.service';
import {
  buildCommitPreview,
  commitCandidates,
  listSelectableWorldbooks,
  type WorldbookCommitPreview,
  type WorldbookCommitReceipt,
} from '../../core/worldbook-commit.service';
import {
  syncCommittedCandidatesToFoundation,
  type FoundationSyncReceipt,
} from '../../core/worldbuilding-outline-sync.service';
import { useFoundationStore } from '../../stores/foundation.store';
import { useOutlineStore } from '../../stores/outline.store';
import { useWorldbuildingStore } from '../../stores/worldbuilding.store';
import type {
  WorldbuildingDraftField,
  WorldbuildingType,
} from '../../types/worldbuilding';

type WorldbuildingTypeOption = {
  value: WorldbuildingType;
  label: string;
  isPlaceholder: boolean;
};

type WorldbuildingStepId = '1-session' | '2-collaboration' | '3-draft-locks' | '4-binding-commit';

type WorldbuildingStepCollapseState = Record<WorldbuildingStepId, boolean>;

const defaultStepCollapseState: WorldbuildingStepCollapseState = {
  '1-session': false,
  '2-collaboration': false,
  '3-draft-locks': false,
  '4-binding-commit': false,
};

const emit = defineEmits<{
  'open-help': [topic: HelpTopicId];
}>();

const typeOptions: WorldbuildingTypeOption[] = [
  { value: 'character', label: '角色', isPlaceholder: false },
  { value: 'faction', label: '势力组织', isPlaceholder: false },
  { value: 'location', label: '地点', isPlaceholder: false },
  { value: 'system', label: '规则体系', isPlaceholder: false },
  { value: 'history_placeholder', label: '历史事件', isPlaceholder: true },
  { value: 'item_placeholder', label: '物品技术', isPlaceholder: true },
  { value: 'culture_placeholder', label: '文化习俗', isPlaceholder: true },
  { value: 'custom_placeholder', label: '自定义扩展', isPlaceholder: true },
];

const lockableFields: WorldbuildingDraftField[] = [
  'name',
  'aliases',
  'summary',
  'facts',
  'constraints',
  'relations',
  'extra',
];

const lockedFieldLabelMap: Record<WorldbuildingDraftField, string> = {
  name: '名称',
  aliases: '别名',
  summary: '摘要',
  facts: '事实要点',
  constraints: '约束',
  relations: '关系',
  extra: '扩展字段',
};


const {
  isStepCollapsed,
  toggleStepCollapse,
} = useStepCollapse<WorldbuildingStepId>(defaultStepCollapseState);

const worldbuildingStore = useWorldbuildingStore();
const foundationStore = useFoundationStore();
const outlineStore = useOutlineStore();
const {
  messageInput,
  aiBusy,
  aiBusyAction,
  collaborationHints,
  lastParseWarning,
  canRetryLastRound,
  canDeleteLastRound,
  lastConsistencyIssues,
  refreshEnvironmentHints,
  clearMessages,
  retryLastRound,
  deleteLastRound,
  runExpand,
  runRefine,
  runConsistencyCheck,
  runGenerateCandidates,
} = useWorldbuildingControl();

const buildWorldbuildingMentionContext = () => {
  return {
    foundation: foundationStore.foundation,
    storylines: outlineStore.sortedStorylines,
    masterOutline: outlineStore.sortedMasterOutline,
    detailsByChapter: outlineStore.detailsByChapter,
    mentionConfig: outlineStore.mentionConfig,
  };
};

const {
  selectedMentions: selectedWorldbuildingMentions,
  mentionCandidates: worldbuildingMentionCandidates,
  sourceFilters: worldbuildingMentionSourceFilters,
  activeSourceFilter: activeWorldbuildingMentionSourceFilter,
  showMentionPopup: showWorldbuildingMentionPopup,
  activeMentionCandidateIndex: activeWorldbuildingMentionCandidateIndex,
  mentionQuery: worldbuildingMentionQuery,
  switchMentionSourceFilter: switchWorldbuildingMentionSourceFilter,
  applyMentionCandidate: applyWorldbuildingMentionCandidate,
  removeMention: removeWorldbuildingMention,
  handleInput: handleWorldbuildingChatInput,
  handleCaretChange: handleWorldbuildingChatCaretChange,
  handleInputKeydown: handleWorldbuildingChatInputKeydown,
  handleCompositionStart: handleWorldbuildingChatCompositionStart,
  handleCompositionEnd: handleWorldbuildingChatCompositionEnd,
  buildMentionPayload: buildWorldbuildingMentionPayload,
  clearMentionState: clearWorldbuildingMentionState,
  resetMentionContextState: resetWorldbuildingMentionContextState,
} = useWorkbenchMentionInput({ modelValue: messageInput, buildContext: buildWorldbuildingMentionContext, searchLimit: 8, allowEscapeWhenNoCandidates: true });

const selectedType = ref<WorldbuildingType>('character');
const sessionTitle = ref('');
const sessionSeed = ref('');
const sessionEditTitle = ref('');
const sessionEditSeed = ref('');
const sessionEditType = ref<WorldbuildingType>('character');
const showRemoveSessionConfirmModal = ref(false);

const handleSelectedTypeUpdate = (value: WorldbuildingType) => {
  selectedType.value = value;
};

const handleSessionTitleUpdate = (value: string) => {
  sessionTitle.value = value;
};

const handleSessionSeedUpdate = (value: string) => {
  sessionSeed.value = value;
};

const handleSessionSelect = (sessionId: string) => {
  worldbuildingStore.setActiveSession(sessionId);
};

const handleSessionEditTitleUpdate = (value: string) => {
  sessionEditTitle.value = value;
};

const handleSessionEditTypeUpdate = (value: WorldbuildingType) => {
  sessionEditType.value = value;
};

const handleSessionEditSeedUpdate = (value: string) => {
  sessionEditSeed.value = value;
};

const activeSession = computed(() => worldbuildingStore.activeSession);
const activeVersion = computed(() => worldbuildingStore.activeVersion);
const activeMessages = computed(() => activeSession.value?.messages ?? []);
const activeDraft = computed(() => activeVersion.value?.draft ?? null);

const handleSessionVersionSelect = (versionId: string) => {
  const session = activeSession.value;
  if (!session) {
    return;
  }

  worldbuildingStore.setActiveVersion(session.id, versionId);
};

const syncSessionEditorFromActive = () => {
  const session = activeSession.value;
  if (!session) {
    sessionEditTitle.value = '';
    sessionEditSeed.value = '';
    sessionEditType.value = 'character';
    return;
  }

  sessionEditTitle.value = session.title;
  sessionEditSeed.value = session.seed;
  sessionEditType.value = session.type;
};

watch(
  () => activeSession.value?.id ?? null,
  () => {
    syncSessionEditorFromActive();
    resetWorldbuildingMentionContextState();
    showRemoveSessionConfirmModal.value = false;
  },
  { immediate: true },
);

const canRunDraftActions = computed(() => Boolean(activeSession.value && activeVersion.value) && !aiBusy.value);
const canRunCandidateAction = computed(() => Boolean(activeSession.value && activeVersion.value) && !aiBusy.value);

const selectableWorldbooks = ref<string[]>([]);
const worldbookListLoading = ref(false);
const commitPreviewLoading = ref(false);
const committing = ref(false);
const showCommitConfirmModal = ref(false);
const commitPreview = ref<WorldbookCommitPreview | null>(null);
const commitReceipt = ref<WorldbookCommitReceipt | null>(null);
const syncOutlineAfterCommit = ref(false);
const outlineSyncReceipt = ref<FoundationSyncReceipt | null>(null);
const chatWorldbookBinding = ref<ChatWorldbookBindingSnapshot>({
  chatName: 'current',
  boundWorldbookName: null,
  hasBinding: false,
});
const chatBindingLoading = ref(false);
const chatBindingApplying = ref(false);

const resetCommitFeedbackState = () => {
  commitPreview.value = null;
  commitReceipt.value = null;
  outlineSyncReceipt.value = null;
  showCommitConfirmModal.value = false;
};

const setSelectedWorldbookName = (name: string | null) => {
  if ((worldbuildingStore.selectedWorldbookName ?? null) === (name ?? null)) {
    return;
  }

  worldbuildingStore.setSelectedWorldbookName(name);
  resetCommitFeedbackState();
};

const selectedWorldbookNameModel = computed({
  get: () => worldbuildingStore.selectedWorldbookName ?? '',
  set: (value: string) => {
    setSelectedWorldbookName(value || null);
  },
});

const canBuildCommitPreview = computed(() => {
  return (
    Boolean(worldbuildingStore.selectedWorldbookName) &&
    worldbuildingStore.checkedCandidateCount > 0 &&
    !commitPreviewLoading.value &&
    !committing.value
  );
});

const canOpenCommitConfirm = computed(() => {
  return (
    Boolean(worldbuildingStore.selectedWorldbookName) &&
    worldbuildingStore.checkedCandidateCount > 0 &&
    !committing.value
  );
});

const applyPreviewConflictsToStore = (preview: WorldbookCommitPreview) => {
  preview.candidates.forEach(item => {
    worldbuildingStore.patchCandidate(item.candidate.id, {
      conflict: item.conflict,
    });
  });
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const syncTargetWorldbookWithBinding = (snapshot: ChatWorldbookBindingSnapshot, force = false) => {
  const boundName = snapshot.boundWorldbookName;
  if (!boundName) {
    return;
  }

  if (force || !worldbuildingStore.selectedWorldbookName) {
    setSelectedWorldbookName(boundName);
  }
};

const refreshChatWorldbookBinding = async (forceSyncTarget = false) => {
  if (chatBindingLoading.value) {
    return;
  }

  chatBindingLoading.value = true;
  try {
    const snapshot = await getChatWorldbookBindingSnapshot();
    chatWorldbookBinding.value = snapshot;
    syncTargetWorldbookWithBinding(snapshot, forceSyncTarget);
  } catch (error) {
    toastr.error(toErrorMessage(error), '读取聊天世界书绑定失败');
  } finally {
    chatBindingLoading.value = false;
  }
};

const useChatBindingAsSubmitTarget = () => {
  const boundName = chatWorldbookBinding.value.boundWorldbookName;
  if (!boundName) {
    toastr.warning('当前聊天还没有绑定世界书，可先手动选择目标。');
    return;
  }

  setSelectedWorldbookName(boundName);
  toastr.success(`已将提交目标切换为：${boundName}`);
};

const bindCurrentTargetToChat = async () => {
  const targetName = worldbuildingStore.selectedWorldbookName;
  if (!targetName) {
    toastr.warning('请先选择提交目标，再执行聊天绑定。');
    return;
  }

  if (chatBindingApplying.value) {
    return;
  }

  chatBindingApplying.value = true;
  try {
    const snapshot = await bindChatWorldbook(targetName);
    chatWorldbookBinding.value = snapshot;
    syncTargetWorldbookWithBinding(snapshot, true);
    toastr.success(`当前聊天已绑定世界书：${snapshot.boundWorldbookName}`);
  } catch (error) {
    toastr.error(toErrorMessage(error), '应用聊天世界书绑定失败');
  } finally {
    chatBindingApplying.value = false;
  }
};

const refreshWorldbookOptions = async () => {
  if (worldbookListLoading.value) {
    return;
  }

  worldbookListLoading.value = true;
  try {
    const names = await listSelectableWorldbooks();
    selectableWorldbooks.value = names;

    if (worldbuildingStore.selectedWorldbookName && !names.includes(worldbuildingStore.selectedWorldbookName)) {
      setSelectedWorldbookName(null);
    }
  } catch (error) {
    toastr.error(toErrorMessage(error), '刷新世界书列表失败，请稍后重试');
  } finally {
    worldbookListLoading.value = false;
  }
};

const buildCommitPreviewAction = async (clearReceipt = true): Promise<WorldbookCommitPreview | null> => {
  const worldbookName = worldbuildingStore.selectedWorldbookName;
  if (!worldbookName) {
    toastr.warning('请先选择目标世界书，再生成冲突预览。');
    return null;
  }

  if (worldbuildingStore.checkedCandidateCount === 0) {
    toastr.warning('请至少勾选一条候选，再继续。');
    return null;
  }

  if (commitPreviewLoading.value) {
    return commitPreview.value;
  }

  commitPreviewLoading.value = true;
  try {
    const preview = await buildCommitPreview({
      worldbookName,
      candidates: worldbuildingStore.candidates,
      mode: worldbuildingStore.commitMode,
    });

    commitPreview.value = preview;
    if (clearReceipt) {
      commitReceipt.value = null;
      outlineSyncReceipt.value = null;
    }
    applyPreviewConflictsToStore(preview);
    return preview;
  } catch (error) {
    toastr.error(toErrorMessage(error), '冲突预览生成失败');
    return null;
  } finally {
    commitPreviewLoading.value = false;
  }
};

const handleBuildCommitPreviewClick = () => {
  void buildCommitPreviewAction();
};

const onCandidateCheckedChanged = (payload: { candidateId: string; checked: boolean }) => {
  worldbuildingStore.setCandidateChecked(payload.candidateId, payload.checked);
  resetCommitFeedbackState();
};

const openCommitConfirmModal = async () => {
  if (
    commitPreview.value &&
    commitPreview.value.worldbookName === worldbuildingStore.selectedWorldbookName &&
    commitPreview.value.checkedCount === worldbuildingStore.checkedCandidateCount
  ) {
    showCommitConfirmModal.value = true;
    return;
  }

  const preview = await buildCommitPreviewAction();
  if (!preview) {
    return;
  }

  showCommitConfirmModal.value = true;
};

const closeCommitConfirmModal = () => {
  showCommitConfirmModal.value = false;
};

const confirmCommitCandidates = async () => {
  if (committing.value) {
    return;
  }

  const worldbookName = worldbuildingStore.selectedWorldbookName;
  if (!worldbookName) {
    toastr.warning('请先选择目标世界书，再执行提交。');
    return;
  }

  showCommitConfirmModal.value = false;
  committing.value = true;

  try {
    const receipt = await commitCandidates({
      worldbookName,
      candidates: worldbuildingStore.candidates,
      mode: worldbuildingStore.commitMode,
    });

    commitReceipt.value = receipt;
    outlineSyncReceipt.value = null;

    if (receipt.errorMessage) {
      toastr.error(receipt.errorMessage, '提交失败');
    } else if (receipt.failedCount > 0) {
      toastr.warning(`提交已完成：成功 ${receipt.successCount} 条，失败 ${receipt.failedCount} 条。`);
    } else {
      toastr.success(`提交已完成：成功 ${receipt.successCount} 条，重命名 ${receipt.renamedCount} 条。`);
    }

    if (!receipt.errorMessage && syncOutlineAfterCommit.value) {
      const syncReceipt = syncCommittedCandidatesToFoundation(receipt.committedCandidates);
      outlineSyncReceipt.value = syncReceipt;

      if (syncReceipt.appendedCount > 0) {
        toastr.success(`故事基底已同步：新增 ${syncReceipt.appendedCount} 条。`);
      } else {
        toastr.info('故事基底已同步：没有新增条目。');
      }
    }

    if (!receipt.errorMessage) {
      await buildCommitPreviewAction(false);
    }
  } catch (error) {
    toastr.error(toErrorMessage(error), '提交世界书失败，请稍后重试');
  } finally {
    committing.value = false;
  }
};

onMounted(() => {
  void refreshWorldbookOptions();
  void refreshChatWorldbookBinding();
});

const getTypeLabel = (type: WorldbuildingType): string => {
  return typeOptions.find(option => option.value === type)?.label ?? '设定';
};

const createSession = () => {
  const title =
    sessionTitle.value.trim() || `${getTypeLabel(selectedType.value)}会话 ${worldbuildingStore.sessionCount + 1}`;

  worldbuildingStore.createSession({
    type: selectedType.value,
    title,
    seed: sessionSeed.value,
  });

  sessionTitle.value = '';
  sessionSeed.value = '';
};

const resetSessionEditor = () => {
  syncSessionEditorFromActive();
};

const applySessionEdit = () => {
  const session = activeSession.value;
  if (!session) {
    return;
  }

  const updated = worldbuildingStore.patchSession(session.id, {
    type: sessionEditType.value,
    title: sessionEditTitle.value,
    seed: sessionEditSeed.value,
  });

  if (!updated) {
    toastr.info('会话内容没有变化。');
    return;
  }

  sessionEditTitle.value = updated.title;
  sessionEditSeed.value = updated.seed;
  sessionEditType.value = updated.type;
  toastr.success('会话设置已保存。');
};

const openRemoveSessionConfirmModal = () => {
  if (!activeSession.value) {
    return;
  }

  showRemoveSessionConfirmModal.value = true;
};

const closeRemoveSessionConfirmModal = () => {
  showRemoveSessionConfirmModal.value = false;
};

const confirmRemoveSession = () => {
  const session = activeSession.value;
  if (!session) {
    showRemoveSessionConfirmModal.value = false;
    return;
  }

  worldbuildingStore.removeSession(session.id);
  showRemoveSessionConfirmModal.value = false;
  commitPreview.value = null;
  commitReceipt.value = null;
  outlineSyncReceipt.value = null;
  showCommitConfirmModal.value = false;
  syncSessionEditorFromActive();
  toastr.success('会话已删除');
};

const addVersion = () => {
  const session = activeSession.value;
  const version = activeVersion.value;
  if (!session || !version) {
    return;
  }

  worldbuildingStore.appendDraftVersion(session.id, {
    draft: version.draft,
    lockedFields: version.lockedFields,
  });
};

const toggleFieldLock = (field: WorldbuildingDraftField) => {
  const session = activeSession.value;
  const version = activeVersion.value;
  if (!session || !version) {
    return;
  }

  worldbuildingStore.toggleLockedField(session.id, field, version.id);
};

const clearConversation = () => {
  clearMessages();
  clearWorldbuildingMentionState();
};

const runExpandAction = async () => {
  await runExpand({
    mentions: buildWorldbuildingMentionPayload(),
  });
  clearWorldbuildingMentionState();
};

const runRefineAction = async () => {
  await runRefine({
    mentions: buildWorldbuildingMentionPayload(),
  });
  clearWorldbuildingMentionState();
};

const runConsistencyAction = async () => {
  await runConsistencyCheck({
    mentions: buildWorldbuildingMentionPayload(),
  });
  clearWorldbuildingMentionState();
};

const runGenerateCandidatesAction = async () => {
  await runGenerateCandidates({
    mentions: buildWorldbuildingMentionPayload(),
  });
  clearWorldbuildingMentionState();
};

const handleRetryLastRound = async () => {
  await retryLastRound();
};

const handleDeleteLastRound = () => {
  deleteLastRound();
};

const handleClearParseWarning = () => {
  lastParseWarning.value = null;
};
</script>
