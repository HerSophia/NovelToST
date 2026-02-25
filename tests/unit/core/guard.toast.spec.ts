import { ensureCanStartGeneration, waitForReplyStageSettled, waitForSendStageSettled } from '@/novelToST/core/guard.service';
import { useGenerationStore } from '@/novelToST/stores/generation.store';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import type { NovelSettings } from '@/novelToST/types';

function makeSettings(overrides: Partial<NovelSettings> = {}): NovelSettings {
  const settingsStore = useNovelSettingsStore();
  settingsStore.patch({
    enableSendToastDetection: true,
    sendToastWaitTimeout: 60000,
    sendPostToastWaitTime: 0,
    enableReplyToastDetection: true,
    replyToastWaitTimeout: 60000,
    replyPostToastWaitTime: 0,
    ...overrides,
  });

  return { ...settingsStore.settings };
}

describe('guard.service toast guards', () => {
  it('should throw when generation is already running', () => {
    const generationStore = useGenerationStore();
    generationStore.start({ targetChapters: 10, currentChapter: 0 });

    expect(() => ensureCanStartGeneration()).toThrow('任务已在运行中，请勿重复启动');

    generationStore.markIdle();
    expect(() => ensureCanStartGeneration()).not.toThrow();
  });

  it('should wait initial send stage delay when toast detection is enabled', async () => {
    vi.useFakeTimers();
    const settings = makeSettings({ enableSendToastDetection: true });

    let settled = false;
    const waiting = waitForSendStageSettled(settings).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(400);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    await waiting;

    expect(settled).toBe(true);
  });

  it('should resolve after reply toast disappears', async () => {
    vi.useFakeTimers();

    document.body.innerHTML = '<div id="toast-container"><div class="toast">loading</div></div>';
    window.setTimeout(() => {
      document.querySelector('#toast-container .toast')?.remove();
    }, 300);

    const waiting = waitForReplyStageSettled(
      makeSettings({
        enableReplyToastDetection: true,
        replyToastWaitTimeout: 5000,
      }),
    );

    await vi.advanceTimersByTimeAsync(1200);
    await waiting;

    expect(document.querySelectorAll('#toast-container .toast')).toHaveLength(0);
  });

  it('should continue with warning when toast wait timeout exceeded', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    document.body.innerHTML = '<div id="toast-container"><div class="toast">persistent</div></div>';

    const waiting = waitForReplyStageSettled(
      makeSettings({
        enableReplyToastDetection: true,
        replyToastWaitTimeout: 1000,
      }),
    );

    await vi.advanceTimersByTimeAsync(2200);
    await waiting;

    expect(warnSpy).toHaveBeenCalledWith('[novelToST][回复阶段] 弹窗等待超时，继续执行');
  });
});
