import { computed, ref } from 'vue';
import {
  runFoundationCollaborationByAI,
  type FoundationAIResult,
  type FoundationAIRuntimeOptions,
} from '../core/foundation-ai.service';
import { FOUNDATION_MODULE_LABELS } from '../core/foundation-tier';
import { resolveLLMCustomConfigFromWorldbookSettings } from '../core/llm-api.service';
import { useFoundationStore } from '../stores/foundation.store';
import { useNovelSettingsStore } from '../stores/settings.store';
import type { FoundationModuleId } from '../types/foundation';

type RunFoundationCollaborateOptions = {
  instruction?: string;
  targetModule?: FoundationModuleId | null;
};

const FOUNDATION_USER_WARNING_MESSAGES = {
  noAutoWrite: '本轮有建议，但没有自动写入表单。你已经填写的内容没有变化。可手动参考本轮回复，或再试一次。',
  noUsableFields: '本轮没有生成可直接填入表单的内容。可以把要求说得更具体一些，再试一次。',
  partialApplied: '本轮只保留了符合格式的部分内容。已写入的内容已经更新，其余内容不会受影响。',
} as const;

function buildDebugParseWarning(parseError: string | null, warnings: string[]): string | null {
  const warningList = warnings.map(item => item.trim()).filter(Boolean);

  if (!parseError && warningList.length === 0) {
    return null;
  }

  if (!parseError) {
    return warningList.join('；');
  }

  if (warningList.length === 0) {
    return parseError;
  }

  return `${parseError}；${warningList.join('；')}`;
};

function resolveUserFacingWarning(
  result: Pick<FoundationAIResult, 'parseError' | 'parseWarnings' | 'foundationPatch'>,
): string | null {
  if (result.parseError) {
    if (result.parseError.includes('foundationPatch 为空或无有效字段')) {
      return FOUNDATION_USER_WARNING_MESSAGES.noUsableFields;
    }

    return FOUNDATION_USER_WARNING_MESSAGES.noAutoWrite;
  }

  return result.parseWarnings.length > 0 ? FOUNDATION_USER_WARNING_MESSAGES.partialApplied : null;
}

export function useFoundationControl() {
  const foundationStore = useFoundationStore();
  const settingsStore = useNovelSettingsStore();

  const messageInput = ref('');
  const aiBusy = ref(false);
  const aiBusyModuleId = ref<FoundationModuleId | null>(null);
  const lastParseWarning = ref<string | null>(null);

  const canRunAI = computed(() => !aiBusy.value);

  const canRetryLastRound = computed(() => {
    if (aiBusy.value) return false;
    return foundationStore.getLastRoundUserInstruction() !== null;
  });

  const canDeleteLastRound = computed(() => {
    if (aiBusy.value) return false;
    return foundationStore.getLastRoundUserInstruction() !== null;
  });

  const resolveFoundationLLMOptions = (): FoundationAIRuntimeOptions => {
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
      customProviderFallbackWarning:
        '[novelToST][foundation-ai] provider=custom 缺少 custom_api 配置，当前回退 Tavern 预设通道',
      customConfig: resolveLLMCustomConfigFromWorldbookSettings(worldbookSettings),
    };
  };

  const clearMessages = () => {
    foundationStore.clearMessages();
    lastParseWarning.value = null;
  };

  const runCollaborate = async (options: RunFoundationCollaborateOptions = {}): Promise<boolean> => {
    if (aiBusy.value) {
      toastr.warning('AI 正在处理上一条请求，请稍候。');
      return false;
    }

    const instruction = (options.instruction ?? messageInput.value).trim();
    if (!instruction) {
      toastr.warning('请输入本轮故事基底协作指令。');
      return false;
    }

    const targetModule = options.targetModule ?? null;

    foundationStore.addMessage({
      role: 'user',
      text: instruction,
    });

    if (options.instruction == null) {
      messageInput.value = '';
    }

    aiBusy.value = true;
    aiBusyModuleId.value = targetModule;
    lastParseWarning.value = null;

    try {
      const result = await runFoundationCollaborationByAI(
        {
          foundation: foundationStore.foundation,
          recentMessages: foundationStore.messages.slice(-12),
          userInstruction: instruction,
          targetModule,
        },
        resolveFoundationLLMOptions(),
      );

      foundationStore.addMessage({
        role: 'assistant',
        text: result.assistantText,
        parseError: result.parseError,
        rawResponse: result.rawResponse,
      });

      const debugParseWarning = buildDebugParseWarning(result.parseError, result.parseWarnings);
      if (debugParseWarning) {
        console.warn('[novelToST][foundation-ai] parse feedback', {
          parseError: result.parseError,
          parseWarnings: result.parseWarnings,
          foundationPatch: result.foundationPatch,
          targetModule,
        });
      }

      const userWarning = resolveUserFacingWarning(result);
      lastParseWarning.value = userWarning;

      if (result.parseError) {
        toastr.warning(userWarning ?? FOUNDATION_USER_WARNING_MESSAGES.noAutoWrite);
        return true;
      }

      if (!result.foundationPatch) {
        lastParseWarning.value = FOUNDATION_USER_WARNING_MESSAGES.noUsableFields;
        toastr.warning(lastParseWarning.value);
        return true;
      }

      foundationStore.applyFoundationPatch(result.foundationPatch);

      if (result.parseWarnings.length > 0) {
        lastParseWarning.value = FOUNDATION_USER_WARNING_MESSAGES.partialApplied;
      }

      if (targetModule) {
        toastr.success(`已完成「${FOUNDATION_MODULE_LABELS[targetModule]}」模块协作并更新表单。`);
      } else {
        toastr.success('已完成本轮故事基底协作并更新表单。');
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(message, '故事基底 AI 协作失败');
      return false;
    } finally {
      aiBusy.value = false;
      aiBusyModuleId.value = null;
    }
  };

  const runModuleAssist = async (moduleId: FoundationModuleId, instruction?: string): Promise<boolean> => {
    const normalizedInstruction = instruction?.trim();
    const fallbackInstruction = `请只处理「${FOUNDATION_MODULE_LABELS[moduleId]}」。先补空白字段，再补已经很模糊的内容。返回的内容要能直接写进表单；如果信息不够，就不要硬填。`;

    return runCollaborate({
      targetModule: moduleId,
      instruction: normalizedInstruction || fallbackInstruction,
    });
  };

  const retryLastRound = async (): Promise<boolean> => {
    const instruction = foundationStore.getLastRoundUserInstruction();
    if (!instruction) {
      toastr.warning('没有可重试的对话记录。');
      return false;
    }

    foundationStore.deleteLastRound();
    lastParseWarning.value = null;

    return runCollaborate({ instruction });
  };

  const deleteLastRound = (): void => {
    if (!canDeleteLastRound.value) {
      return;
    }

    foundationStore.deleteLastRound();
    lastParseWarning.value = null;
  };

  return {
    messageInput,
    aiBusy,
    aiBusyModuleId,
    canRunAI,
    lastParseWarning,
    canRetryLastRound,
    canDeleteLastRound,
    clearMessages,
    retryLastRound,
    deleteLastRound,
    runCollaborate,
    runModuleAssist,
  };
}
