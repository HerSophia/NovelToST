import { watchPausable } from '@vueuse/core';
import { klona } from 'klona';
import { ref } from 'vue';
import { useOutlineStore } from '../stores/outline.store';

const chatVariableOption = {
  type: 'chat' as const,
};

export const OUTLINE_CHAT_VARIABLE_PATH = 'novelToST.outline';

function readOutlineSnapshotFromChatVariables(): unknown {
  try {
    const variables = getVariables(chatVariableOption);
    return _.get(variables, OUTLINE_CHAT_VARIABLE_PATH);
  } catch (error) {
    console.warn('[novelToST][outline] 读取聊天变量失败，使用默认大纲状态', error);
    return null;
  }
}

function writeOutlineSnapshotToChatVariables(snapshot: unknown): void {
  try {
    updateVariablesWith(variables => {
      _.set(variables, OUTLINE_CHAT_VARIABLE_PATH, klona(snapshot));
      return variables;
    }, chatVariableOption);
  } catch (error) {
    console.warn('[novelToST][outline] 写入聊天变量失败', error);
  }
}

export function useOutlinePersistence() {
  const outlineStore = useOutlineStore();

  const initialized = ref(false);
  const disposed = ref(false);
  const isHydrating = ref(false);

  const persistNow = () => {
    if (!initialized.value || isHydrating.value || disposed.value) {
      return;
    }

    writeOutlineSnapshotToChatVariables(outlineStore.toStateSnapshot());
  };

  const { pause: pausePersistence, resume: resumePersistence, stop: stopPersistence } = watchPausable(
    () => outlineStore.updatedAt,
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

    const rawOutlineState = readOutlineSnapshotFromChatVariables();
    if (rawOutlineState == null) {
      outlineStore.reset();
    } else {
      outlineStore.hydrate(rawOutlineState);
    }

    isHydrating.value = false;
    initialized.value = true;
    resumePersistence();
    persistNow();
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
