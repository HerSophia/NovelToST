import { ensureChatReady, normalizeError, waitForResumeOrAbort } from '@/novelToST/core/guard.service';
import { useGenerationStore } from '@/novelToST/stores/generation.store';
import { stMocks } from '../../setup/st-globals.mock';

describe('guard.service', () => {
  describe('normalizeError', () => {
    it('should normalize Error instance to message', () => {
      expect(normalizeError(new Error('failed'))).toBe('failed');
    });

    it('should normalize unknown input to default message', () => {
      expect(normalizeError({})).toBe('未知错误');
    });
  });

  describe('ensureChatReady', () => {
    it('should throw when chat is empty', () => {
      stMocks.getLastMessageId.mockReturnValue(-1);
      expect(() => ensureChatReady()).toThrow('当前聊天为空，请先创建至少一条消息');
    });

    it('should pass when chat has at least one message', () => {
      stMocks.getLastMessageId.mockReturnValue(0);
      expect(() => ensureChatReady()).not.toThrow();
    });
  });

  describe('waitForResumeOrAbort', () => {
    it('should resolve after generation resumed', async () => {
      vi.useFakeTimers();

      const generationStore = useGenerationStore();
      generationStore.start({ targetChapters: 10, currentChapter: 0 });
      generationStore.pause();

      let settled = false;
      const waiting = waitForResumeOrAbort().then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(600);
      expect(settled).toBe(false);

      generationStore.resume();
      await vi.advanceTimersByTimeAsync(250);
      await waiting;

      expect(settled).toBe(true);
    });

    it('should reject when abort requested', async () => {
      const generationStore = useGenerationStore();
      generationStore.start({ targetChapters: 10, currentChapter: 0 });
      generationStore.requestStop();

      await expect(waitForResumeOrAbort()).rejects.toThrow('用户中止');
    });
  });
});
