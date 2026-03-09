import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { useFoundationPersistence } from '../composables/useFoundationPersistence';
import { useOutlinePersistence } from '../composables/useOutlinePersistence';
import { usePanelLifecycle } from '../composables/usePanelLifecycle';
import { useScriptPersistence } from '../composables/useScriptPersistence';
import { useWorldbuildingPersistence } from '../composables/useWorldbuildingPersistence';

export type NovelToSTRuntime = {
  pinia: Pinia;
  dispose: () => void;
};

let runtime: NovelToSTRuntime | null = null;

export function getOrCreateNovelToSTRuntime(): NovelToSTRuntime {
  if (runtime) {
    setActivePinia(runtime.pinia);
    return runtime;
  }

  const pinia = createPinia();
  setActivePinia(pinia);

  const { hydrate, pausePersistence } = useScriptPersistence();
  hydrate();

  const { hydrate: hydrateFoundation, dispose: disposeFoundationPersistence } = useFoundationPersistence();
  hydrateFoundation();

  const { hydrate: hydrateOutline, dispose: disposeOutlinePersistence } = useOutlinePersistence();
  hydrateOutline();

  const { hydrate: hydrateWorldbuilding, dispose: disposeWorldbuildingPersistence } = useWorldbuildingPersistence();
  hydrateWorldbuilding();

  const { dispose: disposeLifecycle } = usePanelLifecycle();

  let disposed = false;

  runtime = {
    pinia,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;

      pausePersistence();
      disposeLifecycle();
      disposeOutlinePersistence();
      disposeWorldbuildingPersistence();
      disposeFoundationPersistence();

      runtime = null;
    },
  };

  return runtime;
}

export function disposeNovelToSTRuntime(): void {
  runtime?.dispose();
}
