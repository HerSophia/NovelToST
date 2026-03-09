import { nextTick, ref, type Ref } from 'vue';
import {
  searchOutlineMentionCandidates,
  type OutlineMentionCandidate,
  type OutlineMentionContext,
} from '../../../core/outline-mention.service';
import type { OutlineMentionKind, OutlineMentionRef } from '../../../types/outline';
import {
  WORKBENCH_MENTION_SOURCE_FILTERS,
  type WorkbenchMentionSourceFilter,
  type WorkbenchMentionSourceFilterId,
} from '../shared/mention-source-filter';

type MentionTriggerState = {
  query: string;
  triggerIndex: number;
  caretIndex: number;
};

type UseWorkbenchMentionInputOptions = {
  modelValue: Ref<string>;
  buildContext: () => OutlineMentionContext;
  searchLimit?: number;
  sourceFilters?: WorkbenchMentionSourceFilter[];
  defaultSourceFilterId?: WorkbenchMentionSourceFilterId;
  allowEscapeWhenNoCandidates?: boolean;
};

function isMentionBoundaryChar(value: string): boolean {
  if (!value) {
    return true;
  }

  if (/\s/.test(value)) {
    return true;
  }

  return "[](){}<>（），。！？、；：,.;:!?\"'“”‘’《》".includes(value);
}

export function useWorkbenchMentionInput(options: UseWorkbenchMentionInputOptions) {
  const mentionSearchLimit = Math.max(1, Math.trunc(options.searchLimit ?? 8));
  const sourceFilters =
    Array.isArray(options.sourceFilters) && options.sourceFilters.length > 0
      ? [...options.sourceFilters]
      : [...WORKBENCH_MENTION_SOURCE_FILTERS];

  const textareaElement = ref<HTMLTextAreaElement | null>(null);
  const selectedMentions = ref<OutlineMentionRef[]>([]);
  const mentionCandidates = ref<OutlineMentionCandidate[]>([]);
  const activeSourceFilter = ref<WorkbenchMentionSourceFilterId>(
    options.defaultSourceFilterId ?? sourceFilters[0]?.id ?? 'all',
  );
  const showMentionPopup = ref(false);
  const activeMentionCandidateIndex = ref(0);
  const mentionQuery = ref('');
  const mentionTriggerIndex = ref<number | null>(null);
  const mentionComposing = ref(false);
  let mentionSearchToken = 0;

  const captureTextareaElement = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      textareaElement.value = target;
    }
  };

  const hideMentionPopup = () => {
    showMentionPopup.value = false;
    mentionCandidates.value = [];
    activeMentionCandidateIndex.value = 0;
  };

  const resetMentionPopupState = () => {
    hideMentionPopup();
    mentionQuery.value = '';
    mentionTriggerIndex.value = null;
    mentionSearchToken += 1;
  };

  const resolveMentionTriggerState = (text: string, caretIndex: number): MentionTriggerState | null => {
    const safeCaretIndex = Number.isFinite(caretIndex) ? Math.max(0, Math.trunc(caretIndex)) : text.length;
    const prefix = text.slice(0, safeCaretIndex);
    const triggerIndex = prefix.lastIndexOf('@');

    if (triggerIndex < 0) {
      return null;
    }

    const charBeforeTrigger = triggerIndex > 0 ? prefix.slice(triggerIndex - 1, triggerIndex) : '';
    if (!isMentionBoundaryChar(charBeforeTrigger)) {
      return null;
    }

    const query = prefix.slice(triggerIndex + 1);
    if (query.includes('\n') || /\s/.test(query) || query.includes('@')) {
      return null;
    }

    return {
      query,
      triggerIndex,
      caretIndex: safeCaretIndex,
    };
  };

  const resolveMentionSearchKinds = (): OutlineMentionKind[] | undefined => {
    const activeFilter = sourceFilters.find(filter => filter.id === activeSourceFilter.value) ?? null;
    if (!activeFilter?.kinds || activeFilter.kinds.length === 0) {
      return undefined;
    }

    return [...activeFilter.kinds];
  };

  const refreshMentionCandidates = async (query: string) => {
    const currentToken = ++mentionSearchToken;
    const candidates = await searchOutlineMentionCandidates({
      query,
      limit: mentionSearchLimit,
      kinds: resolveMentionSearchKinds(),
      context: options.buildContext(),
    });

    if (currentToken !== mentionSearchToken) {
      return;
    }

    const selectedKeys = new Set(selectedMentions.value.map(item => `${item.kind}:${item.id}`));
    mentionCandidates.value = candidates.filter(candidate => !selectedKeys.has(`${candidate.kind}:${candidate.id}`));
    showMentionPopup.value = true;
    activeMentionCandidateIndex.value = 0;
  };

  const switchMentionSourceFilter = (filterId: WorkbenchMentionSourceFilterId) => {
    if (activeSourceFilter.value === filterId) {
      return;
    }

    const filterExists = sourceFilters.some(filter => filter.id === filterId);
    if (!filterExists) {
      return;
    }

    activeSourceFilter.value = filterId;
    void refreshMentionCandidates(mentionQuery.value);
  };

  const cycleMentionSourceFilter = (offset: number) => {
    const filterCount = sourceFilters.length;
    if (filterCount <= 1) {
      return;
    }

    const currentIndex = Math.max(
      0,
      sourceFilters.findIndex(filter => filter.id === activeSourceFilter.value),
    );
    const nextIndex = (currentIndex + offset + filterCount) % filterCount;
    const nextFilter = sourceFilters[nextIndex];
    if (nextFilter) {
      switchMentionSourceFilter(nextFilter.id);
    }
  };

  const handleMentionTriggerUpdate = (event: Event) => {
    captureTextareaElement(event);

    if (mentionComposing.value) {
      return;
    }

    const textarea = textareaElement.value;
    if (!textarea) {
      resetMentionPopupState();
      return;
    }

    const currentText = textarea.value;
    const triggerState = resolveMentionTriggerState(currentText, textarea.selectionStart ?? currentText.length);
    if (!triggerState) {
      resetMentionPopupState();
      return;
    }

    mentionQuery.value = triggerState.query;
    mentionTriggerIndex.value = triggerState.triggerIndex;
    void refreshMentionCandidates(triggerState.query);
  };

  const applyMentionCandidate = (candidate: OutlineMentionCandidate) => {
    const textarea = textareaElement.value;
    const currentText = textarea?.value ?? options.modelValue.value;
    const currentCaretIndex = textarea?.selectionStart ?? currentText.length;
    const triggerState = resolveMentionTriggerState(currentText, currentCaretIndex);
    const triggerIndex = mentionTriggerIndex.value ?? triggerState?.triggerIndex;

    if (triggerIndex != null) {
      const before = currentText.slice(0, triggerIndex);
      const after = currentText.slice(currentCaretIndex);
      options.modelValue.value = `${before}${after}`;
    }

    if (!selectedMentions.value.some(item => item.kind === candidate.kind && item.id === candidate.id)) {
      selectedMentions.value = [
        ...selectedMentions.value,
        {
          kind: candidate.kind,
          id: candidate.id,
          label: candidate.label,
        },
      ];
    }

    resetMentionPopupState();

    if (triggerIndex != null) {
      void nextTick(() => {
        const latestTextarea = textareaElement.value;
        if (!latestTextarea) {
          return;
        }

        latestTextarea.focus();
        const targetCaretIndex = Math.min(triggerIndex, latestTextarea.value.length);
        latestTextarea.setSelectionRange(targetCaretIndex, targetCaretIndex);
      });
    }
  };

  const removeMention = (mention: OutlineMentionRef) => {
    selectedMentions.value = selectedMentions.value.filter(
      item => !(item.kind === mention.kind && item.id === mention.id),
    );
  };

  const handleInput = (event: Event) => {
    handleMentionTriggerUpdate(event);
  };

  const handleCaretChange = (event: Event) => {
    handleMentionTriggerUpdate(event);
  };

  const handleInputKeydown = (event: KeyboardEvent) => {
    captureTextareaElement(event);

    if (!showMentionPopup.value) {
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      cycleMentionSourceFilter(1);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      cycleMentionSourceFilter(-1);
      return;
    }

    if (mentionCandidates.value.length === 0) {
      if (options.allowEscapeWhenNoCandidates === true && event.key === 'Escape') {
        event.preventDefault();
        resetMentionPopupState();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeMentionCandidateIndex.value = (activeMentionCandidateIndex.value + 1) % mentionCandidates.value.length;
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const candidateCount = mentionCandidates.value.length;
      activeMentionCandidateIndex.value = (activeMentionCandidateIndex.value - 1 + candidateCount) % candidateCount;
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      const candidate = mentionCandidates.value[activeMentionCandidateIndex.value] ?? null;
      if (candidate) {
        applyMentionCandidate(candidate);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      resetMentionPopupState();
    }
  };

  const handleCompositionStart = () => {
    mentionComposing.value = true;
    hideMentionPopup();
  };

  const handleCompositionEnd = (event: CompositionEvent) => {
    mentionComposing.value = false;
    handleMentionTriggerUpdate(event);
  };

  const buildMentionPayload = (): OutlineMentionRef[] => {
    return selectedMentions.value.map(mention => ({ ...mention }));
  };

  const clearMentionState = () => {
    selectedMentions.value = [];
    mentionComposing.value = false;
    resetMentionPopupState();
  };

  const resetMentionContextState = () => {
    selectedMentions.value = [];
    mentionComposing.value = false;
    textareaElement.value = null;
    resetMentionPopupState();
    activeSourceFilter.value = sourceFilters[0]?.id ?? 'all';
  };

  return {
    textareaElement,
    selectedMentions,
    mentionCandidates,
    sourceFilters,
    activeSourceFilter,
    showMentionPopup,
    activeMentionCandidateIndex,
    mentionQuery,
    mentionTriggerIndex,
    mentionComposing,
    captureTextareaElement,
    hideMentionPopup,
    resetMentionPopupState,
    resolveMentionTriggerState,
    refreshMentionCandidates,
    switchMentionSourceFilter,
    cycleMentionSourceFilter,
    handleMentionTriggerUpdate,
    applyMentionCandidate,
    removeMention,
    handleInput,
    handleCaretChange,
    handleInputKeydown,
    handleCompositionStart,
    handleCompositionEnd,
    buildMentionPayload,
    clearMentionState,
    resetMentionContextState,
  };
}
