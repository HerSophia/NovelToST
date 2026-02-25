import type { ChapterRecord, NovelSettings } from '../types';

export function parseTagInput(raw: string): string[] {
  if (!raw.trim()) {
    return [];
  }
  return raw
    .split(/[,;，；\s\n\r]+/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

export function extractTagContents(text: string, tags: string[], separator = '\n\n'): string {
  if (!text || tags.length === 0) {
    return '';
  }

  const parts: string[] = [];
  for (const tag of tags) {
    const escaped = _.escapeRegExp(tag.trim());
    if (!escaped) {
      continue;
    }

    const pattern = new RegExp(`<\\s*${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\s*/\\s*${escaped}\\s*>`, 'gi');
    let matched: RegExpExecArray | null;
    while ((matched = pattern.exec(text)) !== null) {
      const content = matched[1]?.trim();
      if (content) {
        parts.push(content);
      }
    }
  }

  return parts.join(separator);
}

function resolveMessageContent(message: ChatMessage, useRawContent: boolean): string {
  const rawText = message.message?.trim() ?? '';
  if (useRawContent) {
    return rawText;
  }

  try {
    const displayed = retrieveDisplayedMessage(message.message_id).text().trim();
    if (displayed) {
      return displayed;
    }
  } catch {
    // ignored, fallback to raw
  }

  return rawText;
}

export function collectChapters(settings: NovelSettings): ChapterRecord[] {
  const lastMessageId = getLastMessageId();
  if (lastMessageId < 0) {
    return [];
  }

  const start = settings.exportAll ? 0 : Math.max(0, settings.exportStartFloor);
  const end = settings.exportAll ? lastMessageId : Math.min(lastMessageId, settings.exportEndFloor);

  if (start > end) {
    return [];
  }

  const messages = getChatMessages(`${start}-${end}`, { role: 'all' }) as ChatMessage[];
  const tags = parseTagInput(settings.extractTags);
  const useTagMode = settings.extractMode === 'tags' && tags.length > 0;

  const chapters: ChapterRecord[] = [];
  for (const message of messages) {
    const includeByRole =
      (message.role === 'assistant' && settings.exportIncludeAI) ||
      (message.role === 'user' && settings.exportIncludeUser) ||
      message.role === 'system';

    if (!includeByRole) {
      continue;
    }

    const sourceText = resolveMessageContent(message, settings.useRawContent);
    if (!sourceText) {
      continue;
    }

    const content = useTagMode ? extractTagContents(sourceText, tags, settings.tagSeparator) : sourceText;
    if (!content) {
      continue;
    }

    chapters.push({
      floor: message.message_id,
      index: chapters.length + 1,
      role: message.role,
      name: message.name,
      content,
      message_id: message.message_id,
    });
  }

  return chapters;
}

export function buildTagPreview(settings: NovelSettings): string {
  const lastMessageId = getLastMessageId();
  if (lastMessageId < 0) {
    return '暂无消息可预览';
  }

  const latestAssistant = (getChatMessages(`0-${lastMessageId}`, { role: 'assistant' }) as ChatMessage[]).at(-1);
  if (!latestAssistant?.message?.trim()) {
    return '暂无 AI 消息可预览';
  }

  const sourceText = resolveMessageContent(latestAssistant, settings.useRawContent);
  if (settings.extractMode !== 'tags') {
    return sourceText.slice(0, 200);
  }

  const tags = parseTagInput(settings.extractTags);
  if (tags.length === 0) {
    return '标签模式已启用，但未配置标签名';
  }

  const extracted = extractTagContents(sourceText, tags, settings.tagSeparator);
  return extracted ? extracted.slice(0, 400) : `未匹配到标签：${tags.join(', ')}`;
}
