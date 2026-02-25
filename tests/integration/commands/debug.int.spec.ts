import { registerNovelDebugCommand } from '@/novelToST/commands/debug';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import { stMocks } from '../../setup/st-globals.mock';

function createMessage(messageId: number, role: ChatMessage['role'], message: string, name = 'AI'): ChatMessage {
  return {
    message_id: messageId,
    role,
    name,
    message,
  } as ChatMessage;
}

describe('registerNovelDebugCommand integration', () => {
  afterEach(() => {
    delete window.novelToSTDebug;
  });

  it('should register help command and unregister cleanly', () => {
    const { unregister } = registerNovelDebugCommand();

    expect(typeof window.novelToSTDebug).toBe('function');

    const help = window.novelToSTDebug?.();
    expect(help).toEqual(
      expect.objectContaining({
        description: 'NovelToST 调试命令入口',
        examples: expect.any(Array),
      }),
    );

    unregister();
    expect(window.novelToSTDebug).toBeUndefined();
  });

  it('should return floor snapshot using display content when useRawContent is false', () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({
      useRawContent: false,
      extractTags: 'content',
      tagSeparator: '|',
    });

    stMocks.getChatMessages.mockImplementation((range: string | number) => {
      if (range === 12) {
        return [createMessage(12, 'assistant', '<content>raw</content>')];
      }
      return [];
    });
    stMocks.retrieveDisplayedMessage.mockReturnValue({
      text: () => '<content>display</content>',
    });

    registerNovelDebugCommand();
    const floor = window.novelToSTDebug?.('floor', 12) as {
      sourceMode: string;
      parsedTags: string[];
      tagExtractedPreview: string | null;
      sourcePreview: string;
    };

    expect(floor.sourceMode).toBe('display');
    expect(floor.parsedTags).toEqual(['content']);
    expect(floor.tagExtractedPreview).toBe('display');
    expect(floor.sourcePreview).toContain('<content>display</content>');
  });

  it('should return null for latest command when no assistant exists', () => {
    stMocks.getLastMessageId.mockReturnValue(5);
    stMocks.getChatMessages.mockImplementation((range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => {
      if (typeof range === 'string' && options?.role === 'assistant') {
        return [];
      }
      return [];
    });

    registerNovelDebugCommand();
    const latest = window.novelToSTDebug?.('latest');

    expect(latest).toBeNull();
  });

  it('should run extract command with payload overrides', () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({
      useRawContent: true,
      extractTags: 'ignored',
      tagSeparator: '\n\n',
    });

    stMocks.getLastMessageId.mockReturnValue(8);
    stMocks.getChatMessages.mockImplementation((range: string | number) => {
      if (range === 8) {
        return [createMessage(8, 'assistant', '<content>A</content><detail>B</detail>')];
      }
      return [];
    });

    registerNovelDebugCommand();
    const extracted = window.novelToSTDebug?.('extract', {
      messageId: 8,
      tags: 'content detail',
      separator: '|',
      useRawContent: true,
    }) as {
      messageId: number;
      tags: string[];
      separator: string;
      extractedPreview: string;
      extractedLength: number;
    };

    expect(extracted.messageId).toBe(8);
    expect(extracted.tags).toEqual(['content', 'detail']);
    expect(extracted.separator).toBe('|');
    expect(extracted.extractedPreview).toBe('A|B');
    expect(extracted.extractedLength).toBe(3);
  });

  it('should return help message for unknown command', () => {
    registerNovelDebugCommand();

    const result = window.novelToSTDebug?.('unknown-command');

    expect(result).toEqual(
      expect.objectContaining({
        description: 'NovelToST 调试命令入口',
      }),
    );
  });

  it('should return null for latest command when chat is empty', () => {
    stMocks.getLastMessageId.mockReturnValue(-1);

    registerNovelDebugCommand();
    const latest = window.novelToSTDebug?.('latest');

    expect(latest).toBeNull();
  });

  it('should use last message id for floor command when payload is not a number', () => {
    stMocks.getLastMessageId.mockReturnValue(15);
    stMocks.getChatMessages.mockImplementation((range: string | number) => {
      if (range === 15) {
        return [];
      }
      return [];
    });

    registerNovelDebugCommand();
    const floor = window.novelToSTDebug?.('floor', 'not-number');

    expect(floor).toBeNull();
  });

  it('should throw when extract target message is missing', () => {
    stMocks.getLastMessageId.mockReturnValue(99);
    stMocks.getChatMessages.mockReturnValue([]);

    registerNovelDebugCommand();

    expect(() => window.novelToSTDebug?.('extract')).toThrow('找不到楼层 99');
  });

  it('should apply tagPreview overrides from payload', () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({
      extractMode: 'all',
      extractTags: '',
      tagSeparator: '\n\n',
      useRawContent: true,
    });

    stMocks.getLastMessageId.mockReturnValue(4);
    stMocks.getChatMessages.mockImplementation((range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => {
      if (typeof range === 'string' && options?.role === 'assistant') {
        return [createMessage(4, 'assistant', '<content>hello</content>')];
      }
      return [];
    });

    registerNovelDebugCommand();
    const preview = window.novelToSTDebug?.('tagPreview', { extractMode: 'tags', extractTags: 'content', tagSeparator: '|' });

    expect(preview).toBe('hello');
  });
});
