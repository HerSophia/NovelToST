import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  ChapterDetail,
  MasterOutlineNode,
  NarrativeCalendar,
  OutlineAIConfig,
  OutlineMissingDetailPolicy,
  OutlineMentionConfig,
  OutlineFoundationSyncInfo,
  OutlineSession,
  OutlineState,
  Storyline,
} from '../../../types/outline';
import {
  cloneAIConfig,
  cloneDetailsRecord,
  cloneFoundationSyncInfo,
  cloneMasterOutlineNode,
  cloneNarrativeCalendar,
  cloneOutlineSession,
  cloneOutlineMentionConfig,
  cloneStoryline,
  createDefaultOutlineState,
  ensureMainStoryline,
  normalizeOutlineState,
} from '../core/outline.domain';
import { nextTimestampAfter } from '../core/outline.time';
import { createOutlineSelectors } from '../selectors/outline.selectors';
import { createChapterDetailSlice } from '../slices/chapter-detail.slice';
import { createConfigSlice } from '../slices/config.slice';
import type { OutlineMutationContext } from '../slices/context';
import { createMasterOutlineSlice } from '../slices/master-outline.slice';
import { createSessionSlice } from '../slices/session.slice';
import { createStorylineSlice } from '../slices/storyline.slice';

export const useOutlineStoreFacade = defineStore('novelToST/outline', () => {
  const defaultState = createDefaultOutlineState();
  const defaultMentionConfig: OutlineMentionConfig = cloneOutlineMentionConfig(
    defaultState.mentionConfig ?? {
      worldbookEntryLabel: {
        includeWorldbookName: true,
        includeTriggerKeywords: false,
        includeStrategyType: false,
      },
    },
  );

  const enabled = ref(defaultState.enabled);
  const missingDetailPolicy = ref<OutlineMissingDetailPolicy>(defaultState.missingDetailPolicy);
  const storylines = ref<Storyline[]>(ensureMainStoryline((defaultState.storylines ?? []).map(cloneStoryline)));
  const sessions = ref<OutlineSession[]>((defaultState.sessions ?? []).map(cloneOutlineSession));
  const activeSessionId = ref<string | null>(defaultState.activeSessionId ?? null);
  const masterOutline = ref<MasterOutlineNode[]>(defaultState.masterOutline.map(cloneMasterOutlineNode));
  const detailsByChapter = ref<Record<number, ChapterDetail>>(cloneDetailsRecord(defaultState.detailsByChapter));
  const ai = ref<OutlineAIConfig>(cloneAIConfig(defaultState.ai));
  const mentionConfig = ref<OutlineMentionConfig>(cloneOutlineMentionConfig(defaultMentionConfig));
  const updatedAt = ref(defaultState.updatedAt);
  const lockedStorylineIds = ref<string[]>([...(defaultState.lockedStorylineIds ?? [])]);
  const lockedNodeIds = ref<string[]>([...(defaultState.lockedNodeIds ?? [])]);
  const totalChapterTarget = ref<number>(defaultState.totalChapterTarget ?? 0);
  const calendar = ref<NarrativeCalendar | null>(defaultState.calendar ?? null);
  const synopsis = ref<string>(defaultState.synopsis ?? '');
  const foundationSyncInfo = ref<OutlineFoundationSyncInfo | null>(defaultState.foundationSyncInfo ?? null);

  const touchUpdatedAt = () => {
    updatedAt.value = nextTimestampAfter(updatedAt.value);
  };

  const mutationContext: OutlineMutationContext = {
    enabled,
    missingDetailPolicy,
    storylines,
    masterOutline,
    sessions,
    activeSessionId,
    detailsByChapter,
    ai,
    mentionConfig,
    lockedStorylineIds,
    lockedNodeIds,
    touchUpdatedAt,
  };

  const selectors = createOutlineSelectors({
    storylines,
    masterOutline,
    detailsByChapter,
    sessions,
    activeSessionId,
  });

  const configSlice = createConfigSlice(mutationContext);
  const storylineSlice = createStorylineSlice(mutationContext);
  const masterOutlineSlice = createMasterOutlineSlice(mutationContext);
  const chapterDetailSlice = createChapterDetailSlice(mutationContext);
  const sessionSlice = createSessionSlice(mutationContext);

  const toStateSnapshot = (): OutlineState => {
    return {
      enabled: enabled.value,
      missingDetailPolicy: missingDetailPolicy.value,
      storylines: storylines.value.map(cloneStoryline),
      sessions: sessions.value.map(cloneOutlineSession),
      activeSessionId: activeSessionId.value,
      mentionConfig: cloneOutlineMentionConfig(mentionConfig.value),
      masterOutline: masterOutline.value.map(cloneMasterOutlineNode),
      detailsByChapter: cloneDetailsRecord(detailsByChapter.value),
      ai: cloneAIConfig(ai.value),
      updatedAt: updatedAt.value,
      lockedStorylineIds: [...lockedStorylineIds.value],
      lockedNodeIds: [...lockedNodeIds.value],
      totalChapterTarget: totalChapterTarget.value,
      calendar: calendar.value ? cloneNarrativeCalendar(calendar.value) : null,
      synopsis: synopsis.value,
      foundationSyncInfo: foundationSyncInfo.value ? cloneFoundationSyncInfo(foundationSyncInfo.value) : null,
    };
  };

  const hydrate = (rawState: unknown) => {
    const normalized = normalizeOutlineState(rawState);

    enabled.value = normalized.enabled;
    missingDetailPolicy.value = normalized.missingDetailPolicy;
    storylines.value = ensureMainStoryline((normalized.storylines ?? []).map(cloneStoryline));
    sessions.value = (normalized.sessions ?? []).map(cloneOutlineSession);
    activeSessionId.value = normalized.activeSessionId ?? null;
    mentionConfig.value = cloneOutlineMentionConfig(normalized.mentionConfig ?? defaultMentionConfig);
    masterOutline.value = normalized.masterOutline;
    detailsByChapter.value = normalized.detailsByChapter;
    ai.value = normalized.ai;
    updatedAt.value = normalized.updatedAt;
    lockedStorylineIds.value = [...(normalized.lockedStorylineIds ?? [])];
    lockedNodeIds.value = [...(normalized.lockedNodeIds ?? [])];
    totalChapterTarget.value = normalized.totalChapterTarget ?? 0;
    calendar.value = normalized.calendar ?? null;
    synopsis.value = normalized.synopsis ?? '';
    foundationSyncInfo.value = normalized.foundationSyncInfo ?? null;
  };

  const reset = () => {
    const nextState = createDefaultOutlineState();

    enabled.value = nextState.enabled;
    missingDetailPolicy.value = nextState.missingDetailPolicy;
    storylines.value = ensureMainStoryline((nextState.storylines ?? []).map(cloneStoryline));
    sessions.value = (nextState.sessions ?? []).map(cloneOutlineSession);
    activeSessionId.value = nextState.activeSessionId ?? null;
    mentionConfig.value = cloneOutlineMentionConfig(nextState.mentionConfig ?? defaultMentionConfig);
    masterOutline.value = nextState.masterOutline;
    detailsByChapter.value = nextState.detailsByChapter;
    ai.value = nextState.ai;
    updatedAt.value = nextState.updatedAt;
    lockedStorylineIds.value = [...(nextState.lockedStorylineIds ?? [])];
    lockedNodeIds.value = [...(nextState.lockedNodeIds ?? [])];
    totalChapterTarget.value = nextState.totalChapterTarget ?? 0;
    calendar.value = nextState.calendar ?? null;
    synopsis.value = nextState.synopsis ?? '';
    foundationSyncInfo.value = nextState.foundationSyncInfo ?? null;
  };

  const toggleStorylineLock = (storylineId: string) => {
    const normalizedId = storylineId.trim();
    if (!normalizedId) {
      return;
    }

    lockedStorylineIds.value = lockedStorylineIds.value.includes(normalizedId)
      ? lockedStorylineIds.value.filter(id => id !== normalizedId)
      : [...lockedStorylineIds.value, normalizedId];
    touchUpdatedAt();
  };

  const toggleNodeLock = (nodeId: string) => {
    const normalizedId = nodeId.trim();
    if (!normalizedId) {
      return;
    }

    lockedNodeIds.value = lockedNodeIds.value.includes(normalizedId)
      ? lockedNodeIds.value.filter(id => id !== normalizedId)
      : [...lockedNodeIds.value, normalizedId];
    touchUpdatedAt();
  };

  const setTotalChapterTarget = (value: number) => {
    totalChapterTarget.value = Math.max(0, Math.trunc(value));
    touchUpdatedAt();
  };

  const setCalendar = (value: NarrativeCalendar | null) => {
    calendar.value = value ? cloneNarrativeCalendar(value) : null;
    touchUpdatedAt();
  };

  const setSynopsis = (value: string) => {
    synopsis.value = value;
    touchUpdatedAt();
  };

  const setFoundationSyncInfo = (value: OutlineFoundationSyncInfo | null) => {
    foundationSyncInfo.value = value ? cloneFoundationSyncInfo(value) : null;
    touchUpdatedAt();
  };

  return {
    enabled,
    missingDetailPolicy,
    storylines,
    masterOutline,
    sessions,
    activeSessionId,
    activeSession: selectors.activeSession,
    activeSnapshot: selectors.activeSnapshot,
    sortedMasterOutline: selectors.sortedMasterOutline,
    sortedStorylines: selectors.sortedStorylines,
    detailsByChapter,
    detailChapters: selectors.detailChapters,
    approvedDetailCount: selectors.approvedDetailCount,
    ai,
    mentionConfig,
    updatedAt,
    lockedStorylineIds,
    lockedNodeIds,
    totalChapterTarget,
    calendar,
    synopsis,
    foundationSyncInfo,

    setEnabled: configSlice.setEnabled,
    setMissingDetailPolicy: configSlice.setMissingDetailPolicy,
    replaceMasterOutline: masterOutlineSlice.replaceMasterOutline,
    appendMasterOutlineNode: masterOutlineSlice.appendMasterOutlineNode,
    createStoryline: storylineSlice.createStoryline,
    createSession: sessionSlice.createSession,
    patchStoryline: storylineSlice.patchStoryline,
    removeStoryline: storylineSlice.removeStoryline,
    setActiveSession: sessionSlice.setActiveSession,
    patchMasterOutlineNode: masterOutlineSlice.patchMasterOutlineNode,
    removeMasterOutlineNode: masterOutlineSlice.removeMasterOutlineNode,
    replaceChapterDetails: chapterDetailSlice.replaceChapterDetails,
    setChapterDetail: chapterDetailSlice.setChapterDetail,
    appendMessage: sessionSlice.appendMessage,
    appendSnapshot: sessionSlice.appendSnapshot,
    setActiveSnapshot: sessionSlice.setActiveSnapshot,
    removeLastChatRound: sessionSlice.removeLastChatRound,
    applySnapshot: sessionSlice.applySnapshot,
    patchChapterDetail: chapterDetailSlice.patchChapterDetail,
    removeChapterDetail: chapterDetailSlice.removeChapterDetail,
    ensureChapterDetail: chapterDetailSlice.ensureChapterDetail,
    getChapterDetail: chapterDetailSlice.getChapterDetail,
    findMasterNodeByChapter: chapterDetailSlice.findMasterNodeByChapter,
    setAIConfig: configSlice.setAIConfig,
    patchMentionConfig: configSlice.patchMentionConfig,
    touchUpdatedAt,
    toStateSnapshot,
    hydrate,
    reset,
    toggleStorylineLock,
    toggleNodeLock,
    setTotalChapterTarget,
    setCalendar,
    setSynopsis,
    setFoundationSyncInfo,
  };
});
