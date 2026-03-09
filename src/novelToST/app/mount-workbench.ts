import { createScriptIdDiv, createScriptIdIframe, teleportStyle } from '@util/script';
import { createApp, type App as VueApp } from 'vue';
import { createVfm } from 'vue-final-modal';
import WorkbenchRoot from '../ui/workbench/WorkbenchRoot.vue';
import { useUiStore } from '../stores/ui.store';
import { useWorkbenchStore } from '../stores/workbench.store';
import { resolveTavernRootBody } from './mount-target.resolver';
import type { NovelToSTRuntime } from './runtime';
import type { WorkbenchOpenDetail } from './workbench.events';

export type WorkbenchMount = {
  open: (detail?: WorkbenchOpenDetail) => void;
  close: () => void;
  focus: () => void;
  preload: () => void;
  unmount: () => void;
};

const WORKBENCH_Z_INDEX = 2147483000;
const WORKBENCH_MARGIN = 16;
const WORKBENCH_BOTTOM_OFFSET = 84;
const FAB_SIZE = 52;

export function mountWorkbench(runtime: NovelToSTRuntime): WorkbenchMount {
  const uiStore = useUiStore(runtime.pinia);
  const workbenchStore = useWorkbenchStore(runtime.pinia);

  let mounted = false;
  let disposed = false;
  let openState = false;
  let appMountRequested = false;

  let app: VueApp<Element> | null = null;
  let styleDestroy: (() => void) | null = null;

  let $host: JQuery<HTMLDivElement> | null = null;
  let $iframe: JQuery<HTMLIFrameElement> | null = null;
  let $fab: JQuery<HTMLButtonElement> | null = null;
  let $fabHost: JQuery<HTMLDivElement> | null = null;

  const updateFabState = () => {
    if (!$fab) {
      return;
    }

    $fab.text(openState ? '×' : 'W');
    $fab.attr('title', openState ? '收起工作台' : '打开工作台');
    $fab.attr('aria-label', openState ? '收起工作台' : '打开工作台');

    $fab.css('boxShadow', openState ? '0 10px 25px rgba(16, 185, 129, 0.45)' : '0 10px 25px rgba(37, 99, 235, 0.45)');
  };

  const mountAppInIframe = (iframeElement: HTMLIFrameElement) => {
    if (!appMountRequested || mounted || disposed) {
      return;
    }

    const iframeDocument = iframeElement.contentDocument;
    if (!iframeDocument) {
      return;
    }

    const iframeBody = iframeDocument.body;
    if (!iframeBody) {
      return;
    }

    const iframeHtml = iframeDocument.documentElement;
    iframeHtml.style.margin = '0';
    iframeHtml.style.padding = '0';
    iframeHtml.style.width = '100%';
    iframeHtml.style.height = '100%';
    iframeHtml.style.overflow = 'hidden';

    iframeBody.style.margin = '0';
    iframeBody.style.padding = '0';
    iframeBody.style.width = '100%';
    iframeBody.style.height = '100%';
    iframeBody.style.overflow = 'hidden';

    const iframeHead = iframeDocument.head ?? iframeDocument.documentElement;
    styleDestroy = teleportStyle(iframeHead).destroy;

    app = createApp(WorkbenchRoot).use(runtime.pinia).use(createVfm());
    app.mount(iframeBody);

    mounted = true;
    uiStore.setMounted(true);
  };

  const requestAppMount = () => {
    if (disposed || mounted) {
      return;
    }

    appMountRequested = true;

    const iframeElement = $iframe?.[0];
    if (!iframeElement) {
      return;
    }

    if (iframeElement.contentDocument?.readyState === 'complete') {
      mountAppInIframe(iframeElement);
    }
  };

  const ensureElements = (): boolean => {
    if ($host && $iframe && $fab && $fabHost) {
      return true;
    }

    let rootBody: HTMLElement;
    try {
      rootBody = resolveTavernRootBody();
    } catch (error) {
      console.error('[novelToST] 主页面 Workbench 挂载失败', error);
      return false;
    }

    $host = createScriptIdDiv()
      .addClass('novel-to-st-workbench-host')
      .css({
        position: 'fixed',
        right: `max(${WORKBENCH_MARGIN}px, 10vw)`,
        bottom: `max(${WORKBENCH_BOTTOM_OFFSET}px, 10vh)`,
        width: `min(80vw, calc(100vw - ${WORKBENCH_MARGIN * 2}px))`,
        height: `min(80vh, calc(100vh - ${WORKBENCH_BOTTOM_OFFSET + WORKBENCH_MARGIN * 2}px))`,
        borderRadius: '14px',
        boxShadow: '0 18px 48px rgba(2, 6, 23, 0.55)',
        overflow: 'hidden',
        zIndex: WORKBENCH_Z_INDEX,
        display: 'none',
        background: '#020617',
      })
      .appendTo(rootBody);

    $iframe = createScriptIdIframe()
      .addClass('h-full w-full border-0')
      .css({
        width: '100%',
        height: '100%',
        border: '0',
        display: 'block',
        background: 'transparent',
      })
      .on('load', function (this: HTMLIFrameElement) {
        if (appMountRequested) {
          mountAppInIframe(this);
        }
      })
      .appendTo($host);

    $fabHost = createScriptIdDiv()
      .addClass('novel-to-st-workbench-fab-host')
      .css({
        position: 'fixed',
        right: `${WORKBENCH_MARGIN}px`,
        bottom: `${WORKBENCH_MARGIN}px`,
        zIndex: WORKBENCH_Z_INDEX + 1,
      })
      .appendTo(rootBody);

    $fab = ($('<button type="button">W</button>') as JQuery<HTMLButtonElement>)
      .css({
        width: `${FAB_SIZE}px`,
        height: `${FAB_SIZE}px`,
        borderRadius: '9999px',
        border: '1px solid rgba(59, 130, 246, 0.55)',
        background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
        color: '#ffffff',
        fontSize: '20px',
        fontWeight: 700,
        cursor: 'pointer',
      })
      .on('click', () => {
        if (openState) {
          close();
          return;
        }

        open();
      })
      .appendTo($fabHost);

    updateFabState();

    return true;
  };

  const preload = () => {
    if (disposed) {
      return;
    }

    ensureElements();
  };

  const open = (detail: WorkbenchOpenDetail = {}) => {
    if (disposed) {
      return;
    }

    workbenchStore.openWithDetail(detail);

    preload();
    if (!$host) {
      return;
    }

    openState = true;
    $host.css('display', 'block');
    updateFabState();

    requestAppMount();
    focus();
  };

  const close = () => {
    if (disposed) {
      return;
    }

    openState = false;
    workbenchStore.setOpen(false);
    $host?.css('display', 'none');
    updateFabState();
  };

  const focus = () => {
    if (disposed) {
      return;
    }

    if (!openState) {
      open();
      return;
    }

    workbenchStore.markFocused();
    requestAppMount();

    const iframeElement = $iframe?.[0];
    iframeElement?.focus();
    iframeElement?.contentWindow?.focus();
  };

  const unmount = () => {
    if (disposed) {
      return;
    }
    disposed = true;

    openState = false;
    appMountRequested = false;

    uiStore.setMounted(false);
    workbenchStore.reset();

    if (mounted) {
      app?.unmount();
      mounted = false;
    }

    styleDestroy?.();
    styleDestroy = null;

    $fab?.off('click');

    $iframe?.remove();
    $host?.remove();
    $fab?.remove();
    $fabHost?.remove();

    app = null;
    $iframe = null;
    $host = null;
    $fab = null;
    $fabHost = null;
  };

  return {
    open,
    close,
    focus,
    preload,
    unmount,
  };
}
