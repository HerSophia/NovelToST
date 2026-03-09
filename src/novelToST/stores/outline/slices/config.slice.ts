import type {
  OutlineAIConfig,
  OutlineMentionConfig,
  OutlineMissingDetailPolicy,
} from '../../../types/outline';
import { normalizeAIConfig, normalizeOutlineMentionConfig } from '../core/outline.domain';
import { OutlineMissingDetailPolicySchema } from '../core/outline.schemas';
import type { OutlineMutationContext } from './context';

type OutlineMentionConfigPatch = Partial<{
  worldbookEntryLabel: Partial<OutlineMentionConfig['worldbookEntryLabel']>;
}>;

export function createConfigSlice(context: OutlineMutationContext) {
  const setEnabled = (value: boolean) => {
    context.enabled.value = Boolean(value);
    context.touchUpdatedAt();
  };

  const setMissingDetailPolicy = (policy: OutlineMissingDetailPolicy) => {
    context.missingDetailPolicy.value = OutlineMissingDetailPolicySchema.parse(policy);
    context.touchUpdatedAt();
  };

  const setAIConfig = (patch: Partial<OutlineAIConfig>) => {
    context.ai.value = normalizeAIConfig({
      ...context.ai.value,
      ...patch,
    });
    context.touchUpdatedAt();
  };

  const patchMentionConfig = (patch: OutlineMentionConfigPatch) => {
    const nextConfig = normalizeOutlineMentionConfig({
      ...context.mentionConfig.value,
      ...patch,
      worldbookEntryLabel: {
        ...context.mentionConfig.value.worldbookEntryLabel,
        ...(patch.worldbookEntryLabel ?? {}),
      },
    });

    context.mentionConfig.value = nextConfig;
    context.touchUpdatedAt();
  };

  return {
    setEnabled,
    setMissingDetailPolicy,
    setAIConfig,
    patchMentionConfig,
  };
}
