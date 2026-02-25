import { buildTagPreview, collectChapters } from '@/novelToST/core/extract.service';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import type { NovelSettings } from '@/novelToST/types';
import { stMocks } from '../../setup/st-globals.mock';

function createMessage(messageId: number, role: ChatMessage['role'], message: string, name = 'AI'): ChatMessage {
  return {
    message_id: messageId,
    role,
    name,
    message,
  } as ChatMessage;
}

function makeSettings(overrides: Partial<NovelSettings> = {}): NovelSettings {
  const settingsStore = useNovelSettingsStore();
  settingsStore.patch({
    exportAll: true,
    exportStartFloor: 0,
    exportEndFloor: 99999,
    exportIncludeAI: true,
    exportIncludeUser: false,
    extractMode: 'all',
    extractTags: '',
    tagSeparator: '\n\n',
    useRawContent: true,
    ...overrides,
  });

  return { ...settingsStore.settings };
}

describe('extract.service chapter collection and preview', () => {
  it('should return empty chapter list when chat is empty', () => {
    stMocks.getLastMessageId.mockReturnValue(-1);

    const settings = makeSettings();
    const chapters = collectChapters(settings);

    expect(chapters).toEqual([]);
  });

  it('should collect chapters by range and role filters', () => {
    stMocks.getLastMessageId.mockReturnValue(5);
    stMocks.getChatMessages.mockImplementation((range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => {
      if (range === '1-3' && options?.role === 'all') {
        return [
          createMessage(1, 'user', '用户消息', 'User'),
          createMessage(2, 'assistant', 'AI消息', 'AI'),
          createMessage(3, 'system', '系统消息', 'System'),
        ];
      }
      return [];
    });

    const settings = makeSettings({
      exportAll: false,
      exportStartFloor: 1,
      exportEndFloor: 3,
      exportIncludeUser: false,
      exportIncludeAI: true,
    });

    const chapters = collectChapters(settings);

    expect(chapters).toHaveLength(2);
    expect(chapters.map(chapter => chapter.floor)).toEqual([2, 3]);
    expect(chapters.map(chapter => chapter.index)).toEqual([1, 2]);
  });

  it('should extract from displayed content in tag mode when useRawContent is false', () => {
    stMocks.getLastMessageId.mockReturnValue(1);
    stMocks.getChatMessages.mockImplementation((range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => {
      if (range === '0-1' && options?.role === 'all') {
        return [createMessage(1, 'assistant', '<content>raw</content>')];
      }
      return [];
    });
    stMocks.retrieveDisplayedMessage.mockReturnValue({
      text: () => '<content>display</content>',
    });

    const settings = makeSettings({
      extractMode: 'tags',
      extractTags: 'content',
      tagSeparator: '|',
      useRawContent: false,
    });

    const chapters = collectChapters(settings);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.content).toBe('display');
  });

  it('should fallback to raw text when displayed text retrieval throws', () => {
    stMocks.getLastMessageId.mockReturnValue(1);
    stMocks.getChatMessages.mockImplementation((range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => {
      if (range === '0-1' && options?.role === 'all') {
        return [createMessage(1, 'assistant', 'raw content')];
      }
      return [];
    });
    stMocks.retrieveDisplayedMessage.mockImplementation(() => {
      throw new Error('display unavailable');
    });

    const settings = makeSettings({
      extractMode: 'all',
      useRawContent: false,
    });

    const chapters = collectChapters(settings);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.content).toBe('raw content');
  });

  it('should build fallback preview strings for edge cases', () => {
    stMocks.getLastMessageId.mockReturnValue(-1);
    expect(buildTagPreview(makeSettings())).toBe('暂无消息可预览');

    stMocks.getLastMessageId.mockReturnValue(1);
    stMocks.getChatMessages.mockImplementation((range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => {
      if (range === '0-1' && options?.role === 'assistant') {
        return [createMessage(1, 'assistant', '   ')];
      }
      return [];
    });
    expect(buildTagPreview(makeSettings())).toBe('暂无 AI 消息可预览');

    stMocks.getChatMessages.mockImplementation((range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => {
      if (range === '0-1' && options?.role === 'assistant') {
        return [createMessage(1, 'assistant', '<content>abc</content>')];
      }
      return [];
    });
    expect(buildTagPreview(makeSettings({ extractMode: 'tags', extractTags: '' }))).toBe('标签模式已启用，但未配置标签名');
    expect(buildTagPreview(makeSettings({ extractMode: 'tags', extractTags: 'detail' }))).toBe('未匹配到标签：detail');
  });
});
