import { useGenerationStore } from '../stores/generation.store';
import type { NovelSettings } from '../types';

export const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

export function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
}

export function ensureChatReady(): void {
  const lastMessageId = getLastMessageId();
  if (lastMessageId < 0) {
    throw new Error('当前聊天为空，请先创建至少一条消息');
  }
}

export function ensureCanStartGeneration(): void {
  const generationStore = useGenerationStore();
  if (generationStore.isRunning) {
    throw new Error('任务已在运行中，请勿重复启动');
  }
}

export async function waitForResumeOrAbort(): Promise<void> {
  const generationStore = useGenerationStore();
  while (generationStore.isPaused && !generationStore.abortRequested) {
    await sleep(200);
  }

  if (generationStore.abortRequested) {
    throw new Error('用户中止');
  }
}

function hasActiveToast(): boolean {
  const toastContainer = document.querySelector('#toast-container');
  if (!toastContainer) {
    return false;
  }
  return toastContainer.querySelectorAll('.toast').length > 0;
}

function getToastText(): string {
  const toast = document.querySelector('#toast-container .toast');
  return toast?.textContent?.trim().slice(0, 50) ?? '';
}

async function waitForToastsClear(options: {
  timeout: number;
  postWaitTime: number;
  phase: string;
}): Promise<void> {
  if (!hasActiveToast()) {
    return;
  }

  const startedAt = Date.now();
  let lastLogAt = 0;

  while (hasActiveToast()) {
    await waitForResumeOrAbort();

    const elapsed = Date.now() - startedAt;
    if (elapsed > options.timeout) {
      console.warn(`[novelToST][${options.phase}] 弹窗等待超时，继续执行`);
      return;
    }

    if (elapsed - lastLogAt >= 5000) {
      console.debug(`[novelToST][${options.phase}] 等待弹窗消失 (${Math.round(elapsed / 1000)}s)`, getToastText());
      lastLogAt = elapsed;
    }

    await sleep(500);
  }

  if (options.postWaitTime > 0) {
    await sleep(options.postWaitTime);
  }
}

export async function waitForSendStageSettled(settings: NovelSettings): Promise<void> {
  if (!settings.enableSendToastDetection) {
    return;
  }

  await sleep(500);
  await waitForToastsClear({
    timeout: settings.sendToastWaitTimeout,
    postWaitTime: settings.sendPostToastWaitTime,
    phase: '发送阶段',
  });
}

export async function waitForReplyStageSettled(settings: NovelSettings): Promise<void> {
  if (!settings.enableReplyToastDetection) {
    return;
  }

  await waitForToastsClear({
    timeout: settings.replyToastWaitTimeout,
    postWaitTime: settings.replyPostToastWaitTime,
    phase: '回复阶段',
  });
}
