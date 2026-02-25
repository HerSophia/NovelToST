import { nextTick } from 'vue';
import { useScriptPersistence } from '@/novelToST/composables/useScriptPersistence';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';

describe('useScriptPersistence', () => {
  const insertOrAssignVariablesMock = vi.fn();

  beforeEach(() => {
    insertOrAssignVariablesMock.mockReset();
    vi.stubGlobal('insertOrAssignVariables', insertOrAssignVariablesMock);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should skip persist when store is not initialized', () => {
    const persistence = useScriptPersistence();

    persistence.persistNow();

    expect(insertOrAssignVariablesMock).not.toHaveBeenCalled();
  });

  it('should hydrate settings and persist immediately', () => {
    const persistence = useScriptPersistence();
    const settingsStore = useNovelSettingsStore();

    persistence.hydrate();

    expect(settingsStore.initialized).toBe(true);
    expect(insertOrAssignVariablesMock).toHaveBeenCalledTimes(1);
    expect(insertOrAssignVariablesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        totalChapters: settingsStore.settings.totalChapters,
        currentChapter: settingsStore.settings.currentChapter,
      }),
      settingsStore.scriptVariableOption,
    );
  });

  it('should persist setting changes with debounce when active', async () => {
    vi.useFakeTimers();

    const persistence = useScriptPersistence();
    const settingsStore = useNovelSettingsStore();

    persistence.hydrate();
    insertOrAssignVariablesMock.mockClear();

    settingsStore.patch({ totalChapters: 33 });
    await nextTick();
    await vi.advanceTimersByTimeAsync(settingsStore.settings.persistDebounceMs + 20);

    expect(insertOrAssignVariablesMock).toHaveBeenCalledTimes(1);
  });

  it('should pause and resume persistence watching', async () => {
    vi.useFakeTimers();

    const persistence = useScriptPersistence();
    const settingsStore = useNovelSettingsStore();

    persistence.hydrate();
    insertOrAssignVariablesMock.mockClear();

    persistence.pausePersistence();
    settingsStore.patch({ totalChapters: 40 });
    await nextTick();
    await vi.advanceTimersByTimeAsync(settingsStore.settings.persistDebounceMs + 20);

    expect(insertOrAssignVariablesMock).not.toHaveBeenCalled();

    persistence.resumePersistence();
    settingsStore.patch({ totalChapters: 41 });
    await nextTick();
    await vi.advanceTimersByTimeAsync(settingsStore.settings.persistDebounceMs + 20);

    expect(insertOrAssignVariablesMock).toHaveBeenCalledTimes(1);
  });
});
