import { startLoop } from '@/novelToST/core/generation.service';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { useGenerationStore } from '@/novelToST/stores/generation.store';
import { useOutlineStore } from '@/novelToST/stores/outline.store';
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

function configureSingleChapterRun(overrides: Partial<NovelSettings> = {}): void {
  const settingsStore = useNovelSettingsStore();
  settingsStore.patch({
    totalChapters: 1,
    currentChapter: 0,
    maxRetries: 1,
    autoSaveInterval: 1,
    minChapterLength: 2,
    replyWaitTime: 0,
    stabilityRequiredCount: 1,
    retryBackoffMs: 0,
    prompt: '继续写作（旧 prompt）',
    ...overrides,
  });

  const generationStore = useGenerationStore();
  generationStore.start({
    targetChapters: settingsStore.settings.totalChapters,
    currentChapter: settingsStore.settings.currentChapter,
  });
}

function mockSingleAssistantReply(message: string = '这是足够长的章节内容'): void {
  stMocks.getLastMessageId.mockReturnValueOnce(0).mockReturnValue(1);
  stMocks.getChatMessages.mockImplementation((range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => {
    if (typeof range === 'string' && options?.role === 'assistant') {
      return [createAssistantMessage(1, message)];
    }

    if (range === 1) {
      return [createAssistantMessage(1, message)];
    }

    return [];
  });
}

describe('generation + outline integration', () => {
  beforeEach(() => {
    guardMock.sleep.mockClear();
    guardMock.waitForReplyStageSettled.mockClear();
    guardMock.waitForResumeOrAbort.mockClear();
    guardMock.waitForSendStageSettled.mockClear();
  });

  it('should fallback to outline context and emit warning when detail is missing under warn_fallback', async () => {
    configureSingleChapterRun({ prompt: '旧 prompt：继续推进剧情' });

    const outlineStore = useOutlineStore();
    const foundationStore = useFoundationStore();
    outlineStore.setEnabled(true);
    outlineStore.setMissingDetailPolicy('warn_fallback');
    foundationStore.patchModule('positioning', {
      title: '雾港调查',
    });
    foundationStore.patchModule('core', { logline: '港口失踪案牵出旧势力' });
    foundationStore.patchModule('protagonist', { name: '陈渡' });

    outlineStore.replaceMasterOutline([
      {
        id: 'node-1',
        title: '夜访档案室',
        summary: '主角在档案室拿到被篡改的旧案卷宗',
        chapterStart: 1,
        chapterEnd: 3,
        turningPoints: ['卷宗出现前后矛盾记录'],
        status: 'draft',
      },
    ]);
    outlineStore.replaceChapterDetails([]);

    mockSingleAssistantReply('这是一段足够长的章节正文');

    const onChapterPromptWarning = vi.fn(async (_chapter: number, _warning: string) => {});
    const result = await startLoop({ onChapterPromptWarning });

    expect(result).toEqual({ stoppedByUser: false, completed: true });
    expect(stMocks.createChatMessages).toHaveBeenCalledWith([
      {
        role: 'user',
        message: expect.stringContaining('无细纲模式'),
      },
    ]);
    expect(onChapterPromptWarning).toHaveBeenCalledTimes(1);
    expect(onChapterPromptWarning).toHaveBeenCalledWith(1, expect.stringContaining('回退到总纲上下文模式'));
  });

  it('should block chapter send when detail is missing under strict_block', async () => {
    configureSingleChapterRun({ prompt: '旧 prompt：严格模式', maxRetries: 1 });

    const outlineStore = useOutlineStore();
    outlineStore.setEnabled(true);
    outlineStore.setMissingDetailPolicy('strict_block');
    outlineStore.replaceChapterDetails([]);

    const onChapterFailed = vi.fn(async (_chapter: number, _retry: number, _message: string) => {});
    const onChapterPromptWarning = vi.fn(async (_chapter: number, _warning: string) => {});

    await startLoop({
      onChapterFailed,
      onChapterPromptWarning,
    });

    expect(stMocks.createChatMessages).not.toHaveBeenCalled();
    expect(onChapterPromptWarning).not.toHaveBeenCalled();
    expect(onChapterFailed).toHaveBeenCalledTimes(1);
    expect(onChapterFailed).toHaveBeenCalledWith(1, 1, expect.stringContaining('strict_block'));
    expect(useGenerationStore().stats.errors[0]?.message).toContain('strict_block');
  });

  it('should keep legacy behavior when outline is disabled', async () => {
    configureSingleChapterRun({ prompt: '旧 prompt：关闭 Outline' });

    const outlineStore = useOutlineStore();
    outlineStore.setEnabled(false);

    mockSingleAssistantReply('这是另一个足够长的章节正文');

    const onChapterPromptWarning = vi.fn(async (_chapter: number, _warning: string) => {});

    const result = await startLoop({ onChapterPromptWarning });

    expect(result).toEqual({ stoppedByUser: false, completed: true });
    expect(stMocks.createChatMessages).toHaveBeenCalledWith([
      {
        role: 'user',
        message: '旧 prompt：关闭 Outline',
      },
    ]);
    expect(onChapterPromptWarning).not.toHaveBeenCalled();
  });
});
