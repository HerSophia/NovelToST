import { bootstrapNovelToSTPanel } from '@/novelToST/app/bootstrap';
type LoadHandler = ((this: HTMLIFrameElement) => void) | null;

const bootstrapMock = vi.hoisted(() => {
  const appInstance = {
    use: vi.fn(),
    mount: vi.fn(),
    unmount: vi.fn(),
  };
  appInstance.use.mockReturnValue(appInstance);

  const host = {
    addClass: vi.fn(),
    appendTo: vi.fn(),
    remove: vi.fn(),
  } as unknown as {
    addClass: ReturnType<typeof vi.fn>;
    appendTo: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  host.addClass.mockReturnValue(host);
  host.appendTo.mockReturnValue(host);

  const iframeElement = { contentDocument: null as Document | null } as unknown as HTMLIFrameElement;
  const state: { loadHandler: LoadHandler } = { loadHandler: null };

  const iframe = {
    0: iframeElement,
    addClass: vi.fn(),
    css: vi.fn(),
    appendTo: vi.fn(),
    on: vi.fn((event: string, handler: (this: HTMLIFrameElement) => void) => {
      if (event === 'load') {
        state.loadHandler = handler;
      }
      return iframe;
    }),
    remove: vi.fn(),
  } as unknown as {
    0: HTMLIFrameElement;
    addClass: ReturnType<typeof vi.fn>;
    css: ReturnType<typeof vi.fn>;
    appendTo: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  iframe.addClass.mockReturnValue(iframe);
  iframe.css.mockReturnValue(iframe);
  iframe.appendTo.mockReturnValue(iframe);

  const createScriptIdDiv = vi.fn(() => host);
  const createScriptIdIframe = vi.fn(() => iframe);
  const styleDestroy = vi.fn();
  const teleportStyle = vi.fn(() => ({ destroy: styleDestroy }));

  const hydrate = vi.fn();
  const pausePersistence = vi.fn();
  const disposeLifecycle = vi.fn();
  const setMounted = vi.fn();

  const createApp = vi.fn(() => appInstance);
  const createVfm = vi.fn(() => ({ plugin: 'vfm' }));

  return {
    state,
    appInstance,
    host,
    iframe,
    iframeElement,
    createScriptIdDiv,
    createScriptIdIframe,
    teleportStyle,
    styleDestroy,
    hydrate,
    pausePersistence,
    disposeLifecycle,
    setMounted,
    createApp,
    createVfm,
  };
});

vi.mock('vue', async importOriginal => {
  const actual = await importOriginal<typeof import('vue')>();
  return {
    ...actual,
    createApp: bootstrapMock.createApp,
  };
});

vi.mock('vue-final-modal', () => ({
  createVfm: bootstrapMock.createVfm,
}));

vi.mock('@util/script', () => ({
  createScriptIdDiv: bootstrapMock.createScriptIdDiv,
  createScriptIdIframe: bootstrapMock.createScriptIdIframe,
  teleportStyle: bootstrapMock.teleportStyle,
}));

vi.mock('@/novelToST/composables/useScriptPersistence', () => ({
  useScriptPersistence: () => ({
    hydrate: bootstrapMock.hydrate,
    pausePersistence: bootstrapMock.pausePersistence,
  }),
}));

vi.mock('@/novelToST/composables/usePanelLifecycle', () => ({
  usePanelLifecycle: () => ({
    dispose: bootstrapMock.disposeLifecycle,
  }),
}));

vi.mock('@/novelToST/stores/ui.store', () => ({
  useUiStore: () => ({
    setMounted: bootstrapMock.setMounted,
  }),
}));

function createIframeDocument(bodyHeight: number, docHeight: number): Document {
  const doc = document.implementation.createHTMLDocument('iframe-doc');
  Object.defineProperty(doc.body, 'scrollHeight', {
    configurable: true,
    get: () => bodyHeight,
  });
  Object.defineProperty(doc.documentElement, 'scrollHeight', {
    configurable: true,
    get: () => docHeight,
  });
  return doc;
}

describe('bootstrapNovelToSTPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    bootstrapMock.state.loadHandler = null;
    bootstrapMock.iframeElement.contentDocument = null;

    bootstrapMock.createScriptIdDiv.mockClear();
    bootstrapMock.createScriptIdIframe.mockClear();
    bootstrapMock.teleportStyle.mockClear();
    bootstrapMock.styleDestroy.mockClear();
    bootstrapMock.hydrate.mockClear();
    bootstrapMock.pausePersistence.mockClear();
    bootstrapMock.disposeLifecycle.mockClear();
    bootstrapMock.setMounted.mockClear();
    bootstrapMock.createApp.mockClear();
    bootstrapMock.createVfm.mockClear();

    bootstrapMock.host.addClass.mockClear();
    bootstrapMock.host.appendTo.mockClear();
    bootstrapMock.host.remove.mockClear();

    bootstrapMock.iframe.addClass.mockClear();
    bootstrapMock.iframe.css.mockClear();
    bootstrapMock.iframe.appendTo.mockClear();
    bootstrapMock.iframe.on.mockClear();
    bootstrapMock.iframe.remove.mockClear();

    bootstrapMock.appInstance.use.mockClear();
    bootstrapMock.appInstance.mount.mockClear();
    bootstrapMock.appInstance.unmount.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should mount in iframe and cleanup all resources on unmount', async () => {
    const resizeObserverState: {
      callback: ResizeObserverCallback | null;
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    } = {
      callback: null,
      observe: vi.fn(),
      disconnect: vi.fn(),
    };

    class ResizeObserverMock {
      observe = resizeObserverState.observe;
      disconnect = resizeObserverState.disconnect;

      constructor(callback: ResizeObserverCallback) {
        resizeObserverState.callback = callback;
      }
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock as unknown as typeof ResizeObserver);

    const iframeDoc = createIframeDocument(120, 160);
    bootstrapMock.iframeElement.contentDocument = iframeDoc;

    const { unmount } = bootstrapNovelToSTPanel();

    expect(bootstrapMock.hydrate).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.createScriptIdDiv).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.createScriptIdIframe).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.host.appendTo).toHaveBeenCalledWith('#extensions_settings2');

    bootstrapMock.state.loadHandler?.call(bootstrapMock.iframeElement);

    expect(bootstrapMock.teleportStyle).toHaveBeenCalledWith(iframeDoc.head);
    expect(bootstrapMock.appInstance.mount).toHaveBeenCalledWith(iframeDoc.body);
    expect(bootstrapMock.setMounted).toHaveBeenCalledWith(true);
    expect(resizeObserverState.observe).toHaveBeenCalledWith(iframeDoc.body);
    expect(bootstrapMock.iframe.css).toHaveBeenCalledWith('height', '160px');

    const cssCallsBeforeNullDoc = bootstrapMock.iframe.css.mock.calls.length;
    bootstrapMock.iframeElement.contentDocument = null;
    resizeObserverState.callback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
    expect(bootstrapMock.iframe.css.mock.calls.length).toBe(cssCallsBeforeNullDoc);

    unmount();

    expect(bootstrapMock.setMounted).toHaveBeenLastCalledWith(false);
    expect(resizeObserverState.disconnect).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.appInstance.unmount).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.styleDestroy).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.pausePersistence).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.disposeLifecycle).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.iframe.remove).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.host.remove).toHaveBeenCalledTimes(1);
  });

  it('should ignore iframe load when contentDocument is missing', () => {
    const { unmount } = bootstrapNovelToSTPanel();

    bootstrapMock.iframeElement.contentDocument = null;
    bootstrapMock.state.loadHandler?.call(bootstrapMock.iframeElement);

    expect(bootstrapMock.teleportStyle).not.toHaveBeenCalled();
    expect(bootstrapMock.appInstance.mount).not.toHaveBeenCalled();
    expect(bootstrapMock.setMounted).not.toHaveBeenCalledWith(true);

    unmount();

    expect(bootstrapMock.appInstance.unmount).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.styleDestroy).not.toHaveBeenCalled();
    expect(bootstrapMock.pausePersistence).toHaveBeenCalledTimes(1);
  });
});
