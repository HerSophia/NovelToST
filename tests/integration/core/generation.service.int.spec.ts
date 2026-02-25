import { generateSingleChapter, sendPrompt, startLoop } from '@/novelToST/core/generation.service';
import { useGenerationStore } from '@/novelToST/stores/generation.store';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import type { NovelSettings } from '@/novelToST/types';
import { stMocks } from '../../setup/st-globals.mock';

const guardMock = vi.hoisted(() => ({
  sleep: vi.fn(async (_ms: number) => {}),
  waitForReplyStageSettled: vi.fn(async (_settings: NovelSettings) => {}),
  waitForResumeOrAbort: vi.fn(async () => {}),
  waitForSendStageSettled: vi.fn(async (_settings: NovelSettings) => {}),
}));

vi.mock('@/novelToST/core/guard.service', () => ({
  sleep: guardMock.sleep,
  waitForReplyStageSettled: guardMock.waitForReplyStageSettled,
  waitForResumeOrAbort: guardMock.waitForResumeOrAbort,
  waitForSendStageSettled: guardMock.waitForSendStageSettled,
}));

function createAssistantMessage(messageId: number, message: string): ChatMessage {
  return {
    message_id: messageId,
    role: 'assistant',
    name: 'AI',
    message,
  } as ChatMessage;
}

function makeSettings(overrides: Partial<NovelSettings> = {}): NovelSettings {
  const settingsStore = useNovelSettingsStore();
  settingsStore.patch({
    totalChapters: 1,
    currentChapter: 0,
    maxRetries: 2,
    autoSaveInterval: 1,
    minChapterLength: 2,
    replyWaitTime: 0,
    stabilityRequiredCount: 1,
    retryBackoffMs: 0,
    ...overrides,
  });

  return { ...settingsStore.settings };
}

describe('generation.service integration', () => {
  beforeEach(() => {
    guardMock.sleep.mockClear();
    guardMock.waitForReplyStageSettled.mockClear();
    guardMock.waitForResumeOrAbort.mockClear();
    guardMock.waitForSendStageSettled.mockClear();
  });

  it('should send prompt and return base message id', async () => {
    const settings = makeSettings();
    stMocks.getLastMessageId.mockReturnValue(5);

    const baseMessageId = await sendPrompt('继续写作', settings);

    expect(baseMessageId).toBe(5);
    expect(stMocks.createChatMessages).toHaveBeenCalledWith([
      {
        role: 'user',
        message: '继续写作',
      },
    ]);
    expect(stMocks.triggerSlash).toHaveBeenCalledWith('/trigger');
    expect(guardMock.waitForSendStageSettled).toHaveBeenCalledWith(settings);
  });

  it('should throw when generated chapter length is below minimum', async () => {
    const settings = makeSettings({ minChapterLength: 10 });

    stMocks.getLastMessageId.mockReturnValueOnce(0).mockReturnValue(1);
    stMocks.getChatMessages.mockImplementation((range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => {
      if (typeof range === 'string' && options?.role === 'assistant') {
        return [createAssistantMessage(1, '短')];
      }
      if (range === 1) {
        return [createAssistantMessage(1, '短')];
      }
      return [];
    });

    await expect(generateSingleChapter(1, settings)).rejects.toThrow('第 1 章长度不足（1/10）');
  });

  it('should retry failed chapter then complete and trigger callbacks', async () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({
      totalChapters: 1,
      currentChapter: 0,
      maxRetries: 2,
      autoSaveInterval: 1,
      minChapterLength: 5,
      replyWaitTime: 0,
      stabilityRequiredCount: 1,
      retryBackoffMs: 0,
    });

    const generationStore = useGenerationStore();
    generationStore.start({ targetChapters: 1, currentChapter: 0 });

    let lastMessageId = 0;
    stMocks.getLastMessageId.mockImplementation(() => lastMessageId);
    stMocks.createChatMessages.mockImplementation(async () => {
      lastMessageId += 1;
    });
    stMocks.getChatMessages.mockImplementation((range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => {
      const resolveMessage = (messageId: number) =>
        createAssistantMessage(messageId, messageId === 1 ? '短' : '这是足够长的内容');

      if (typeof range === 'string' && options?.role === 'assistant') {
        const end = Number(range.split('-').at(-1) ?? '0');
        return [resolveMessage(end)];
      }

      if (typeof range === 'number') {
        return [resolveMessage(range)];
      }

      return [];
    });

    const onAutoSave = vi.fn(async (_chapter: number) => {});
    const onChapterDone = vi.fn(async (_chapter: number, _length: number) => {});
    const onChapterFailed = vi.fn(async (_chapter: number, _retry: number, _message: string) => {});

    const result = await startLoop({
      onAutoSave,
      onChapterDone,
      onChapterFailed,
    });

    expect(result).toEqual({ stoppedByUser: false, completed: true });
    expect(onChapterFailed).toHaveBeenCalledTimes(1);
    expect(onChapterFailed).toHaveBeenCalledWith(1, 1, expect.stringContaining('长度不足'));
    expect(onChapterDone).toHaveBeenCalledTimes(1);
    expect(onChapterDone.mock.calls[0]?.[0]).toBe(1);
    expect(onAutoSave).toHaveBeenCalledWith(1);
    expect(settingsStore.settings.currentChapter).toBe(1);
    expect(generationStore.currentChapter).toBe(1);
    expect(generationStore.stats.errors).toHaveLength(1);
  });

  it('should return stoppedByUser when abort requested before chapter run', async () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({ totalChapters: 3, currentChapter: 0 });

    const generationStore = useGenerationStore();
    generationStore.start({ targetChapters: 3, currentChapter: 0 });
    generationStore.requestStop();

    const result = await startLoop();

    expect(result).toEqual({ stoppedByUser: true, completed: false });
    expect(stMocks.createChatMessages).not.toHaveBeenCalled();
  });
});
