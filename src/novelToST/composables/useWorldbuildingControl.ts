import { computed, ref } from 'vue';
import {
  checkDraftConsistencyByAI,
  expandDraftByAI,
  generateCandidatesByAI,
  refineDraftByAI,
  type WorldbuildingAIRuntimeOptions,
  type WorldbuildingDraftAIResult,
  type WorldbuildingAIRequestInput,
  type WorldbuildingEnvironmentHints,
} from '../core/worldbuilding-ai.service';
import {
  type OutlineMentionContext,
} from '../core/outline-mention.service';
import {
  resolveMentionPayloadForSend as resolveSharedMentionPayloadForSend,
} from './shared/useMentionPayloadResolver';
import { resolveLLMCustomConfigFromWorldbookSettings } from '../core/llm-api.service';
import { useFoundationStore } from '../stores/foundation.store';
import { useOutlineStore } from '../stores/outline.store';
import { useNovelSettingsStore } from '../stores/settings.store';
import { useWorldbuildingStore } from '../stores/worldbuilding.store';
import type { OutlineMentionRef, OutlineMentionSnapshot } from '../types/outline';
import type { StoryFoundation } from '../types/foundation';
import type {
  WorldbuildingAIBusyAction,
  WorldbuildingDraft,
  WorldbuildingDraftField,
  WorldbuildingDraftVersion,
  WorldbuildingSession,
} from '../types/worldbuilding';

type WorldbuildingEnvironmentSnapshot = {
  loadedPresetName: string | null;
  currentCharacterName: string | null;
  activePromptCount: number | null;
};

type RunWorldbuildingActionOptions = {
  mentions?: OutlineMentionRef[];
  mentionSnapshots?: OutlineMentionSnapshot[];
  mentionWarnings?: string[];
};

const DRAFT_FIELD_KEYS: WorldbuildingDraftField[] = [
  'name',
  'aliases',
  'summary',
  'facts',
  'constraints',
  'relations',
  'extra',
];

const DEFAULT_USER_INSTRUCTION_BY_ACTION: Record<WorldbuildingAIBusyAction, string> = {
  expand: '请基于当前草案进行扩写，补全细节。',
  refine: '请在保持核心设定不变的前提下精修当前草案。',
  consistency: '请检查草案一致性并给出修正版本。',
  candidates: '请将当前草案转换为世界书条目。',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function extractActivePromptCountFromPreset(preset: unknown): number | null {
  if (!isRecord(preset) || !Array.isArray(preset.prompts)) {
    return null;
  }

  const count = preset.prompts.reduce((total, prompt) => {
    if (!isRecord(prompt) || prompt.enabled !== true) {
      return total;
    }
    return total + 1;
  }, 0);

  return Math.max(0, count);
}

function readEnvironmentSnapshot(): WorldbuildingEnvironmentSnapshot {
  let loadedPresetName: string | null = null;
  let currentCharacterName: string | null = null;
  let activePromptCount: number | null = null;

  try {
    loadedPresetName = normalizeNullableString(getLoadedPresetName());
  } catch (error) {
    console.warn('[novelToST][worldbuilding] 读取当前预设名称失败', error);
  }

  try {
    currentCharacterName = normalizeNullableString(getCurrentCharacterName());
  } catch (error) {
    console.warn('[novelToST][worldbuilding] 读取当前角色卡名称失败', error);
  }

  try {
    const inUsePreset = getPreset('in_use');
    activePromptCount = extractActivePromptCountFromPreset(inUsePreset);
  } catch (error) {
    console.warn('[novelToST][worldbuilding] 读取 in_use 预设失败', error);
  }

  return {
    loadedPresetName,
    currentCharacterName,
    activePromptCount,
  };
}

function buildCollaborationHints(snapshot: WorldbuildingEnvironmentSnapshot): string[] {
  const hints: string[] = [];

  if (snapshot.loadedPresetName) {
    hints.push(`当前加载预设：${snapshot.loadedPresetName}。建议在需求中说明希望沿用的文风与输出粒度。`);
  } else {
    hints.push('未检测到当前预设名称。建议手动说明期望文风，避免输出风格漂移。');
  }

  if (snapshot.currentCharacterName) {
    hints.push(`当前角色卡：${snapshot.currentCharacterName}。可在设定中明确与该角色的关系与冲突。`);
  } else {
    hints.push('当前聊天未绑定角色卡名称。建议在需求里显式说明主视角角色。');
  }

  if (snapshot.activePromptCount !== null) {
    hints.push(`in_use 预设中启用提示词约 ${snapshot.activePromptCount} 条。若设定跑偏，可先调整预设后再扩写。`);
  }

  return hints;
}

function resolveInstructionByAction(action: WorldbuildingAIBusyAction, input: string): string {
  const normalized = input.trim();
  if (normalized) {
    return normalized;
  }

  return DEFAULT_USER_INSTRUCTION_BY_ACTION[action];
}

function mergeDraftWithLockedFields(
  currentDraft: WorldbuildingDraft,
  nextDraft: WorldbuildingDraft,
  lockedFields: string[],
): WorldbuildingDraft {
  const normalizedLocks = new Set(lockedFields.map(field => field.trim()).filter(Boolean));

  const merged: WorldbuildingDraft = {
    ...nextDraft,
    aliases: [...nextDraft.aliases],
    facts: [...nextDraft.facts],
    constraints: [...nextDraft.constraints],
    relations: nextDraft.relations.map(relation => ({
      target: relation.target,
      relation: relation.relation,
    })),
    extra: { ...nextDraft.extra },
  };

  const assignLockedField = (field: WorldbuildingDraftField) => {
    switch (field) {
      case 'name':
        merged.name = currentDraft.name;
        return;
      case 'aliases':
        merged.aliases = [...currentDraft.aliases];
        return;
      case 'summary':
        merged.summary = currentDraft.summary;
        return;
      case 'facts':
        merged.facts = [...currentDraft.facts];
        return;
      case 'constraints':
        merged.constraints = [...currentDraft.constraints];
        return;
      case 'relations':
        merged.relations = currentDraft.relations.map(relation => ({
          target: relation.target,
          relation: relation.relation,
        }));
        return;
      case 'extra':
        merged.extra = { ...currentDraft.extra };
        return;
      default: {
        const exhaustive: never = field;
        return exhaustive;
      }
    }
  };

  DRAFT_FIELD_KEYS.forEach(field => {
    if (!normalizedLocks.has(field)) {
      return;
    }

    assignLockedField(field);
  });

  return merged;
}

function areDraftsEqual(left: WorldbuildingDraft, right: WorldbuildingDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveBaseVersion(session: WorldbuildingSession | null, preferredVersionId: string | null): WorldbuildingDraftVersion | null {
  if (!session) {
    return null;
  }

  if (preferredVersionId) {
    const preferred = session.versions.find(version => version.id === preferredVersionId);
    if (preferred) {
      return preferred;
    }
  }

  if (session.activeVersionId) {
    const active = session.versions.find(version => version.id === session.activeVersionId);
    if (active) {
      return active;
    }
  }

  return session.versions.at(-1) ?? null;
}

function buildAIRequestInput(input: {
  session: WorldbuildingSession;
  baseVersion: WorldbuildingDraftVersion;
  instruction: string;
  environment: WorldbuildingEnvironmentSnapshot;
  foundation: StoryFoundation;
  mentionSnapshots?: OutlineMentionSnapshot[];
  mentionWarnings?: string[];
}): WorldbuildingAIRequestInput {
  const environmentHints: WorldbuildingEnvironmentHints = {
    loadedPresetName: input.environment.loadedPresetName,
    currentCharacterName: input.environment.currentCharacterName,
    activePromptCount: input.environment.activePromptCount,
  };

  return {
    type: input.session.type,
    sessionTitle: input.session.title,
    seed: input.session.seed,
    userInstruction: input.instruction,
    draft: input.baseVersion.draft,
    lockedFields: input.baseVersion.lockedFields,
    recentMessages: input.session.messages.slice(-12),
    environment: environmentHints,
    foundation: input.foundation,
    mentionSnapshots: input.mentionSnapshots,
    mentionWarnings: input.mentionWarnings,
  };
}

export function useWorldbuildingControl() {
  const worldbuildingStore = useWorldbuildingStore();
  const settingsStore = useNovelSettingsStore();
  const outlineStore = useOutlineStore();
  const foundationStore = useFoundationStore();

  const messageInput = ref('');
  const aiBusy = ref(false);
  const aiBusyAction = ref<WorldbuildingAIBusyAction | null>(null);
  const lastParseWarning = ref<string | null>(null);
  const lastConsistencyIssues = ref<string[]>([]);
  const environmentSnapshot = ref<WorldbuildingEnvironmentSnapshot>(readEnvironmentSnapshot());

  const activeSession = computed(() => worldbuildingStore.activeSession);
  const activeVersion = computed(() => worldbuildingStore.activeVersion);

  const canRunAI = computed(() => !aiBusy.value && activeSession.value !== null && activeVersion.value !== null);

  const lastActionType = ref<WorldbuildingAIBusyAction | null>(null);

  const canRetryLastRound = computed(() => {
    if (aiBusy.value) return false;
    const session = activeSession.value;
    if (!session) return false;
    return worldbuildingStore.getLastRoundUserInstruction(session.id) !== null;
  });

  const canDeleteLastRound = computed(() => {
    if (aiBusy.value) return false;
    const session = activeSession.value;
    if (!session) return false;
    return worldbuildingStore.getLastRoundUserInstruction(session.id) !== null;
  });

  const collaborationHints = computed(() => buildCollaborationHints(environmentSnapshot.value));

  const buildWorldbuildingMentionContext = (): OutlineMentionContext => {
    return {
      foundation: foundationStore.foundation,
      storylines: outlineStore.sortedStorylines,
      masterOutline: outlineStore.sortedMasterOutline,
      detailsByChapter: outlineStore.detailsByChapter,
      mentionConfig: outlineStore.mentionConfig,
    };
  };

  const resolveMentionPayloadForSend = async (
    options: RunWorldbuildingActionOptions,
  ) => {
    const payload = await resolveSharedMentionPayloadForSend({
      mentions: options.mentions,
      mentionSnapshots: options.mentionSnapshots,
      mentionWarnings: options.mentionWarnings,
      context: buildWorldbuildingMentionContext(),
      frozenAt: new Date().toISOString(),
    });
    return {
      mentionSnapshots: payload.mentionSnapshots,
      mentionWarnings: payload.mentionWarnings,
    };
  };

  const resolveWorldbuildingLLMOptions = (): WorldbuildingAIRuntimeOptions => {
    const worldbookSettings = settingsStore.settings.worldbook;
    const timeoutMs = worldbookSettings.apiTimeout;

    if (worldbookSettings.useTavernApi) {
      return {
        provider: 'tavern',
        timeoutMs,
      };
    }

    return {
      provider: 'custom',
      model: worldbookSettings.customApiModel,
      timeoutMs,
      customProviderFallbackWarning: '[novelToST][worldbuilding-ai] provider=custom 缺少 custom_api 配置，当前回退 Tavern 预设通道',
      customConfig: resolveLLMCustomConfigFromWorldbookSettings(worldbookSettings),
    };
  };

  const refreshEnvironmentHints = () => {
    environmentSnapshot.value = readEnvironmentSnapshot();
  };

  const clearMessages = () => {
    const session = activeSession.value;
    if (!session) {
      return;
    }

    worldbuildingStore.clearMessages(session.id);
    lastParseWarning.value = null;
    lastConsistencyIssues.value = [];
  };

  const appendAssistantMessage = (sessionId: string, text: string) => {
    const normalized = text.trim() || '已完成本轮协作。';
    worldbuildingStore.appendMessage(sessionId, {
      role: 'assistant',
      text: normalized,
    });
  };

  const runDraftAction = async (
    action: Exclude<WorldbuildingAIBusyAction, 'candidates'>,
    executor: (
      input: WorldbuildingAIRequestInput,
      llm?: WorldbuildingAIRuntimeOptions,
    ) => Promise<WorldbuildingDraftAIResult>,
    options: RunWorldbuildingActionOptions = {},
  ): Promise<boolean> => {
    if (aiBusy.value) {
      toastr.warning('AI 还在处理上一条请求，请稍等片刻。');
      return false;
    }

    const session = activeSession.value;
    const version = activeVersion.value;
    if (!session || !version) {
      toastr.warning('请先创建或选择会话，再发起 AI 协作。');
      return false;
    }

    const sessionId = session.id;
    const baseVersionId = version.id;
    const instruction = resolveInstructionByAction(action, messageInput.value);

    worldbuildingStore.appendMessage(sessionId, {
      role: 'user',
      text: instruction,
    });
    messageInput.value = '';

    aiBusy.value = true;
    aiBusyAction.value = action;
    lastActionType.value = action;
    lastParseWarning.value = null;
    lastConsistencyIssues.value = [];

    try {
      refreshEnvironmentHints();
      const mentionPayload = await resolveMentionPayloadForSend(options);

      const mentionWarnings = mentionPayload.mentionWarnings ?? [];
      if (mentionWarnings.length > 0) {
        const warningPreview = mentionWarnings.slice(0, 2).join('；');
        const extraCount = mentionWarnings.length - 2;
        const suffix = extraCount > 0 ? `；其余 ${extraCount} 条未展示` : '';
        toastr.warning(`@ 引用告警：${warningPreview}${suffix}`);
      }

      const sessionAfterUserInput = worldbuildingStore.sessions.find(item => item.id === sessionId);
      const baseVersionAfterUserInput = resolveBaseVersion(sessionAfterUserInput ?? null, baseVersionId);
      if (!sessionAfterUserInput || !baseVersionAfterUserInput) {
        throw new Error('会话或版本已失效，请重新选择后重试');
      }

      const result = await executor(
        buildAIRequestInput({
          session: sessionAfterUserInput,
          baseVersion: baseVersionAfterUserInput,
          instruction,
          environment: environmentSnapshot.value,
          foundation: foundationStore.foundation,
          mentionSnapshots: mentionPayload.mentionSnapshots,
          mentionWarnings: mentionPayload.mentionWarnings,
        }),
        resolveWorldbuildingLLMOptions(),
      );

      appendAssistantMessage(sessionId, result.assistantText);

      if (result.consistencyIssues.length > 0) {
        lastConsistencyIssues.value = [...result.consistencyIssues];
      }

      if (!result.draft) {
        lastParseWarning.value = result.parseError ?? '结构化解析失败，请稍后重试';
        toastr.warning(`${lastParseWarning.value}，已保留当前草案`);
        return true;
      }

      const latestSession = worldbuildingStore.sessions.find(item => item.id === sessionId);
      const latestBaseVersion = resolveBaseVersion(latestSession ?? null, baseVersionId);
      if (!latestSession || !latestBaseVersion) {
        throw new Error('会话或版本已失效，请重新选择后重试');
      }

      const mergedDraft = mergeDraftWithLockedFields(latestBaseVersion.draft, result.draft, latestBaseVersion.lockedFields);

      if (areDraftsEqual(mergedDraft, latestBaseVersion.draft)) {
        toastr.info('已记录本轮回复，但草案结构没有变化。');
      } else {
        const createdVersion = worldbuildingStore.appendDraftVersion(latestSession.id, {
          draft: mergedDraft,
          lockedFields: latestBaseVersion.lockedFields,
        });

        if (createdVersion) {
          toastr.success(`草案已更新，已保存为 V${createdVersion.version}。`);
        } else {
          toastr.warning('草案已更新，但保存新版本失败，请重试。');
        }
      }

      if (lastConsistencyIssues.value.length > 0) {
        toastr.info(`检测到 ${lastConsistencyIssues.value.length} 条一致性提醒，可在提交前处理。`);
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, 'AI 协作请求失败');
      return false;
    } finally {
      aiBusy.value = false;
      aiBusyAction.value = null;
    }
  };

  const runCandidateAction = async (options: RunWorldbuildingActionOptions = {}): Promise<boolean> => {
    if (aiBusy.value) {
      toastr.warning('AI 还在处理上一条请求，请稍等片刻。');
      return false;
    }

    const session = activeSession.value;
    const version = activeVersion.value;
    if (!session || !version) {
      toastr.warning('请先创建或选择会话，再生成世界书条目。');
      return false;
    }

    const sessionId = session.id;
    const baseVersionId = version.id;
    const instruction = resolveInstructionByAction('candidates', messageInput.value);

    worldbuildingStore.appendMessage(sessionId, {
      role: 'user',
      text: instruction,
    });
    messageInput.value = '';

    aiBusy.value = true;
    aiBusyAction.value = 'candidates';
    lastActionType.value = 'candidates';
    lastParseWarning.value = null;
    lastConsistencyIssues.value = [];

    try {
      refreshEnvironmentHints();
      const mentionPayload = await resolveMentionPayloadForSend(options);

      const mentionWarnings = mentionPayload.mentionWarnings ?? [];
      if (mentionWarnings.length > 0) {
        const warningPreview = mentionWarnings.slice(0, 2).join('；');
        const extraCount = mentionWarnings.length - 2;
        const suffix = extraCount > 0 ? `；其余 ${extraCount} 条未展示` : '';
        toastr.warning(`@ 引用告警：${warningPreview}${suffix}`);
      }

      const sessionAfterUserInput = worldbuildingStore.sessions.find(item => item.id === sessionId);
      const baseVersionAfterUserInput = resolveBaseVersion(sessionAfterUserInput ?? null, baseVersionId);
      if (!sessionAfterUserInput || !baseVersionAfterUserInput) {
        throw new Error('会话或版本已失效，请重新选择后重试');
      }

      const result = await generateCandidatesByAI(
        buildAIRequestInput({
          session: sessionAfterUserInput,
          baseVersion: baseVersionAfterUserInput,
          instruction,
          environment: environmentSnapshot.value,
          foundation: foundationStore.foundation,
          mentionSnapshots: mentionPayload.mentionSnapshots,
          mentionWarnings: mentionPayload.mentionWarnings,
        }),
        resolveWorldbuildingLLMOptions(),
      );

      appendAssistantMessage(sessionId, result.assistantText);

      if (result.candidates.length === 0) {
        if (result.parseError) {
          lastParseWarning.value = result.parseError;
          toastr.warning(`${result.parseError}，候选列表保持不变`);
        } else {
          toastr.info('这轮没有生成可用候选，可补充需求后重试。');
        }
        return true;
      }

      worldbuildingStore.setCandidates(result.candidates);
      toastr.success(`已生成 ${result.candidates.length} 条世界书条目，可先做冲突预览。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '候选生成失败');
      return false;
    } finally {
      aiBusy.value = false;
      aiBusyAction.value = null;
    }

    return true;
  };

  const runExpand = async (options: RunWorldbuildingActionOptions = {}): Promise<boolean> => {
    return runDraftAction('expand', expandDraftByAI, options);
  };

  const runRefine = async (options: RunWorldbuildingActionOptions = {}): Promise<boolean> => {
    return runDraftAction('refine', refineDraftByAI, options);
  };

  const runConsistencyCheck = async (options: RunWorldbuildingActionOptions = {}): Promise<boolean> => {
    return runDraftAction('consistency', checkDraftConsistencyByAI, options);
  };

  const runGenerateCandidates = async (options: RunWorldbuildingActionOptions = {}): Promise<boolean> => {
    return runCandidateAction(options);
  };

  const retryLastRound = async (): Promise<boolean> => {
    const session = activeSession.value;
    if (!session) {
      toastr.warning('没有活跃会话，无法重试。');
      return false;
    }

    const instruction = worldbuildingStore.getLastRoundUserInstruction(session.id);
    if (!instruction) {
      toastr.warning('没有可重试的对话记录。');
      return false;
    }

    worldbuildingStore.deleteLastRound(session.id);
    lastParseWarning.value = null;
    lastConsistencyIssues.value = [];

    const actionToRetry = lastActionType.value;
    messageInput.value = instruction;

    if (actionToRetry === 'candidates') {
      return runCandidateAction();
    }

    if (actionToRetry === 'expand') {
      return runDraftAction('expand', expandDraftByAI);
    }

    if (actionToRetry === 'refine') {
      return runDraftAction('refine', refineDraftByAI);
    }

    if (actionToRetry === 'consistency') {
      return runDraftAction('consistency', checkDraftConsistencyByAI);
    }

    return runDraftAction('expand', expandDraftByAI);
  };

  const deleteLastRound = (): void => {
    const session = activeSession.value;
    if (!session || !canDeleteLastRound.value) {
      return;
    }

    worldbuildingStore.deleteLastRound(session.id);
    lastParseWarning.value = null;
    lastConsistencyIssues.value = [];
  };

  return {
    messageInput,
    aiBusy,
    aiBusyAction,
    canRunAI,
    canRetryLastRound,
    canDeleteLastRound,
    collaborationHints,
    lastParseWarning,
    lastConsistencyIssues,
    refreshEnvironmentHints,
    clearMessages,
    retryLastRound,
    deleteLastRound,
    runExpand,
    runRefine,
    runConsistencyCheck,
    runGenerateCandidates,
  };
}
