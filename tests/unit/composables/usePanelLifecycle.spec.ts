import { nextTick } from 'vue';
import { usePanelLifecycle } from '@/novelToST/composables/usePanelLifecycle';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';

const scriptUtilMock = vi.hoisted(() => ({
  reloadOnChatChange: vi.fn(),
}));

vi.mock('@util/script', () => ({
  reloadOnChatChange: scriptUtilMock.reloadOnChatChange,
}));

describe('usePanelLifecycle', () => {
  beforeEach(() => {
    scriptUtilMock.reloadOnChatChange.mockReset();
    scriptUtilMock.reloadOnChatChange.mockImplementation(() => ({ stop: vi.fn() }));
  });

  it('should enable and disable reload strategy when setting changes', async () => {
    const stop = vi.fn();
    scriptUtilMock.reloadOnChatChange.mockReturnValue({ stop });

    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({ reloadOnChatChange: true });

    const lifecycle = usePanelLifecycle();
    expect(scriptUtilMock.reloadOnChatChange).toHaveBeenCalledTimes(1);

    settingsStore.patch({ reloadOnChatChange: false });
    await nextTick();

    expect(stop).toHaveBeenCalledTimes(1);
    lifecycle.dispose();
  });

  it('should cleanup watcher and stopper on dispose', async () => {
    const stop = vi.fn();
    scriptUtilMock.reloadOnChatChange.mockReturnValue({ stop });

    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({ reloadOnChatChange: true });

    const lifecycle = usePanelLifecycle();
    lifecycle.dispose();

    expect(stop).toHaveBeenCalledTimes(1);

    settingsStore.patch({ reloadOnChatChange: false });
    await nextTick();
    settingsStore.patch({ reloadOnChatChange: true });
    await nextTick();

    expect(scriptUtilMock.reloadOnChatChange).toHaveBeenCalledTimes(1);
  });

  it('should keep strategy disabled when setting is false', () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({ reloadOnChatChange: false });

    const lifecycle = usePanelLifecycle();

    expect(scriptUtilMock.reloadOnChatChange).not.toHaveBeenCalled();
    lifecycle.dispose();
  });
});
