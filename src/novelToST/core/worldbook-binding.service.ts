type ChatNameScope = 'current';

const CHAT_SCOPE: ChatNameScope = 'current';

export type ChatWorldbookBindingSnapshot = {
  chatName: ChatNameScope;
  boundWorldbookName: string | null;
  hasBinding: boolean;
};

function normalizeWorldbookName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeRequiredWorldbookName(name: string): string {
  const normalized = normalizeWorldbookName(name);
  if (!normalized) {
    throw new Error('世界书名称不能为空');
  }

  return normalized;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function getChatWorldbookBindingSnapshot(): Promise<ChatWorldbookBindingSnapshot> {
  try {
    const boundWorldbookName = normalizeWorldbookName(getChatWorldbookName(CHAT_SCOPE));

    return {
      chatName: CHAT_SCOPE,
      boundWorldbookName,
      hasBinding: Boolean(boundWorldbookName),
    };
  } catch (error) {
    throw new Error(`读取当前聊天世界书绑定失败：${toErrorMessage(error)}`);
  }
}

export async function bindChatWorldbook(name: string): Promise<ChatWorldbookBindingSnapshot> {
  const worldbookName = normalizeRequiredWorldbookName(name);

  try {
    await rebindChatWorldbook(CHAT_SCOPE, worldbookName);
  } catch (error) {
    throw new Error(`应用当前聊天世界书绑定失败：${toErrorMessage(error)}`);
  }

  return getChatWorldbookBindingSnapshot();
}
