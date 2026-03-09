import { watchPausable } from '@vueuse/core';
import { klona } from 'klona';
import { ref } from 'vue';
import { useWorldbuildingStore } from '../stores/worldbuilding.store';

const chatVariableOption = {
  type: 'chat' as const,
};

export const WORLDBUILDING_CHAT_VARIABLE_PATH = 'novelToST.worldbuilding';

function readWorldbuildingSnapshotFromChatVariables(): unknown {
  try {
    const variables = getVariables(chatVariableOption);
    return _.get(variables, WORLDBUILDING_CHAT_VARIABLE_PATH);
  } catch (error) {
    console.warn('[novelToST][worldbuilding] 读取聊天变量失败，使用默认世界设定状态', error);
    return null;
  }
}

function writeWorldbuildingSnapshotToChatVariables(snapshot: unknown): void {
  try {
    updateVariablesWith(variables => {
      _.set(variables, WORLDBUILDING_CHAT_VARIABLE_PATH, klona(snapshot));
      return variables;
    }, chatVariableOption);
  } catch (error) {
    console.warn('[novelToST][worldbuilding] 写入聊天变量失败', error);
  }
}

export function useWorldbuildingPersistence() {
  const worldbuildingStore = useWorldbuildingStore();

  const initialized = ref(false);
  const disposed = ref(false);
  const isHydrating = ref(false);

  const persistNow = () => {
    if (!initialized.value || isHydrating.value || disposed.value) {
      return;
    }

    writeWorldbuildingSnapshotToChatVariables(worldbuildingStore.toStateSnapshot());
  };

  const { pause: pausePersistence, resume: resumePersistence, stop: stopPersistence } = watchPausable(
    () => worldbuildingStore.updatedAt,
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

    const rawWorldbuildingState = readWorldbuildingSnapshotFromChatVariables();
    if (rawWorldbuildingState == null) {
      worldbuildingStore.reset();
    } else {
      worldbuildingStore.hydrate(rawWorldbuildingState);
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
