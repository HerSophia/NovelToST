import type { NovelSettings } from '../types';
import { sleep, waitForReplyStageSettled, waitForResumeOrAbort, waitForSendStageSettled } from './guard.service';
import { useGenerationStore } from '../stores/generation.store';
import { useNovelSettingsStore } from '../stores/settings.store';

function getLatestAssistantMessageAfter(baseMessageId: number): ChatMessage | null {
  const lastMessageId = getLastMessageId();
  if (lastMessageId <= baseMessageId) {
    return null;
  }

  const start = Math.max(0, baseMessageId + 1);
  const assistantMessages = getChatMessages(`${start}-${lastMessageId}`, {
    role: 'assistant',
  }) as ChatMessage[];

  return assistantMessages.at(-1) ?? null;
}

async function waitForAssistantMessage(baseMessageId: number, settings: NovelSettings): Promise<number> {
  const startedAt = Date.now();

  while (true) {
    await waitForResumeOrAbort();

    const latest = getLatestAssistantMessageAfter(baseMessageId);
    if (latest) {
      return latest.message_id;
    }

    if (Date.now() - startedAt > settings.maxWaitForResponseStart) {
      throw new Error('等待 AI 开始回复超时');
    }

    await sleep(300);
  }
}

async function waitForMessageStable(targetMessageId: number, settings: NovelSettings): Promise<ChatMessage> {
  let stableCount = 0;
  let lastLength = -1;
  const stableStartedAt = Date.now();

  while (true) {
    await waitForResumeOrAbort();

    const current = getChatMessages(targetMessageId, { role: 'assistant' })[0] as ChatMessage | undefined;
    const text = current?.message?.trim() ?? '';
    const currentLength = text.length;

    if (currentLength > 0 && currentLength === lastLength) {
      stableCount += 1;
    } else {
      stableCount = 0;
      lastLength = currentLength;
    }

    if (stableCount >= settings.stabilityRequiredCount && current) {
      return current;
    }

    if (Date.now() - stableStartedAt > settings.maxWaitForStable) {
      throw new Error('等待 AI 回复稳定超时');
    }

    await sleep(settings.stabilityCheckInterval);
  }
}

export async function sendPrompt(prompt: string, settings: NovelSettings): Promise<number> {
  const baseMessageId = getLastMessageId();
  await createChatMessages([
    {
      role: 'user',
      message: prompt,
    },
  ]);

  await triggerSlash('/trigger');
  await waitForSendStageSettled(settings);
  return baseMessageId;
}

export async function waitForAIResponseStable(baseMessageId: number, settings: NovelSettings): Promise<ChatMessage> {
  const targetMessageId = await waitForAssistantMessage(baseMessageId, settings);
  await waitForMessageStable(targetMessageId, settings);

  if (settings.replyWaitTime > 0) {
    await sleep(settings.replyWaitTime);
  }

  await waitForReplyStageSettled(settings);

  return waitForMessageStable(targetMessageId, settings);
}

export async function generateSingleChapter(chapterNumber: number, settings: NovelSettings): Promise<number> {
  const baseMessageId = await sendPrompt(settings.prompt, settings);
  const assistantMessage = await waitForAIResponseStable(baseMessageId, settings);
  const length = assistantMessage.message.trim().length;

  if (length < settings.minChapterLength) {
    throw new Error(`第 ${chapterNumber} 章长度不足（${length}/${settings.minChapterLength}）`);
  }

  return length;
}

export async function startLoop(options: {
  onAutoSave?: (chapter: number) => Promise<void>;
  onChapterDone?: (chapter: number, length: number) => Promise<void>;
  onChapterFailed?: (chapter: number, retry: number, message: string) => Promise<void>;
} = {}): Promise<{ stoppedByUser: boolean; completed: boolean }> {
  const settingsStore = useNovelSettingsStore();
  const generationStore = useGenerationStore();

  for (let chapter = settingsStore.settings.currentChapter; chapter < settingsStore.settings.totalChapters; chapter += 1) {
    await waitForResumeOrAbort();
    if (generationStore.abortRequested) {
      break;
    }

    let success = false;
    for (let retry = 0; retry < settingsStore.settings.maxRetries; retry += 1) {
      generationStore.setRetryCount(retry);
      try {
        const length = await generateSingleChapter(chapter + 1, settingsStore.settings);
        generationStore.recordGeneratedChapter(length);
        settingsStore.setCurrentChapter(chapter + 1);
        generationStore.setCurrentChapter(chapter + 1);
        generationStore.setRetryCount(0);

        if (options.onChapterDone) {
          await options.onChapterDone(chapter + 1, length);
        }

        if ((chapter + 1) % settingsStore.settings.autoSaveInterval === 0 && options.onAutoSave) {
          await options.onAutoSave(chapter + 1);
        }

        success = true;
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        generationStore.appendError(message, chapter + 1);
        if (options.onChapterFailed) {
          await options.onChapterFailed(chapter + 1, retry + 1, message);
        }

        if (retry < settingsStore.settings.maxRetries - 1) {
          await sleep(settingsStore.settings.retryBackoffMs);
        }
      }
    }

    if (!success) {
      settingsStore.setCurrentChapter(chapter + 1);
      generationStore.setCurrentChapter(chapter + 1);
    }
  }

  const completed = settingsStore.settings.currentChapter >= settingsStore.settings.totalChapters;
  return {
    stoppedByUser: generationStore.abortRequested,
    completed,
  };
}
