import { reloadOnChatChange } from '@util/script';
import { watch } from 'vue';
import { useNovelSettingsStore } from '../stores/settings.store';

export function usePanelLifecycle() {
  const settingsStore = useNovelSettingsStore();

  let reloadStopper: EventOnReturn | null = null;

  const syncReloadStrategy = (enabled: boolean) => {
    reloadStopper?.stop();
    reloadStopper = enabled ? reloadOnChatChange() : null;
  };

  const stopWatch = watch(
    () => settingsStore.settings.reloadOnChatChange,
    enabled => {
      syncReloadStrategy(enabled);
    },
    { immediate: true },
  );

  const dispose = () => {
    stopWatch();
    reloadStopper?.stop();
    reloadStopper = null;
  };

  return {
    dispose,
  };
}

