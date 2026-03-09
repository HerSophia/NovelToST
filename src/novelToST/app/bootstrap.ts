import { mountExtensionEntry } from './mount-extension-entry';
import { mountWorkbench } from './mount-workbench';
import { getOrCreateNovelToSTRuntime } from './runtime';
import {
  WORKBENCH_CLOSE_EVENT,
  WORKBENCH_FOCUS_EVENT,
  WORKBENCH_OPEN_EVENT,
  type WorkbenchOpenDetail,
} from './workbench.events';

export type NovelToSTBootstrapReturn = {
  openWorkbench: (detail?: WorkbenchOpenDetail) => void;
  closeWorkbench: () => void;
  focusWorkbench: () => void;
  unmount: () => void;
};

type IdleSchedulerWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleWorkbenchPreload(callback: () => void): { cancel: () => void } {
  const idleWindow = window as IdleSchedulerWindow;

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const idleHandle = idleWindow.requestIdleCallback(() => {
      callback();
    }, { timeout: 1200 });

    return {
      cancel: () => {
        if (typeof idleWindow.cancelIdleCallback === 'function') {
          idleWindow.cancelIdleCallback(idleHandle);
        }
      },
    };
  }

  const timeoutHandle = window.setTimeout(() => {
    callback();
  }, 280);

  return {
    cancel: () => {
      window.clearTimeout(timeoutHandle);
    },
  };
}

export function bootstrapNovelToSTPanel(): NovelToSTBootstrapReturn {
  const runtime = getOrCreateNovelToSTRuntime();
  const extensionEntry = mountExtensionEntry(runtime);
  const workbench = mountWorkbench(runtime);

  const handleOpen = (event: Event) => {
    const detail = (event as CustomEvent<WorkbenchOpenDetail | undefined>).detail;
    workbench.open(detail);
  };

  const handleClose = () => {
    workbench.close();
  };

  const handleFocus = () => {
    workbench.focus();
  };

  window.addEventListener(WORKBENCH_OPEN_EVENT, handleOpen);
  window.addEventListener(WORKBENCH_CLOSE_EVENT, handleClose);
  window.addEventListener(WORKBENCH_FOCUS_EVENT, handleFocus);

  const preloadScheduler = scheduleWorkbenchPreload(() => {
    workbench.preload();
  });

  let disposed = false;

  const unmount = () => {
    if (disposed) {
      return;
    }
    disposed = true;

    window.removeEventListener(WORKBENCH_OPEN_EVENT, handleOpen);
    window.removeEventListener(WORKBENCH_CLOSE_EVENT, handleClose);
    window.removeEventListener(WORKBENCH_FOCUS_EVENT, handleFocus);

    preloadScheduler.cancel();

    workbench.unmount();
    extensionEntry.unmount();

    runtime.dispose();
  };

  return {
    openWorkbench: workbench.open,
    closeWorkbench: workbench.close,
    focusWorkbench: workbench.focus,
    unmount,
  };
}