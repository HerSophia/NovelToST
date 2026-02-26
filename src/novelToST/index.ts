import { bootstrapNovelToSTPanel } from './app/bootstrap';
import { useGenerationControl } from './composables/useGenerationControl';
import { useWorldbookControl } from './composables/useWorldbookControl';
import { registerNovelButtons } from './commands/buttons';
import { registerNovelDebugCommand } from './commands/debug';
import { useWorldbookStore } from './stores/worldbook.store';

const WORLDBOOK_PANEL_STORAGE_KEY = 'novelToST.ui.panel.worldbook';

/**
 * Expose a read-only subset of worldbook capabilities on `window.TxtToWorldbook`.
 * Intentionally frozen to prevent external mutation of internal state.
 */
function registerWorldbookGlobalAPI(): { unregister: () => void } {
  const wbStore = useWorldbookStore();

  const api = Object.freeze({
    /** Current runtime status: idle | preparing | running | paused | stopping | completed | error */
    getStatus: () => wbStore.status,
    /** Snapshot of processing statistics */
    getStats: () => ({ ...wbStore.stats }),
    /** Number of generated entries so far */
    getEntryCount: () => wbStore.generatedEntries.length,
    /** Snapshot of task state (progress summary) */
    getTaskState: () => (wbStore.taskState ? { ...wbStore.taskState } : null),
    /** Whether processing is currently active */
    isActive: () => wbStore.isActive,
  });

  (window as unknown as Record<string, unknown>).TxtToWorldbook = api;
  if (window.parent && window.parent !== window) {
    try {
      (window.parent as unknown as Record<string, unknown>).TxtToWorldbook = api;
    } catch {
      // cross-origin or sandboxed — ignore
    }
  }
  console.info('[novelToST] 已注册世界书 API：window.TxtToWorldbook');

  return {
    unregister: () => {
      delete (window as unknown as Record<string, unknown>).TxtToWorldbook;
      if (window.parent && window.parent !== window) {
        try {
          delete (window.parent as unknown as Record<string, unknown>).TxtToWorldbook;
        } catch {
          // ignore
        }
      }
    },
  };
}

/**
 * Attempt to expand the worldbook panel by writing to localStorage
 * and scrolling the panel into view if it exists in the DOM.
 */
function focusWorldbookPanel(): void {
  try {
    window.localStorage.setItem(WORLDBOOK_PANEL_STORAGE_KEY, '0');
  } catch {
    // persistence not available
  }

  // Dispatch a custom event so App.vue can react and expand the panel at runtime
  window.dispatchEvent(new CustomEvent('novelToST:expandWorldbook'));

  // Best-effort scroll into view
  requestAnimationFrame(() => {
    const panel = document.querySelector('[data-panel="worldbook"]');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

$(() => {
  const { unmount } = bootstrapNovelToSTPanel();
  const control = useGenerationControl();
  const { unregister: unregisterDebug } = registerNovelDebugCommand();
  const { unregister: unregisterWorldbookAPI } = registerWorldbookGlobalAPI();

  // useWorldbookControl is called inside components; no need to call start() here.
  // The button merely navigates/focuses the worldbook panel.
  void useWorldbookControl;

  const { unregister } = registerNovelButtons({
    start: async () => {
      await control.start();
    },
    pause: () => {
      control.pause();
    },
    resume: () => {
      control.resume();
    },
    stop: () => {
      control.stop();
    },
    exportTXT: () => {
      control.doExportTXT();
    },
    openWorldbook: () => {
      focusWorldbookPanel();
    },
  });

  $(window).on('pagehide', () => {
    unregister();
    unregisterDebug();
    unregisterWorldbookAPI();
    unmount();
  });
});
