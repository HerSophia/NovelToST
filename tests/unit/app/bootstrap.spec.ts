import { bootstrapNovelToSTPanel } from '@/novelToST/app/bootstrap';
import {
  WORKBENCH_CLOSE_EVENT,
  WORKBENCH_FOCUS_EVENT,
  WORKBENCH_OPEN_EVENT,
} from '@/novelToST/app/workbench.events';

const bootstrapMock = vi.hoisted(() => {
  const runtime = {
    pinia: {} as unknown,
    dispose: vi.fn(),
  };

  const extensionEntry = {
    unmount: vi.fn(),
  };

  const workbench = {
    open: vi.fn(),
    close: vi.fn(),
    focus: vi.fn(),
    preload: vi.fn(),
    unmount: vi.fn(),
  };

  return {
    runtime,
    extensionEntry,
    workbench,
    getOrCreateNovelToSTRuntime: vi.fn(() => runtime),
    mountExtensionEntry: vi.fn(() => extensionEntry),
    mountWorkbench: vi.fn(() => workbench),
  };
});

vi.mock('@/novelToST/app/runtime', () => ({
  getOrCreateNovelToSTRuntime: bootstrapMock.getOrCreateNovelToSTRuntime,
}));

vi.mock('@/novelToST/app/mount-extension-entry', () => ({
  mountExtensionEntry: bootstrapMock.mountExtensionEntry,
}));

vi.mock('@/novelToST/app/mount-workbench', () => ({
  mountWorkbench: bootstrapMock.mountWorkbench,
}));

function createIdleDeadline(): IdleDeadline {
  return {
    didTimeout: false,
    timeRemaining: () => 16,
  };
}

describe('bootstrapNovelToSTPanel', () => {
  beforeEach(() => {
    bootstrapMock.runtime.dispose.mockClear();

    bootstrapMock.getOrCreateNovelToSTRuntime.mockClear();
    bootstrapMock.mountExtensionEntry.mockClear();
    bootstrapMock.mountWorkbench.mockClear();

    bootstrapMock.extensionEntry.unmount.mockClear();

    bootstrapMock.workbench.open.mockClear();
    bootstrapMock.workbench.close.mockClear();
    bootstrapMock.workbench.focus.mockClear();
    bootstrapMock.workbench.preload.mockClear();
    bootstrapMock.workbench.unmount.mockClear();

    vi.unstubAllGlobals();
  });

  it('should mount runtime surfaces and bridge workbench events', () => {
    const requestIdleCallback = vi.fn(() => 7);
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

    const { unmount } = bootstrapNovelToSTPanel();

    expect(bootstrapMock.getOrCreateNovelToSTRuntime).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.mountExtensionEntry).toHaveBeenCalledWith(bootstrapMock.runtime);
    expect(bootstrapMock.mountWorkbench).toHaveBeenCalledWith(bootstrapMock.runtime);

    window.dispatchEvent(new CustomEvent(WORKBENCH_OPEN_EVENT, { detail: { tab: 'detail', chapter: 6 } }));
    window.dispatchEvent(new CustomEvent(WORKBENCH_CLOSE_EVENT));
    window.dispatchEvent(new CustomEvent(WORKBENCH_FOCUS_EVENT));

    expect(bootstrapMock.workbench.open).toHaveBeenCalledWith({ tab: 'detail', chapter: 6 });
    expect(bootstrapMock.workbench.close).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.workbench.focus).toHaveBeenCalledTimes(1);

    unmount();

    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
    expect(bootstrapMock.workbench.unmount).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.extensionEntry.unmount).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.runtime.dispose).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new CustomEvent(WORKBENCH_OPEN_EVENT));
    expect(bootstrapMock.workbench.open).toHaveBeenCalledTimes(1);
  });

  it('should preload workbench via requestIdleCallback when available', () => {
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      callback(createIdleDeadline());
      return 99;
    });
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    vi.stubGlobal('cancelIdleCallback', vi.fn());

    const { unmount } = bootstrapNovelToSTPanel();

    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.workbench.preload).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('should fallback to setTimeout preload when requestIdleCallback is unavailable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);

    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    const { unmount } = bootstrapNovelToSTPanel();

    expect(bootstrapMock.workbench.preload).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(280);
    expect(bootstrapMock.workbench.preload).toHaveBeenCalledTimes(1);

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });
});
