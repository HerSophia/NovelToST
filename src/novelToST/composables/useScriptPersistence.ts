import { useDebounceFn, watchPausable } from '@vueuse/core';
import { klona } from 'klona';
import { useNovelSettingsStore } from '../stores/settings.store';
import { storeToRefs } from 'pinia';
import { ref, computed } from 'vue';

export function useScriptPersistence() {
  const settingsStore = useNovelSettingsStore();
  const { settings, initialized } = storeToRefs(settingsStore);
  const isHydrating = ref(false);

  const persistNow = () => {
    if (!initialized.value) {
      return;
    }
    insertOrAssignVariables(klona(settings.value), settingsStore.scriptVariableOption);
  };

  const persistDebounced = useDebounceFn(
    () => {
      persistNow();
    },
    computed(() => settings.value.persistDebounceMs),
  );

  const { pause: pausePersistence, resume: resumePersistence } = watchPausable(
    settings,
    () => {
      if (!initialized.value || isHydrating.value) {
        return;
      }
      persistDebounced();
    },
    { deep: true },
  );

  const hydrate = () => {
    pausePersistence();
    isHydrating.value = true;
    settingsStore.init();
    isHydrating.value = false;
    resumePersistence();
    persistNow();
  };

  return {
    hydrate,
    persistNow,
    pausePersistence,
    resumePersistence,
  };
}
