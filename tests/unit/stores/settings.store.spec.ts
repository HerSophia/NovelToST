import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import { stMocks } from '../../setup/st-globals.mock';

describe('settings.store', () => {
  it('should initialize settings from script variables and merge defaults', () => {
    stMocks.getVariables.mockReturnValue({
      totalChapters: 12,
      currentChapter: 4,
      exportIncludeUser: true,
      extractMode: 'tags',
      extractTags: 'content',
    });

    const store = useNovelSettingsStore();
    store.init();

    expect(store.initialized).toBe(true);
    expect(store.settings.totalChapters).toBe(12);
    expect(store.settings.currentChapter).toBe(4);
    expect(store.settings.exportIncludeUser).toBe(true);
    expect(store.settings.extractMode).toBe('tags');
    expect(store.settings.prompt.length).toBeGreaterThan(0);
    expect(store.settings.worldbook.chunkSize).toBe(15000);
    expect(store.settings.worldbook.customApiProvider).toBe('gemini');
  });

  it('should fallback to defaults and warn when script variables are invalid', () => {
    stMocks.getVariables.mockReturnValue({
      totalChapters: 'invalid-number',
    });

    const store = useNovelSettingsStore();
    store.init();

    expect(store.settings.totalChapters).toBe(1000);
    expect(store.settings.currentChapter).toBe(0);
    expect(stMocks.toastr.warning).toHaveBeenCalledWith('NovelToST 设置解析失败，已回退到默认值');
  });

  it('should patch valid fields and throw when patch payload is invalid', () => {
    const store = useNovelSettingsStore();

    store.patch({ totalChapters: 20, currentChapter: 2 });
    expect(store.settings.totalChapters).toBe(20);
    expect(store.settings.currentChapter).toBe(2);

    expect(() => store.patch({ totalChapters: 0 })).toThrow();
    expect(store.settings.totalChapters).toBe(20);
  });

  it('should clamp and truncate chapter index updates', () => {
    const store = useNovelSettingsStore();

    store.setCurrentChapter(7.9);
    expect(store.settings.currentChapter).toBe(7);

    store.setCurrentChapter(-5);
    expect(store.settings.currentChapter).toBe(0);
  });

  it('should migrate legacy worldbook fields into settings.worldbook and prefer nested values', () => {
    stMocks.getVariables.mockReturnValue({
      chunkSize: 18000,
      parallelConcurrency: 6,
      customApiProvider: 'openai',
      worldbook: {
        customApiProvider: 'deepseek',
      },
    });

    const store = useNovelSettingsStore();
    store.init();

    expect(store.settings.worldbook.chunkSize).toBe(18000);
    expect(store.settings.worldbook.parallelConcurrency).toBe(6);
    expect(store.settings.worldbook.customApiProvider).toBe('deepseek');

    store.patch({ worldbook: { chunkSize: 22000 } });
    expect(store.settings.worldbook.chunkSize).toBe(22000);
  });
});
