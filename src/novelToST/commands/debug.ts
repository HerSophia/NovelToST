import { buildTagPreview, extractTagContents, parseTagInput } from '../core/extract.service';
import { useNovelSettingsStore } from '../stores/settings.store';
import type { NovelSettings } from '../types';

type DebugCommand = 'help' | 'settings' | 'floor' | 'latest' | 'tagPreview' | 'extract';

type NovelToSTDebugFn = (command?: DebugCommand | string, payload?: unknown) => unknown;

type TagPreviewOverrides = Partial<Pick<NovelSettings, 'extractMode' | 'extractTags' | 'tagSeparator' | 'useRawContent'>>;

type DebugExtractPayload = {
  messageId?: number;
  tags?: string | string[];
  separator?: string;
  useRawContent?: boolean;
};

type DebugFloorSnapshot = {
  messageId: number;
  role: ChatMessage['role'];
  name: string;
  sourceMode: 'raw' | 'display';
  rawLength: number;
  displayLength: number;
  sourceLength: number;
  rawPreview: string;
  displayPreview: string;
  sourcePreview: string;
  parsedTags: string[];
  tagExtractedPreview: string | null;
};

declare global {
  interface Window {
    novelToSTDebug?: NovelToSTDebugFn;
  }
}

const HELP_MESSAGE = {
  description: 'NovelToST 调试命令入口',
  examples: [
    "window.novelToSTDebug() // 显示帮助",
    "window.novelToSTDebug('settings') // 查看当前设置快照",
    "window.novelToSTDebug('floor') // 检查最新楼层（raw/display/source）",
    "window.novelToSTDebug('floor', 12) // 检查指定楼层",
    "window.novelToSTDebug('latest') // 检查最新 AI 楼层",
    "window.novelToSTDebug('tagPreview') // 查看当前标签预览",
    "window.novelToSTDebug('extract', { messageId: 12, tags: 'content detail' })",
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toSafeInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

function normalizePreviewOverrides(payload: unknown): TagPreviewOverrides {
  if (!isRecord(payload)) {
    return {};
  }

  const overrides: TagPreviewOverrides = {};
  if (payload.extractMode === 'all' || payload.extractMode === 'tags') {
    overrides.extractMode = payload.extractMode;
  }
  if (typeof payload.extractTags === 'string') {
    overrides.extractTags = payload.extractTags;
  }
  if (typeof payload.tagSeparator === 'string') {
    overrides.tagSeparator = payload.tagSeparator;
  }
  if (typeof payload.useRawContent === 'boolean') {
    overrides.useRawContent = payload.useRawContent;
  }

  return overrides;
}

function normalizeExtractPayload(payload: unknown): DebugExtractPayload {
  if (typeof payload === 'number') {
    return { messageId: Math.trunc(payload) };
  }

  if (!isRecord(payload)) {
    return {};
  }

  const normalized: DebugExtractPayload = {};

  const messageId = toSafeInt(payload.messageId);
  if (messageId !== undefined) {
    normalized.messageId = messageId;
  }

  if (typeof payload.tags === 'string' || Array.isArray(payload.tags)) {
    normalized.tags = payload.tags as string | string[];
  }

  if (typeof payload.separator === 'string') {
    normalized.separator = payload.separator;
  }

  if (typeof payload.useRawContent === 'boolean') {
    normalized.useRawContent = payload.useRawContent;
  }

  return normalized;
}

function getMessageById(messageId: number): ChatMessage | null {
  const [message] = getChatMessages(messageId, { role: 'all' }) as ChatMessage[];
  return message ?? null;
}

function getDisplayedText(messageId: number): string {
  try {
    return retrieveDisplayedMessage(messageId).text().trim();
  } catch {
    return '';
  }
}

function resolveMessageText(message: ChatMessage, useRawContent: boolean): { rawText: string; displayText: string; sourceText: string } {
  const rawText = message.message?.trim() ?? '';
  const displayText = getDisplayedText(message.message_id);

  if (useRawContent) {
    return {
      rawText,
      displayText,
      sourceText: rawText,
    };
  }

  return {
    rawText,
    displayText,
    sourceText: displayText || rawText,
  };
}

function buildFloorSnapshot(messageId: number, settings: NovelSettings): DebugFloorSnapshot | null {
  const message = getMessageById(messageId);
  if (!message) {
    return null;
  }

  const { rawText, displayText, sourceText } = resolveMessageText(message, settings.useRawContent);
  const parsedTags = parseTagInput(settings.extractTags);
  const tagExtracted = parsedTags.length > 0 ? extractTagContents(sourceText, parsedTags, settings.tagSeparator) : '';

  return {
    messageId: message.message_id,
    role: message.role,
    name: message.name,
    sourceMode: settings.useRawContent ? 'raw' : 'display',
    rawLength: rawText.length,
    displayLength: displayText.length,
    sourceLength: sourceText.length,
    rawPreview: rawText.slice(0, 200),
    displayPreview: displayText.slice(0, 200),
    sourcePreview: sourceText.slice(0, 200),
    parsedTags,
    tagExtractedPreview: tagExtracted ? tagExtracted.slice(0, 200) : null,
  };
}

function runExtractDebug(payload: unknown, settings: NovelSettings) {
  const parsedPayload = normalizeExtractPayload(payload);
  const targetMessageId = parsedPayload.messageId ?? getLastMessageId();
  const message = getMessageById(targetMessageId);
  if (!message) {
    throw new Error(`找不到楼层 ${targetMessageId}`);
  }

  const useRawContent = parsedPayload.useRawContent ?? settings.useRawContent;
  const { sourceText } = resolveMessageText(message, useRawContent);

  const tags = Array.isArray(parsedPayload.tags)
    ? parsedPayload.tags.map(tag => tag.trim()).filter(Boolean)
    : parseTagInput(parsedPayload.tags ?? settings.extractTags);
  const separator = parsedPayload.separator ?? settings.tagSeparator;
  const extracted = extractTagContents(sourceText, tags, separator);

  return {
    messageId: message.message_id,
    useRawContent,
    tags,
    separator,
    sourcePreview: sourceText.slice(0, 300),
    extractedPreview: extracted.slice(0, 300),
    extractedLength: extracted.length,
  };
}

export function registerNovelDebugCommand(): { unregister: () => void } {
  const settingsStore = useNovelSettingsStore();

  const debug: NovelToSTDebugFn = (command = 'help', payload) => {
    const settingsSnapshot = { ...settingsStore.settings };

    switch (command) {
      case 'help': {
        console.info('[novelToST][debug] 可用命令', HELP_MESSAGE);
        return HELP_MESSAGE;
      }
      case 'settings': {
        console.debug('[novelToST][debug] settings', settingsSnapshot);
        return settingsSnapshot;
      }
      case 'floor': {
        const target = typeof payload === 'number' ? Math.trunc(payload) : getLastMessageId();
        const floorSnapshot = buildFloorSnapshot(target, settingsSnapshot);
        console.debug('[novelToST][debug] floor', floorSnapshot);
        return floorSnapshot;
      }
      case 'latest': {
        if (getLastMessageId() < 0) {
          console.debug('[novelToST][debug] 当前聊天为空');
          return null;
        }

        const lastMessageId = getLastMessageId();
        const latestAssistant = (getChatMessages(`0-${lastMessageId}`, { role: 'assistant' }) as ChatMessage[]).at(-1);
        if (!latestAssistant) {
          console.debug('[novelToST][debug] latest assistant not found');
          return null;
        }

        const floorSnapshot = buildFloorSnapshot(latestAssistant.message_id, settingsSnapshot);
        console.debug('[novelToST][debug] latest', floorSnapshot);
        return floorSnapshot;
      }
      case 'tagPreview': {
        const previewSettings = { ...settingsSnapshot, ...normalizePreviewOverrides(payload) };
        const preview = buildTagPreview(previewSettings);
        console.debug('[novelToST][debug] tagPreview', preview);
        return preview;
      }
      case 'extract': {
        const extracted = runExtractDebug(payload, settingsSnapshot);
        console.debug('[novelToST][debug] extract', extracted);
        return extracted;
      }
      default: {
        console.warn(`[novelToST][debug] 未知命令: ${String(command)}`);
        console.info('[novelToST][debug] 使用说明', HELP_MESSAGE);
        return HELP_MESSAGE;
      }
    }
  };

  window.novelToSTDebug = debug;
  if (window.parent && window.parent !== window) {
    window.parent.novelToSTDebug = debug;
  }
  console.info('[novelToST] 已注册调试命令：window.novelToSTDebug()');

  return {
    unregister: () => {
      delete window.novelToSTDebug;
      if (window.parent && window.parent !== window) {
        try {
          delete window.parent.novelToSTDebug;
        } catch {
          // ignore
        }
      }
    },
  };
}
