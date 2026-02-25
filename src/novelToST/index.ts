import { bootstrapNovelToSTPanel } from './app/bootstrap';
import { useGenerationControl } from './composables/useGenerationControl';
import { registerNovelButtons } from './commands/buttons';
import { registerNovelDebugCommand } from './commands/debug';

$(() => {
  const { unmount } = bootstrapNovelToSTPanel();
  const control = useGenerationControl();
  const { unregister: unregisterDebug } = registerNovelDebugCommand();

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
  });

  $(window).on('pagehide', () => {
    unregister();
    unregisterDebug();
    unmount();
  });
});
