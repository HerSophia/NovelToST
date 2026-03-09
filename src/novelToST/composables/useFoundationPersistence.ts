import { watchPausable } from '@vueuse/core';
import { klona } from 'klona';
import { ref } from 'vue';
import { FoundationPersistedStateSchema } from '../stores/foundation/foundation.schemas';
import { useFoundationStore } from '../stores/foundation.store';
import { isFoundationEmpty, migrateLegacyStorySetupToFoundation } from '../core/foundation-legacy.service';
import { OUTLINE_CHAT_VARIABLE_PATH } from './useOutlinePersistence';

const chatVariableOption = {
  type: 'chat' as const,
};

export const FOUNDATION_CHAT_VARIABLE_PATH = 'novelToST.foundation';

function readFoundationSnapshotFromChatVariables(): unknown {
  try {
    const variables = getVariables(chatVariableOption);
    return _.get(variables, FOUNDATION_CHAT_VARIABLE_PATH);
  } catch (error) {
    console.warn('[novelToST][foundation] 读取聊天变量失败，使用默认故事基底状态', error);
    return null;
  }
}

function readLegacyOutlineSetupFromChatVariables(): unknown {
  try {
    const variables = getVariables(chatVariableOption);
    return _.get(variables, `${OUTLINE_CHAT_VARIABLE_PATH}.setup`);
  } catch (error) {
    console.warn('[novelToST][foundation] 读取旧版大纲 setup 失败，跳过兼容迁移', error);
    return null;
  }
}

function canWriteHydratedFoundationSnapshot(rawFoundationState: unknown): boolean {
  if (rawFoundationState == null) {
    return true;
  }

  return FoundationPersistedStateSchema.safeParse(rawFoundationState).success;
}

function shouldMigrateLegacyOutlineSetup(rawFoundationState: unknown): boolean {
  if (rawFoundationState == null) {
    return true;
  }

  const parsed = FoundationPersistedStateSchema.safeParse(rawFoundationState);
  if (!parsed.success) {
    return false;
  }

  return isFoundationEmpty(parsed.data.foundation);
}

function writeFoundationSnapshotToChatVariables(snapshot: unknown): void {
  try {
    updateVariablesWith(variables => {
      _.set(variables, FOUNDATION_CHAT_VARIABLE_PATH, klona(snapshot));
      return variables;
    }, chatVariableOption);
  } catch (error) {
    console.warn('[novelToST][foundation] 写入聊天变量失败', error);
  }
}

export function useFoundationPersistence() {
  const foundationStore = useFoundationStore();

  const initialized = ref(false);
  const disposed = ref(false);
  const isHydrating = ref(false);

  const persistNow = () => {
    if (!initialized.value || isHydrating.value || disposed.value) {
      return;
    }

    writeFoundationSnapshotToChatVariables(foundationStore.toStateSnapshot());
  };

  const { pause: pausePersistence, resume: resumePersistence, stop: stopPersistence } = watchPausable(
    () => foundationStore.updatedAt,
    () => {
      persistNow();
    },
  );

  const hydrate = () => {
    if (disposed.value) {
      return;
    }

    pausePersistence();
    isHydrating.value = true;

    const rawFoundationState = readFoundationSnapshotFromChatVariables();
    const shouldWriteHydratedSnapshot = canWriteHydratedFoundationSnapshot(rawFoundationState);
    if (rawFoundationState == null) {
      foundationStore.reset();
    } else {
      foundationStore.hydrate(rawFoundationState);
    }

    const rawLegacyOutlineSetup = readLegacyOutlineSetupFromChatVariables();
    if (
      rawLegacyOutlineSetup != null &&
      shouldMigrateLegacyOutlineSetup(rawFoundationState) &&
      isFoundationEmpty(foundationStore.foundation)
    ) {
      const migratedPatch = migrateLegacyStorySetupToFoundation(rawLegacyOutlineSetup);
      if (Object.keys(migratedPatch).length > 0) {
        foundationStore.applyFoundationPatch(migratedPatch);
      }
    }

    isHydrating.value = false;
    initialized.value = true;
    resumePersistence();
    if (shouldWriteHydratedSnapshot) {
      persistNow();
    }
  };

  let chatChangedStopper: EventOnReturn | null = null;

  const bindChatChangeListener = () => {
    chatChangedStopper?.stop();
    chatChangedStopper = eventOn(tavern_events.CHAT_CHANGED, () => {
      hydrate();
    });
  };

  bindChatChangeListener();

  const dispose = () => {
    if (disposed.value) {
      return;
    }

    disposed.value = true;
    pausePersistence();
    stopPersistence();

    chatChangedStopper?.stop();
    chatChangedStopper = null;
  };

  return {
    hydrate,
    persistNow,
    pausePersistence,
    resumePersistence,
    dispose,
  };
}
