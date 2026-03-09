import type { StoryFoundation } from '../types/foundation';
import type {
  ChapterDetail,
  MasterOutlineNode,
  OutlineAIConfig,
  OutlineMessage,
  OutlineMentionRef,
  OutlineMentionSnapshot,
  OutlineSession,
  OutlineSnapshot,
  Storyline,
} from '../types/outline';
import {
  extractJsonPayload,
  parseOutlineWorkshopPayload,
  requestOutlineAIResponse,
} from './outline-ai.service';
import { buildFoundationPromptSection } from './foundation-prompt.service';
import type { FoundationPatch } from './foundation-legacy.service';
import type { LLMRuntimeOptions } from './llm-api.service';
import {
  renderOutlineMentionSnapshotForPrompt,
} from './outline-mention.service';

type OutlineChatMessageInput = {
  role: 'user' | 'assistant' | 'system';
  text: string;
  parseError?: string | null;
  rawResponse?: string;
  mentions?: OutlineMentionRef[];
  mentionSnapshots?: OutlineMentionSnapshot[];
  mentionWarnings?: string[];
};

type OutlineChatSnapshotSeed = {
  storylines?: Storyline[];
  masterOutline?: MasterOutlineNode[];
  detailsByChapter?: Record<number, ChapterDetail>;
};

export type OutlineChatStoreAdapter = {
  ai: OutlineAIConfig;
  foundation: StoryFoundation;
  storylines: Storyline[];
  masterOutline: MasterOutlineNode[];
  detailsByChapter: Record<number, ChapterDetail>;
  sessions: OutlineSession[];
  appendMessage: (sessionId: string, input: OutlineChatMessageInput) => unknown;
  appendSnapshot: (sessionId: string, snapshotSeed?: OutlineChatSnapshotSeed) => OutlineSnapshot | null;
};

export type RunOutlineChatRoundInput = {
  store: OutlineChatStoreAdapter;
  sessionId: string;
  userInstruction: string;
  chapterCount: number;
  llm?: LLMRuntimeOptions;
  mentions?: OutlineMentionRef[];
  mentionSnapshots?: OutlineMentionSnapshot[];
  mentionWarnings?: string[];
};

export type OutlineChatRoundResult = {
  assistantText: string;
  rawResponse: string;
  payload: unknown | null;
  parseError: string | null;
  snapshot: OutlineSnapshot | null;
  foundationPatch: FoundationPatch | null;
  parseWarnings: string[];
};

const OUTLINE_MENTION_PROMPT_MAX_COUNT = 5;
const OUTLINE_MENTION_PROMPT_MAX_ITEM_LENGTH = 800;
const OUTLINE_MENTION_PROMPT_MAX_TOTAL_LENGTH = 3000;
const OUTLINE_MENTION_PROMPT_TRUNCATION_SUFFIX = '…（已截断）';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractAssistantTextFromPayload(payload: unknown): string {
  if (!isRecord(payload)) {
    return '';
  }

  const keys = ['assistantReply', 'assistantText', 'reply', 'message', 'summary'];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function extractAssistantText(rawResponse: string, payload: unknown | null): string {
  const fromPayload = extractAssistantTextFromPayload(payload);
  if (fromPayload) {
    return fromPayload;
  }

  const withoutCodeBlock = rawResponse.replace(/```(?:json)?[\s\S]*?```/gi, '').trim();
  if (withoutCodeBlock) {
    return withoutCodeBlock;
  }

  const normalizedRaw = rawResponse.trim();
  if (normalizedRaw) {
    return normalizedRaw;
  }

  return '已完成本轮大纲协作。';
}

function stringifyStorylinesForPrompt(storylines: Storyline[]): string {
  if (storylines.length === 0) {
    return '[]';
  }

  return JSON.stringify(
    storylines.map(storyline => ({
      id: storyline.id,
      type: storyline.type,
      title: storyline.title,
      description: storyline.description,
      sortOrder: storyline.sortOrder,
      status: storyline.status,
      ...(storyline.themeKeywords?.length ? { themeKeywords: storyline.themeKeywords } : {}),
      ...(storyline.linkedCharacters?.length ? { linkedCharacters: storyline.linkedCharacters } : {}),
    })),
    null,
    2,
  );
}

function stringifyMasterOutlineForPrompt(nodes: MasterOutlineNode[]): string {
  if (nodes.length === 0) {
    return '[]';
  }

  return JSON.stringify(
    nodes.map(node => ({
      id: node.id,
      storylineId: node.storylineId ?? '',
      title: node.title,
      summary: node.summary,
      chapterStart: node.chapterStart,
      chapterEnd: node.chapterEnd,
      phase: node.phase ?? 'custom',
      events: node.events ?? [],
      timeStart: node.timeStart ?? null,
      timeEnd: node.timeEnd ?? null,
      keywords: node.keywords ?? [],
      characters: node.characters ?? [],
      locations: node.locations ?? [],
      status: node.status,
      ...(node.tensionLevel != null ? { tensionLevel: node.tensionLevel } : {}),
      ...(node.emotionalTone ? { emotionalTone: node.emotionalTone } : {}),
      ...(node.foreshadowing?.length ? { foreshadowing: node.foreshadowing } : {}),
      ...(node.payoffs?.length ? { payoffs: node.payoffs } : {}),
    })),
    null,
    2,
  );
}

function stringifyRecentMessages(messages: OutlineMessage[]): string {
  if (messages.length === 0) {
    return '[]';
  }

  return JSON.stringify(
    messages.slice(-8).map(message => ({
      role: message.role,
      text: message.text,
    })),
    null,
    2,
  );
}

function normalizeMentionPromptWarnings(warnings: string[] | undefined): string[] {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return [];
  }

  const deduped = new Set<string>();
  warnings.forEach(warning => {
    const normalized = warning.trim();
    if (!normalized) {
      return;
    }
    deduped.add(normalized);
  });

  return [...deduped.values()];
}

function normalizeMentionSnapshotsForPrompt(snapshots: OutlineMentionSnapshot[] | undefined): OutlineMentionSnapshot[] {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return [];
  }

  const deduped = new Map<string, OutlineMentionSnapshot>();
  snapshots.forEach(snapshot => {
    const id = snapshot.id.trim();
    if (!id || snapshot.content.trim().length === 0) {
      return;
    }

    deduped.set(`${snapshot.kind}:${id}`, {
      ...snapshot,
      id,
      label: snapshot.label.trim() || id,
    });
  });

  return [...deduped.values()];
}

function truncateMentionPromptText(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return '';
  }

  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= OUTLINE_MENTION_PROMPT_TRUNCATION_SUFFIX.length) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - OUTLINE_MENTION_PROMPT_TRUNCATION_SUFFIX.length)}${OUTLINE_MENTION_PROMPT_TRUNCATION_SUFFIX}`;
}

function renderMentionPromptBlock(snapshot: OutlineMentionSnapshot): string {
  const frozenAt = snapshot.frozenAt.trim() || 'unknown';
  return [
    `- kind=${snapshot.kind} | id=${snapshot.id} | frozenAt=${frozenAt}`,
    renderOutlineMentionSnapshotForPrompt(snapshot),
  ].join('\n');
}

function buildMentionPromptSection(input: {
  mentionSnapshots?: OutlineMentionSnapshot[];
  mentionWarnings?: string[];
}): { section: string; warnings: string[] } {
  const warnings = normalizeMentionPromptWarnings(input.mentionWarnings);
  const normalizedSnapshots = normalizeMentionSnapshotsForPrompt(input.mentionSnapshots);

  if (normalizedSnapshots.length === 0) {
    return { section: '（无）', warnings };
  }

  let snapshots = normalizedSnapshots;
  if (snapshots.length > OUTLINE_MENTION_PROMPT_MAX_COUNT) {
    warnings.push(`引用数量超出上限：共 ${snapshots.length} 项，仅注入前 ${OUTLINE_MENTION_PROMPT_MAX_COUNT} 项。`);
    snapshots = snapshots.slice(0, OUTLINE_MENTION_PROMPT_MAX_COUNT);
  }

  const perItemTrimmedSnapshots = snapshots.map(snapshot => {
    if (snapshot.content.length <= OUTLINE_MENTION_PROMPT_MAX_ITEM_LENGTH) {
      return snapshot;
    }

    warnings.push(`引用内容过长：${snapshot.label || snapshot.id} 已截断至 ${OUTLINE_MENTION_PROMPT_MAX_ITEM_LENGTH} 字符。`);
    return {
      ...snapshot,
      content: truncateMentionPromptText(snapshot.content, OUTLINE_MENTION_PROMPT_MAX_ITEM_LENGTH),
    };
  });

  const acceptedSnapshots: OutlineMentionSnapshot[] = [];
  let consumedLength = 0;
  let omittedCount = 0;

  for (let index = 0; index < perItemTrimmedSnapshots.length; index += 1) {
    const snapshot = perItemTrimmedSnapshots[index]!;
    const rendered = renderMentionPromptBlock(snapshot);
    const separatorLength = acceptedSnapshots.length > 0 ? 2 : 0;
    const nextLength = consumedLength + separatorLength + rendered.length;

    if (nextLength <= OUTLINE_MENTION_PROMPT_MAX_TOTAL_LENGTH) {
      acceptedSnapshots.push(snapshot);
      consumedLength = nextLength;
      continue;
    }

    const remainingLength = OUTLINE_MENTION_PROMPT_MAX_TOTAL_LENGTH - consumedLength - separatorLength;
    let appendedPartial = false;

    if (remainingLength > 80) {
      const renderedPrefix = renderMentionPromptBlock({
        ...snapshot,
        content: '',
      });
      const contentBudget = Math.max(0, remainingLength - renderedPrefix.length);

      if (contentBudget > 20) {
        const partialSnapshot: OutlineMentionSnapshot = {
          ...snapshot,
          content: truncateMentionPromptText(snapshot.content, contentBudget),
        };
        const partialRendered = renderMentionPromptBlock(partialSnapshot);
        if (partialSnapshot.content.trim().length > 0 && partialRendered.length <= remainingLength) {
          acceptedSnapshots.push(partialSnapshot);
          consumedLength += separatorLength + partialRendered.length;
          warnings.push(`引用总长度超限：${snapshot.label || snapshot.id} 已按剩余额度摘要。`);
          appendedPartial = true;
        }
      }
    }

    omittedCount = perItemTrimmedSnapshots.length - index - (appendedPartial ? 1 : 0);
    break;
  }

  if (omittedCount > 0) {
    warnings.push(`引用总长度达到上限，额外省略 ${omittedCount} 项。`);
  }

  return {
    section: acceptedSnapshots.length > 0 ? acceptedSnapshots.map(snapshot => renderMentionPromptBlock(snapshot)).join('\n\n') : '（无）',
    warnings: normalizeMentionPromptWarnings(warnings),
  };
}

type OutlineChatPrompts = {
  systemPrompt: string;
  userPrompt: string;
};

function buildOutlineChatPrompts(input: {
  session: OutlineSession;
  foundation: StoryFoundation;
  storylines: Storyline[];
  masterOutline: MasterOutlineNode[];
  detailsByChapter: Record<number, ChapterDetail>;
  chapterCount: number;
  userInstruction: string;
  mentionSnapshots?: OutlineMentionSnapshot[];
  mentionWarnings?: string[];
}): OutlineChatPrompts {
  const detailChapters = Object.keys(input.detailsByChapter)
    .map(key => Number(key))
    .filter(chapter => Number.isFinite(chapter))
    .sort((left, right) => left - right);

  const mentionPromptSection = buildMentionPromptSection({
    mentionSnapshots: input.mentionSnapshots,
    mentionWarnings: input.mentionWarnings,
  });

  const systemPrompt = [
    '你是小说策划助手，正在和用户一起打磨大纲。',
    '下面的系统上下文是当前最新状态，始终以它为准。',
    `当前会话：${input.session.title || '（未命名会话）'}（type=${input.session.type}）`,
    `会话种子：${input.session.seed || '（未提供）'}`,
    `目标章节数：${Math.max(1, Math.trunc(input.chapterCount))}`,
    `已存在细纲章节（可为空）：${detailChapters.length > 0 ? detailChapters.join('、') : '无'}`,
    '',
    '输出规则（必须遵守）：',
    '1. 先给一段简短自然语言说明本轮调整意图。',
    '2. 再给且仅给一个 JSON code block。',
    '3. 默认采用“增量协作模式”：仅返回本轮新增/修改/删除的最小变更，不重复未变化内容。',
    '4. 若用户未明确要求“全量重做/完整重排/覆盖全部章节/输出完整大纲”，禁止回传全量 storylines/nodes/details。',
    '5. 增量模式优先使用 commands：type 可用 foundation.patch、node.create/node.update/node.delete/node.split、storyline.create/storyline.update/storyline.delete、detail.create/detail.update/detail.delete（兼容 C/U/D）。',
    '6. update 类命令必须只提供最小 patch（仅包含变化字段），不要把对象全量回填。',
    '7. 若需要把一个节点细化为多个节点，优先使用 node.split：提供 sourceId/id + nodes(>=2)；默认保留原节点作为第一段，其余段落自动新增。',
    '8. create 类命令只创建与本轮指令直接相关的新条目；delete 仅删除用户明确要求删除的条目。',
    '9. 若同时给出直接字段（foundation/storylines/nodes/details）与命令字段，系统会先读取直接字段，再执行命令。',
    '10. 当前流程不是细纲全覆盖流程，不要强制输出每章细纲；用户未要求时只补关键章节。',
    '11. 仅当用户明确要求“完整重做/给出全量现状”时，才可返回 foundation/storylines/nodes/details 的全量快照。',
    '',
    'JSON（增量模式）示例：',
    '```json',
    '{',
    '  "assistantReply": "已补充第二卷和第三卷节点，保持现有内容不变。",',
    '  "commands": [',
    '    {',
    '      "type": "node.create",',
    '      "node": {',
    '        "id": "node-2",',
    '        "storylineId": "line-main",',
    '        "title": "第二卷：龙门争锋",',
    '        "summary": "补充第二卷核心推进",',
    '        "chapterStart": 201,',
    '        "chapterEnd": 450,',
    '        "phase": "confrontation",',
    '        "status": "draft"',
    '      }',
    '    },',
    '    { "type": "node.update", "id": "node-1", "patch": { "chapterEnd": 200 } },',
    '    { "type": "node.split", "id": "node-2", "nodes": [{ "title": "第二卷上", "chapterStart": 201, "chapterEnd": 320 }, { "title": "第二卷下", "chapterStart": 321, "chapterEnd": 450 }] },',
    '    { "type": "foundation.patch", "patch": { "core": { "emotionalTone": "更紧张" } } },',
    '    { "type": "detail.update", "chapter": 202, "patch": { "goal": "明确第二卷中段目标" } }',
    '  ]',
    '}',
    '```',
    '',
    '当前故事基底：',
    buildFoundationPromptSection(input.foundation),
    '',
    '当前 Storylines：',
    stringifyStorylinesForPrompt(input.storylines),
    '',
    '当前 Nodes：',
    stringifyMasterOutlineForPrompt(input.masterOutline),
    '',
    '引用上下文（来自@）：',
    mentionPromptSection.section,
    ...(mentionPromptSection.warnings.length > 0
      ? [
          '',
          '引用上下文告警：',
          ...mentionPromptSection.warnings.map(warning => `- ${warning}`),
        ]
      : []),
  ].join('\n');

  const userPrompt = [
    '最近消息：',
    stringifyRecentMessages(input.session.messages),
    '',
    '请在不丢失系统上下文的前提下完成本轮协作。',
    '如果用户本轮没有明确要求全量重做，请默认按增量模式输出。',
    '',
    '用户本轮指令：',
    input.userInstruction,
  ].join('\n');

  return {
    systemPrompt,
    userPrompt,
  };
}

function resolveOutlineChatSession(store: OutlineChatStoreAdapter, sessionId: string): OutlineSession {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) {
    throw new Error('会话 id 不能为空');
  }

  const session = store.sessions.find(item => item.id === normalizedSessionId);
  if (!session) {
    throw new Error('指定会话不存在，请刷新后重试');
  }

  if (session.type !== 'outline_chat') {
    throw new Error('当前仅支持 outline_chat 会话协作');
  }

  return session;
}

export async function runOutlineChatRound(input: RunOutlineChatRoundInput): Promise<OutlineChatRoundResult> {
  const session = resolveOutlineChatSession(input.store, input.sessionId);
  const userInstruction = input.userInstruction.trim();
  if (!userInstruction) {
    throw new Error('请输入本轮大纲协作指令');
  }

  input.store.appendMessage(session.id, {
    role: 'user',
    text: userInstruction,
    mentions: input.mentions,
    mentionSnapshots: input.mentionSnapshots,
    mentionWarnings: input.mentionWarnings,
  });

  const latestSession = resolveOutlineChatSession(input.store, session.id);
  const latestUserMessage =
    [...latestSession.messages].reverse().find(message => message.role === 'user') ?? null;
  const mentionSnapshotsForPrompt = latestUserMessage?.mentionSnapshots ?? input.mentionSnapshots;
  const mentionWarningsForPrompt = latestUserMessage?.mentionWarnings ?? input.mentionWarnings;

  const prompts = buildOutlineChatPrompts({
    session: latestSession,
    foundation: input.store.foundation,
    storylines: input.store.storylines,
    masterOutline: input.store.masterOutline,
    detailsByChapter: input.store.detailsByChapter,
    chapterCount: input.chapterCount,
    userInstruction,
    mentionSnapshots: mentionSnapshotsForPrompt,
    mentionWarnings: mentionWarningsForPrompt,
  });

  const rawResponse = await requestOutlineAIResponse({
    prompt: prompts.userPrompt,
    systemPrompt: prompts.systemPrompt,
    aiConfig: input.store.ai,
    llm: input.llm,
  });

  const payload = extractJsonPayload(rawResponse);
  const assistantText = extractAssistantText(rawResponse, payload);

  const appendAssistantMessage = (parseError: string | null) => {
    const messageInput =
      parseError === null
        ? {
            role: 'assistant' as const,
            text: assistantText,
          }
        : {
            role: 'assistant' as const,
            text: assistantText,
            rawResponse,
            parseError,
          };

    input.store.appendMessage(
      session.id,
      messageInput,
    );
  };

  if (payload === null) {
    const parseError = '结构化解析失败：未提取到 JSON 结果';
    appendAssistantMessage(parseError);
    return {
      assistantText,
      rawResponse,
      payload,
      parseError,
      snapshot: null,
      foundationPatch: null,
      parseWarnings: [],
    };
  }

  const parsed = parseOutlineWorkshopPayload(payload, {
    chapterCount: input.chapterCount,
    baseStorylines: input.store.storylines,
    baseMasterOutline: input.store.masterOutline,
    baseDetailsByChapter: input.store.detailsByChapter,
  });

  const hasFoundationPatch = parsed.foundationPatch !== null && Object.keys(parsed.foundationPatch).length > 0;
  const hasSnapshotFields = parsed.storylines !== null || parsed.masterOutline !== null || parsed.detailsByChapter !== null;

  if (!hasFoundationPatch && !hasSnapshotFields) {
    const warningPreview = parsed.commandWarnings.slice(0, 3);
    const parseError =
      warningPreview.length > 0
        ? `结构化解析失败：已识别 JSON，但命令未能生效。${warningPreview.join('；')}${
            parsed.commandWarnings.length > warningPreview.length
              ? `（另有 ${parsed.commandWarnings.length - warningPreview.length} 条警告）`
              : ''
          }`
        : '结构化解析失败：JSON 中缺少可应用字段（foundation/storylines/nodes/details/commands/foundationCommands/nodeCommands/storylineCommands/detailCommands）';
    appendAssistantMessage(parseError);

    return {
      assistantText,
      rawResponse,
      payload,
      parseError,
      snapshot: null,
      foundationPatch: parsed.foundationPatch,
      parseWarnings: parsed.commandWarnings,
    };
  }

  const snapshotSeed: OutlineChatSnapshotSeed = {};

  if (parsed.storylines !== null) {
    snapshotSeed.storylines = parsed.storylines;
  }

  if (parsed.masterOutline !== null) {
    snapshotSeed.masterOutline = parsed.masterOutline;
  }

  if (parsed.detailsByChapter !== null) {
    snapshotSeed.detailsByChapter = parsed.detailsByChapter;
  }

  const snapshot = input.store.appendSnapshot(session.id, snapshotSeed);
  if (!snapshot) {
    const parseError = '结构化解析成功，但保存快照失败';
    appendAssistantMessage(parseError);
    return {
      assistantText,
      rawResponse,
      payload,
      parseError,
      snapshot: null,
      foundationPatch: parsed.foundationPatch,
      parseWarnings: parsed.commandWarnings,
    };
  }

  appendAssistantMessage(null);

  return {
    assistantText,
    rawResponse,
    payload,
    parseError: null,
    snapshot,
    foundationPatch: parsed.foundationPatch,
    parseWarnings: parsed.commandWarnings,
  };
}
