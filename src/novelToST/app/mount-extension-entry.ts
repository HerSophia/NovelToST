import { createScriptIdDiv, createScriptIdIframe, teleportStyle } from '@util/script';
import { createApp } from 'vue';
import ExtensionEntryApp from '../ui/ExtensionEntryApp.vue';
import type { NovelToSTRuntime } from './runtime';

export type ExtensionEntryMount = {
  unmount: () => void;
};

const EXTENSION_SETTINGS_SELECTOR = '#extensions_settings2';
const MIN_IFRAME_HEIGHT = 96;

export function mountExtensionEntry(runtime: NovelToSTRuntime): ExtensionEntryMount {
  const $container = $(EXTENSION_SETTINGS_SELECTOR);
  if ($container.length === 0) {
    console.warn('[novelToST] 未找到 #extensions_settings2，跳过扩展页入口挂载');
    return {
      unmount: () => {
        // noop
      },
    };
  }

  const app = createApp(ExtensionEntryApp).use(runtime.pinia);

  const $host = createScriptIdDiv()
    .addClass('novel-to-st-entry-host')
    .appendTo($container);

  const $iframe = createScriptIdIframe()
    .addClass('w-full border-0')
    .css({
      width: '100%',
      minHeight: `${MIN_IFRAME_HEIGHT}px`,
      display: 'block',
      background: 'transparent',
    })
    .appendTo($host);

  let mounted = false;
  let styleDestroy: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const syncTimerHandles: number[] = [];

  const syncIframeHeight = () => {
    const iframeElement = $iframe[0];
    const iframeDocument = iframeElement.contentDocument;
    if (!iframeDocument) {
      return;
    }

    const iframeBody = iframeDocument.body;
    const iframeDocumentElement = iframeDocument.documentElement;
    if (!iframeBody || !iframeDocumentElement) {
      return;
    }

    const bodyHeight = iframeBody.scrollHeight;
    const docHeight = iframeDocumentElement.scrollHeight;
    const targetHeight = Math.max(MIN_IFRAME_HEIGHT, bodyHeight, docHeight);
    $iframe.css('height', `${targetHeight}px`);
  };

  const scheduleSyncIframeHeight = (delay: number) => {
    const handle = window.setTimeout(() => {
      _.remove(syncTimerHandles, item => item === handle);
      syncIframeHeight();
    }, delay);
    syncTimerHandles.push(handle);
  };

  const mountInIframe = (iframeElement: HTMLIFrameElement) => {
    if (mounted || !iframeElement.contentDocument) {
      return;
    }

    const iframeDocument = iframeElement.contentDocument;
    const iframeBody = iframeDocument.body;
    if (!iframeBody) {
      return;
    }

    iframeBody.style.margin = '0';
    iframeBody.style.padding = '0';

    const iframeHead = iframeDocument.head ?? iframeDocument.documentElement;
    styleDestroy = teleportStyle(iframeHead).destroy;

    app.mount(iframeBody);
    mounted = true;

    resizeObserver = new ResizeObserver(() => {
      syncIframeHeight();
    });
    resizeObserver.observe(iframeBody);

    syncIframeHeight();
    scheduleSyncIframeHeight(0);
    scheduleSyncIframeHeight(300);
  };

  $iframe.on('load', function (this: HTMLIFrameElement) {
    mountInIframe(this);
  });

  const iframeElement = $iframe[0];
  if (iframeElement.contentDocument?.readyState === 'complete') {
    mountInIframe(iframeElement);
  }

  const unmount = () => {
    syncTimerHandles.forEach(handle => {
      window.clearTimeout(handle);
    });
    syncTimerHandles.length = 0;

    resizeObserver?.disconnect();
    resizeObserver = null;

    if (mounted) {
      app.unmount();
      mounted = false;
    }

    styleDestroy?.();
    styleDestroy = null;

    $iframe.remove();
    $host.remove();
  };

  return {
    unmount,
  };
}
