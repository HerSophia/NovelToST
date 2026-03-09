import { computed, onScopeDispose, ref } from 'vue';
import {
  deriveChapterDetailsByAI,
  generateMasterOutlineByAI,
  rewriteChapterDetailByAI,
} from '../core/outline-ai.service';
import {
  runOutlineChatRound as runOutlineChatRoundByService,
  type OutlineChatRoundResult,
} from '../core/outline-chat.service';
import type { FoundationPatch } from '../core/foundation-legacy.service';
import { useFoundationStore } from '../stores/foundation.store';
import {
  type OutlineMentionContext,
} from '../core/outline-mention.service';
import {
  normalizeMentionRefs,
  normalizeMentionSnapshots,
  normalizeMentionWarnings,
  resolveMentionPayloadForSend as resolveSharedMentionPayloadForSend,
} from './shared/useMentionPayloadResolver';
import {
  resolveLLMCustomConfigFromWorldbookSettings,
  type LLMRuntimeOptions,
} from '../core/llm-api.service';
import { useOutlineStore } from '../stores/outline.store';
import type { ApplyOutlineSnapshotOptions } from '../stores/outline.store';
import type { FoundationGenerationReadiness } from '../core/foundation-tier';
import { useNovelSettingsStore } from '../stores/settings.store';
import type {
  ChapterDetail,
  OutlineMessage,
  OutlineSession,
  OutlineSnapshot,
  OutlineMentionRef,
  OutlineMentionSnapshot,
} from '../types/outline';

function normalizeChapter(value: number | null | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) {
    return Math.max(1, Math.trunc(fallback));
  }

  return Math.max(1, Math.trunc(value));
}

function parseTextareaList(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

type FoundationGenerationAction = 'master' | 'detail' | 'rewrite';

export type FoundationGenerationReminderState = {
  action: 'master' | 'detail' | 'rewrite';
  actionLabel: string;
  title: string;
  description: string;
  recommendedItems: string[];
  confirmText: string;
  cancelText: string;
};

type OutlineAIBusyAction = 'master' | 'detail' | 'rewrite' | 'outline_chat';

const FOUNDATION_GENERATION_ACTION_LABELS: Record<FoundationGenerationAction, string> = {
  master: '生成总纲',
  detail: '派生细纲',
  rewrite: '重写细纲',
};

function collectFoundationReadinessLabels(
  items: FoundationGenerationReadiness['blockingItems'],
  limit = items.length,
): string[] {
  const visibleItems = items.slice(0, Math.max(0, limit)).map(item => item.label);
  const extraCount = items.length - visibleItems.length;

  if (extraCount > 0) {
    visibleItems.push(`其余 ${extraCount} 项未展示`);
  }

  return visibleItems;
}

function buildFoundationGenerationBlockedMessage(readiness: FoundationGenerationReadiness): string {
  const labels = collectFoundationReadinessLabels(readiness.blockingItems);
  const labelText = labels.length > 0 ? labels.join('；') : '请补充基础层关键字段';

  return `当前故事基底尚未达到最低生成门槛（${readiness.minimumSatisfiedCount}/${readiness.minimumTotalCount}）。请先补充：${labelText}`;
}

function buildFoundationGenerationReminderState(
  action: FoundationGenerationAction,
  readiness: FoundationGenerationReadiness,
): FoundationGenerationReminderState {
  const actionLabel = FOUNDATION_GENERATION_ACTION_LABELS[action];
  const recommendedItems = collectFoundationReadinessLabels(readiness.recommendedItems, 6);

  return {
    action,
    actionLabel,
    title: '故事基底补充提醒',
    description: `当前故事基底已经达到最低生成门槛（${readiness.minimumSatisfiedCount}/${readiness.minimumTotalCount}）。你可以继续${actionLabel}，但如果先补充更多故事基底信息，生成结果通常会更稳定，也更贴近预期。`,
    recommendedItems,
    confirmText: `继续${actionLabel}`,
    cancelText: '先去补充',
  };
}

type CreateOutlineChatSessionInput = {
  title?: string;
  seed?: string;
  targetChapter?: number | null;
};

type RunOutlineChatRoundOptions = {
  sessionId?: string | null;
  instruction?: string;
  mentions?: OutlineMentionRef[];
  mentionSnapshots?: OutlineMentionSnapshot[];
  mentionWarnings?: string[];
};

function debugLogOutlineChatRoundResult(result: OutlineChatRoundResult, sessionId: string) {
  if (typeof console === 'undefined') {
    return;
  }

  const status = result.parseError ? 'parse-failed' : 'ok';
  const title = `[OutlineChat][LLM][${status}] session=${sessionId}`;

  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(title);
    console.info('rawResponse:', result.rawResponse);
    console.info('payload:', result.payload);
    console.info('assistantText:', result.assistantText);
    console.info('parseError:', result.parseError);
    if (result.parseWarnings.length > 0) {
      console.warn('parseWarnings:', result.parseWarnings);
    }
    console.groupEnd();
    return;
  }

  console.info(title, {
    rawResponse: result.rawResponse,
    payload: result.payload,
    assistantText: result.assistantText,
    parseError: result.parseError,
    parseWarnings: result.parseWarnings,
  });
}

export function useOutlineControl() {
  const outlineStore = useOutlineStore();
  const foundationStore = useFoundationStore();
  const settingsStore = useNovelSettingsStore();

  const aiBusy = ref(false);
  const aiBusyAction = ref<OutlineAIBusyAction | null>(null);
  const outlineChatInput = ref('');
  const lastOutlineChatParseError = ref<string | null>(null);
  const foundationGenerationReminder = ref<FoundationGenerationReminderState | null>(null);
  const pendingFoundationPatch = ref<FoundationPatch | null>(null);
  let foundationGenerationReminderResolver: ((confirmed: boolean) => void) | null = null;

  const chapterCount = computed(() => {
    const outlineTarget = outlineStore.totalChapterTarget;
    if (outlineTarget > 0) {
      return Math.max(1, Math.trunc(outlineTarget));
    }
    return Math.max(1, Math.trunc(settingsStore.settings.totalChapters));
  });
  const hasPendingFoundationPatch = computed(() => pendingFoundationPatch.value !== null);

  const resolveOutlineLLMOptions = (): LLMRuntimeOptions => {
    const worldbookSettings = settingsStore.settings.worldbook;
    const timeoutMs = worldbookSettings.apiTimeout;

    if (outlineStore.ai.provider !== 'custom') {
      return { timeoutMs };
    }

    return {
      timeoutMs,
      customConfig: resolveLLMCustomConfigFromWorldbookSettings(worldbookSettings),
    };
  };

  const captureFoundationSyncInfo = () => {
    const foundation = foundationStore.foundation;
    outlineStore.setFoundationSyncInfo({
      syncedAt: foundationStore.updatedAt,
      logline: foundation.core.logline,
      coreConflict: foundation.core.coreConflict,
      emotionalTone: foundation.core.emotionalTone,
    });
  };

  const resolveFoundationGenerationReminder = (confirmed: boolean): void => {
    const resolver = foundationGenerationReminderResolver;
    foundationGenerationReminderResolver = null;
    foundationGenerationReminder.value = null;
    resolver?.(confirmed);
  };

  const cancelFoundationGenerationReminder = (): void => {
    resolveFoundationGenerationReminder(false);
  };

  const confirmFoundationGenerationReminder = (): void => {
    resolveFoundationGenerationReminder(true);
  };

  const requestFoundationGenerationReminder = (
    action: FoundationGenerationAction,
    readiness: FoundationGenerationReadiness,
  ): Promise<boolean> => {
    resolveFoundationGenerationReminder(false);
    foundationGenerationReminder.value = buildFoundationGenerationReminderState(action, readiness);
    return new Promise(resolve => {
      foundationGenerationReminderResolver = resolve;
    });
  };

  const ensureFoundationGenerationReady = async (action: FoundationGenerationAction): Promise<boolean> => {
    const readiness = foundationStore.generationReadiness;
    if (!readiness.canGenerate) {
      toastr.warning(buildFoundationGenerationBlockedMessage(readiness));
      return false;
    }

    if (!readiness.shouldRemind) {
      return true;
    }

    return requestFoundationGenerationReminder(action, readiness);
  };

  onScopeDispose(() => {
    cancelFoundationGenerationReminder();
  });

  const hasMinimumFoundationGenerationReadiness = computed(() => foundationStore.generationReadiness.canGenerate);

  const canGenerateMasterOutline = computed(() => !aiBusy.value && hasMinimumFoundationGenerationReadiness.value);
  const canDeriveDetails = computed(() => !aiBusy.value && hasMinimumFoundationGenerationReadiness.value && outlineStore.masterOutline.length > 0);
  const canRewriteDetail = computed(() => !aiBusy.value && hasMinimumFoundationGenerationReadiness.value);
  const canRunOutlineChat = computed(() => !aiBusy.value);

  const outlineChatSessions = computed(() => outlineStore.sessions.filter(session => session.type === 'outline_chat'));

  const activeOutlineChatSession = computed<OutlineSession | null>(() => {
    const active = outlineStore.activeSession;
    if (active?.type === 'outline_chat') {
      return active;
    }

    return outlineChatSessions.value.at(-1) ?? null;
  });

  const activeOutlineChatMessages = computed<OutlineMessage[]>(() => {
    return activeOutlineChatSession.value?.messages ?? [];
  });

  const hasLastOutlineChatRequest = computed(() => {
    return activeOutlineChatMessages.value.some(message => message.role === 'user');
  });

  const canDeleteLastOutlineChatRequest = computed(() => !aiBusy.value && hasLastOutlineChatRequest.value);
  const canRetryLastOutlineChatRequest = computed(() => !aiBusy.value && hasLastOutlineChatRequest.value);

  const activeOutlineChatSnapshots = computed<OutlineSnapshot[]>(() => {
    const session = activeOutlineChatSession.value;
    if (!session) {
      return [];
    }

    return [...session.snapshots].sort((left, right) => right.version - left.version);
  });

  const activeOutlineChatSnapshot = computed<OutlineSnapshot | null>(() => {
    const session = activeOutlineChatSession.value;
    if (!session) {
      return null;
    }

    if (session.activeSnapshotId) {
      const selected = session.snapshots.find(snapshot => snapshot.id === session.activeSnapshotId);
      if (selected) {
        return selected;
      }
    }

    return session.snapshots.at(-1) ?? null;
  });

  const patchDetailListByText = (
    chapter: number,
    field: 'beats' | 'mustInclude' | 'mustAvoid',
    text: string,
  ) => {
    const payload: Partial<ChapterDetail> = {};
    payload[field] = parseTextareaList(text);
    outlineStore.patchChapterDetail(chapter, payload);
  };

  const createOutlineChatSession = (input: CreateOutlineChatSessionInput = {}): OutlineSession => {
    const session = outlineStore.createSession({
      type: 'outline_chat',
      title: input.title,
      seed: input.seed,
      targetChapter: input.targetChapter,
    });

    lastOutlineChatParseError.value = null;
    return session;
  };

  const setActiveOutlineChatSession = (sessionId: string) => {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return;
    }

    const session = outlineChatSessions.value.find(item => item.id === normalizedSessionId);
    if (!session) {
      toastr.warning('指定的大纲会话不存在或类型不匹配');
      return;
    }

    outlineStore.setActiveSession(session.id);
    lastOutlineChatParseError.value = null;
  };

  const resolveOutlineChatSession = (
    preferredSessionId: string | null | undefined,
    autoCreate: boolean,
  ): OutlineSession | null => {
    const normalizedPreferredSessionId = preferredSessionId?.trim() || '';
    if (normalizedPreferredSessionId) {
      const preferred = outlineChatSessions.value.find(session => session.id === normalizedPreferredSessionId) ?? null;
      if (preferred) {
        if (outlineStore.activeSessionId !== preferred.id) {
          outlineStore.setActiveSession(preferred.id);
        }
        return preferred;
      }
    }

    const activeSession = activeOutlineChatSession.value;
    if (activeSession) {
      if (outlineStore.activeSessionId !== activeSession.id) {
        outlineStore.setActiveSession(activeSession.id);
      }
      return activeSession;
    }

    if (!autoCreate) {
      return null;
    }

    return createOutlineChatSession();
  };

  const clearOutlineChatParseError = () => {
    lastOutlineChatParseError.value = null;
  };

  const buildOutlineMentionContext = (): OutlineMentionContext => {
    return {
      foundation: foundationStore.foundation,
      storylines: outlineStore.sortedStorylines,
      masterOutline: outlineStore.sortedMasterOutline,
      detailsByChapter: outlineStore.detailsByChapter,
      mentionConfig: outlineStore.mentionConfig,
    };
  };

  const resolveMentionPayloadForSend = async (
    options: RunOutlineChatRoundOptions,
  ) => {
    return resolveSharedMentionPayloadForSend({
      mentions: options.mentions,
      mentionSnapshots: options.mentionSnapshots,
      mentionWarnings: options.mentionWarnings,
      context: buildOutlineMentionContext(),
      frozenAt: new Date().toISOString(),
    });
  };

  const runOutlineChatRound = async (
    options: RunOutlineChatRoundOptions = {},
  ): Promise<OutlineChatRoundResult | null> => {
    if (aiBusy.value) {
      toastr.warning('AI 正在处理上一条请求，请稍候');
      return null;
    }

    const session = resolveOutlineChatSession(options.sessionId, true);
    if (!session) {
      toastr.warning('请先创建大纲会话');
      return null;
    }

    const instruction = (options.instruction ?? outlineChatInput.value).trim();
    if (!instruction) {
      toastr.warning('请输入本轮协作指令');
      return null;
    }

    aiBusy.value = true;
    aiBusyAction.value = 'outline_chat';

    try {
      const mentionPayload = await resolveMentionPayloadForSend(options);

      const mentionWarnings = mentionPayload.mentionWarnings ?? [];
      if (mentionWarnings.length > 0) {
        const warningPreview = mentionWarnings.slice(0, 2).join('；');
        const extraCount = mentionWarnings.length - 2;
        const suffix = extraCount > 0 ? `；其余 ${extraCount} 条未展示` : '';
        toastr.warning(`@ 引用告警：${warningPreview}${suffix}`);
      }

      const result = await runOutlineChatRoundByService({
        store: {
          ai: outlineStore.ai,
          foundation: foundationStore.foundation,
          storylines: outlineStore.storylines,
          masterOutline: outlineStore.masterOutline,
          detailsByChapter: outlineStore.detailsByChapter,
          sessions: outlineStore.sessions,
          appendMessage: outlineStore.appendMessage,
          appendSnapshot: outlineStore.appendSnapshot,
        },
        sessionId: session.id,
        userInstruction: instruction,
        chapterCount: chapterCount.value,
        llm: resolveOutlineLLMOptions(),
        mentions: mentionPayload.mentions,
        mentionSnapshots: mentionPayload.mentionSnapshots,
        mentionWarnings: mentionPayload.mentionWarnings,
      });

      debugLogOutlineChatRoundResult(result, session.id);

      outlineChatInput.value = '';

      if (result.foundationPatch && Object.keys(result.foundationPatch).length > 0) {
        pendingFoundationPatch.value = result.foundationPatch;
      }

      if (result.parseWarnings.length > 0) {
        const warningPreview = result.parseWarnings.slice(0, 2).join('；');
        const extraCount = result.parseWarnings.length - 2;
        const suffix = extraCount > 0 ? `；其余 ${extraCount} 条未展示` : '';
        toastr.warning(`检测到命令冲突/告警：${warningPreview}${suffix}`);
      }

      if (result.parseError) {
        lastOutlineChatParseError.value = result.parseError;
        toastr.warning(`${result.parseError}，已保留当前结构化数据`);
      } else {
        lastOutlineChatParseError.value = null;
        captureFoundationSyncInfo();
        if (result.snapshot) {
          toastr.success(`已保存大纲快照 V${result.snapshot.version}`);
        } else {
          toastr.success('已完成本轮大纲协作');
        }
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '大纲协作失败');
      return null;
    } finally {
      aiBusy.value = false;
      aiBusyAction.value = null;
    }
  };

  const setActiveOutlineChatSnapshot = (snapshotId: string | null, sessionId?: string | null) => {
    const session = resolveOutlineChatSession(sessionId, false);
    if (!session) {
      return;
    }

    if (snapshotId === null) {
      outlineStore.setActiveSnapshot(session.id, null);
      return;
    }

    const normalizedSnapshotId = snapshotId.trim();
    if (!normalizedSnapshotId) {
      return;
    }

    if (!session.snapshots.some(snapshot => snapshot.id === normalizedSnapshotId)) {
      return;
    }

    outlineStore.setActiveSnapshot(session.id, normalizedSnapshotId);
  };

  const applyOutlineSnapshot = (
    snapshotId: string,
    options: ApplyOutlineSnapshotOptions & { sessionId?: string | null } = {},
  ): OutlineSnapshot | null => {
    const normalizedSnapshotId = snapshotId.trim();
    if (!normalizedSnapshotId) {
      toastr.warning('请先选择要应用的快照');
      return null;
    }

    const session = resolveOutlineChatSession(options.sessionId, false);
    if (!session) {
      toastr.warning('请先创建或选择大纲会话');
      return null;
    }

    const applied = outlineStore.applySnapshot(session.id, normalizedSnapshotId, {
      applyDetails: options.applyDetails === true,
    });

    if (!applied) {
      toastr.warning('快照应用失败，请刷新后重试');
      return null;
    }

    if (options.applyDetails) {
      toastr.success(`已应用快照 V${applied.version}，并覆盖细纲`);
    } else {
      toastr.success(`已应用快照 V${applied.version}`);
    }

    return applied;
  };

  const deleteLastOutlineChatRequest = (sessionId?: string | null): string | null => {
    if (aiBusy.value) {
      toastr.warning('AI 正在处理上一条请求，请稍候');
      return null;
    }

    const session = resolveOutlineChatSession(sessionId, false);
    if (!session) {
      toastr.warning('请先创建或选择大纲会话');
      return null;
    }

    const removed = outlineStore.removeLastChatRound(session.id);
    if (!removed) {
      toastr.warning('指定的大纲会话不存在或类型不匹配');
      return null;
    }

    const instruction = removed.lastUserInstruction?.trim() ?? '';
    if (!instruction) {
      toastr.info('当前对话没有可删除的请求');
      return null;
    }

    lastOutlineChatParseError.value = null;

    if (removed.removedSnapshot) {
      toastr.success(`已删除上一次请求，并移除草案 V${removed.removedSnapshot.version}`);
    } else {
      toastr.success('已删除上一次请求');
    }

    return instruction;
  };

  const retryLastOutlineChatRequest = async (sessionId?: string | null): Promise<OutlineChatRoundResult | null> => {
    if (aiBusy.value) {
      toastr.warning('AI 正在处理上一条请求，请稍候');
      return null;
    }

    const session = resolveOutlineChatSession(sessionId, false);
    if (!session) {
      toastr.warning('请先创建或选择大纲会话');
      return null;
    }

    const removed = outlineStore.removeLastChatRound(session.id);
    if (!removed) {
      toastr.warning('指定的大纲会话不存在或类型不匹配');
      return null;
    }

    const instruction = removed.lastUserInstruction?.trim() ?? '';
    if (!instruction) {
      toastr.info('当前对话没有可重试的请求');
      return null;
    }

    lastOutlineChatParseError.value = null;
    toastr.info('已回退上一次请求，正在重试…');

    const removedUserMessage =
      [...removed.removedMessages].reverse().find(message => message.role === 'user') ?? null;
    const retryMentions = normalizeMentionRefs(removedUserMessage?.mentions);
    const retryMentionWarnings = normalizeMentionWarnings(removedUserMessage?.mentionWarnings);
    const shouldReuseFrozenMentions =
      Array.isArray(removedUserMessage?.mentionSnapshots) || retryMentionWarnings.length > 0;

    const retryOptions: RunOutlineChatRoundOptions = {
      sessionId: session.id,
      instruction,
      mentions: retryMentions.length > 0 ? retryMentions : undefined,
      mentionWarnings: retryMentionWarnings.length > 0 ? retryMentionWarnings : undefined,
    };

    if (shouldReuseFrozenMentions) {
      retryOptions.mentionSnapshots = normalizeMentionSnapshots(removedUserMessage?.mentionSnapshots);
    }

    return runOutlineChatRound(retryOptions);
  };

  const generateMaster = async () => {
    if (aiBusy.value) {
      toastr.warning('AI 正在处理上一条请求，请稍候');
      return;
    }

    if (!(await ensureFoundationGenerationReady('master'))) {
      return;
    }

    aiBusy.value = true;
    aiBusyAction.value = 'master';

    try {
      const nodes = await generateMasterOutlineByAI({
        foundation: foundationStore.foundation,
        chapterCount: chapterCount.value,
        aiConfig: outlineStore.ai,
        llm: resolveOutlineLLMOptions(),
      });

      outlineStore.replaceMasterOutline(nodes);
      captureFoundationSyncInfo();
      toastr.success(`已生成 ${nodes.length} 个总纲节点`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '总纲生成失败');
    } finally {
      aiBusy.value = false;
      aiBusyAction.value = null;
    }
  };

  const deriveDetails = async () => {
    if (aiBusy.value) {
      toastr.warning('AI 正在处理上一条请求，请稍候');
      return;
    }

    if (outlineStore.masterOutline.length === 0) {
      toastr.warning('请先生成或填写总纲后再派生细纲');
      return;
    }

    if (!(await ensureFoundationGenerationReady('detail'))) {
      return;
    }

    aiBusy.value = true;
    aiBusyAction.value = 'detail';

    try {
      const details = await deriveChapterDetailsByAI({
        foundation: foundationStore.foundation,
        masterOutline: outlineStore.masterOutline,
        chapterCount: chapterCount.value,
        aiConfig: outlineStore.ai,
        llm: resolveOutlineLLMOptions(),
      });

      outlineStore.replaceChapterDetails(details);
      captureFoundationSyncInfo();
      toastr.success(`已派生 ${details.length} 章细纲`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '细纲派生失败');
    } finally {
      aiBusy.value = false;
      aiBusyAction.value = null;
    }
  };

  const rewriteDetail = async (chapter: number | null | undefined) => {
    const targetChapter = normalizeChapter(chapter, settingsStore.settings.currentChapter + 1);

    if (aiBusy.value) {
      toastr.warning('AI 正在处理上一条请求，请稍候');
      return;
    }

    if (!(await ensureFoundationGenerationReady('rewrite'))) {
      return;
    }

    aiBusy.value = true;
    aiBusyAction.value = 'rewrite';

    try {
      const rewritten = await rewriteChapterDetailByAI({
        foundation: foundationStore.foundation,
        masterOutline: outlineStore.masterOutline,
        chapter: targetChapter,
        currentDetail: outlineStore.getChapterDetail(targetChapter),
        aiConfig: outlineStore.ai,
        llm: resolveOutlineLLMOptions(),
      });

      outlineStore.setChapterDetail(rewritten);
      captureFoundationSyncInfo();
      toastr.success(`第 ${targetChapter} 章细纲已重写`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '章节细纲重写失败');
    } finally {
      aiBusy.value = false;
      aiBusyAction.value = null;
    }
  };

  const getPreferredChapter = (preferred: number | null | undefined): number => {
    return normalizeChapter(preferred, settingsStore.settings.currentChapter + 1);
  };

  const ensureChapterDetail = (chapter: number | null | undefined): ChapterDetail => {
    const targetChapter = getPreferredChapter(chapter);
    const parentNodeId = outlineStore.findMasterNodeByChapter(targetChapter)?.id ?? '';
    return outlineStore.ensureChapterDetail(targetChapter, parentNodeId);
  };

  const acceptFoundationPatch = () => {
    if (pendingFoundationPatch.value) {
      foundationStore.applyFoundationPatch(pendingFoundationPatch.value);
      pendingFoundationPatch.value = null;
      toastr.success('已将 AI 建议的修改写入故事基底');
    }
  };

  const rejectFoundationPatch = () => {
    pendingFoundationPatch.value = null;
  };


  return {
    aiBusy,
    aiBusyAction,
    chapterCount,
    canGenerateMasterOutline,
    canDeriveDetails,
    canRewriteDetail,
    canRunOutlineChat,
    canDeleteLastOutlineChatRequest,
    canRetryLastOutlineChatRequest,

    pendingFoundationPatch,
    hasPendingFoundationPatch,
    acceptFoundationPatch,
    rejectFoundationPatch,

    foundationGenerationReminder,
    cancelFoundationGenerationReminder,
    confirmFoundationGenerationReminder,

    outlineChatInput,
    lastOutlineChatParseError,
    outlineChatSessions,
    activeOutlineChatSession,
    activeOutlineChatMessages,
    activeOutlineChatSnapshots,
    activeOutlineChatSnapshot,

    patchDetailListByText,
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
    rewriteDetail,
    getPreferredChapter,
    ensureChapterDetail,
  };
}
