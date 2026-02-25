import { createScriptIdDiv, createScriptIdIframe, teleportStyle } from '@util/script';
import { createVfm } from 'vue-final-modal';
import App from '../ui/App.vue';
import { usePanelLifecycle } from '../composables/usePanelLifecycle';
import { useScriptPersistence } from '../composables/useScriptPersistence';
import { useUiStore } from '../stores/ui.store';
import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';

export type NovelToSTBootstrapReturn = {
  unmount: () => void;
};

const MIN_IFRAME_HEIGHT = 96;

export function bootstrapNovelToSTPanel(): NovelToSTBootstrapReturn {
  const pinia = createPinia();
  setActivePinia(pinia);

  const { hydrate, pausePersistence } = useScriptPersistence();
  hydrate();

  const { dispose: disposeLifecycle } = usePanelLifecycle();
  const uiStore = useUiStore();

  const app = createApp(App).use(pinia).use(createVfm());

  const $host = createScriptIdDiv()
    .addClass('novel-to-st-host')
    .appendTo('#extensions_settings2');

  const $iframe = createScriptIdIframe()
    .addClass('w-full border-0')
    .css({
      width: '100%',
      minHeight: `${MIN_IFRAME_HEIGHT}px`,
      display: 'block',
      background: 'transparent',
    })
    .appendTo($host);

  let styleDestroy: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const syncIframeHeight = () => {
    const iframeElement = $iframe[0];
    const iframeDocument = iframeElement.contentDocument;
    if (!iframeDocument) {
      return;
    }

    const bodyHeight = iframeDocument.body.scrollHeight;
    const docHeight = iframeDocument.documentElement.scrollHeight;
    const targetHeight = Math.max(MIN_IFRAME_HEIGHT, bodyHeight, docHeight);
    $iframe.css('height', `${targetHeight}px`);
  };

  $iframe.on('load', function (this: HTMLIFrameElement) {
    if (!this.contentDocument) {
      return;
    }

    this.contentDocument.body.style.margin = '0';
    this.contentDocument.body.style.padding = '0';

    styleDestroy = teleportStyle(this.contentDocument.head).destroy;
    app.mount(this.contentDocument.body);
    uiStore.setMounted(true);

    resizeObserver = new ResizeObserver(() => {
      syncIframeHeight();
    });
    resizeObserver.observe(this.contentDocument.body);

    syncIframeHeight();
    window.setTimeout(syncIframeHeight, 0);
    window.setTimeout(syncIframeHeight, 300);
  });

  const unmount = () => {
    uiStore.setMounted(false);

    resizeObserver?.disconnect();
    resizeObserver = null;

    app.unmount();
    styleDestroy?.();
    styleDestroy = null;

    pausePersistence();
    disposeLifecycle();

    $iframe.remove();
    $host.remove();
  };

  return {
    unmount,
  };
}
