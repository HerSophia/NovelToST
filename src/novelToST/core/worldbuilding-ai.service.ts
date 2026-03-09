import { z } from 'zod';
import type { StoryFoundation } from '../types/foundation';
import type { OutlineMentionSnapshot } from '../types/outline';
import { buildFoundationWorldBriefSection } from './foundation-prompt.service';
import type {
  WorldbookEntryCandidate,
  WorldbuildingDraft,
  WorldbuildingMessage,
  WorldbuildingType,
} from '../types/worldbuilding';
import { renderOutlineMentionSnapshotsForPromptSection } from './outline-mention.service';
import { requestLLMText, type LLMRuntimeOptions } from './llm-api.service';

export type WorldbuildingAIIntent = 'expand' | 'refine' | 'consistency' | 'candidates';

export type WorldbuildingEnvironmentHints = {
  loadedPresetName?: string | null;
  currentCharacterName?: string | null;
  activePromptCount?: number | null;
};

export type WorldbuildingAIRequestInput = {
  type: WorldbuildingType;
  sessionTitle: string;
  seed: string;
  userInstruction: string;
  draft: WorldbuildingDraft;
  lockedFields: string[];
  recentMessages: WorldbuildingMessage[];
  environment?: WorldbuildingEnvironmentHints;
  foundation?: StoryFoundation;
  mentionSnapshots?: OutlineMentionSnapshot[];
  mentionWarnings?: string[];
};

export type WorldbuildingAIRuntimeOptions = LLMRuntimeOptions;

type WorldbuildingAIResultBase = {
  assistantText: string;
  rawResponse: string;
  payload: unknown | null;
  parseError: string | null;
};

export type WorldbuildingDraftAIResult = WorldbuildingAIResultBase & {
  draft: WorldbuildingDraft | null;
  consistencyIssues: string[];
};

export type WorldbuildingCandidateAIResult = WorldbuildingAIResultBase & {
  candidates: WorldbookEntryCandidate[];
};

const WorldbuildingRelationOutputSchema = z
  .object({
    target: z.string().optional().default(''),
    relation: z.string().optional().default(''),
  })
  .prefault({});

const WorldbuildingDraftOutputSchema = z
  .object({
    name: z.string().optional().default(''),
    aliases: z.unknown().optional(),
    summary: z.string().optional().default(''),
    facts: z.unknown().optional(),
    constraints: z.unknown().optional(),
    relations: z.unknown().optional(),
    extra: z.unknown().optional(),
  })
  .prefault({});

const WorldbuildingCandidateOutputSchema = z
  .object({
    category: z.string().optional().default('设定'),
    name: z.string().optional().default(''),
    keywords: z.unknown().optional(),
    content: z.string().optional().default(''),
    strategy: z.enum(['constant', 'selective']).optional().default('constant'),
  })
  .prefault({});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringList(values: unknown): string[] {
  if (Array.isArray(values)) {
    return values
      .map(value => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);
  }

  if (typeof values === 'string') {
    return values
      .split(/\r?\n|[，,；;]/)
      .map(value => value.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeExtraRecord(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    return {};
  }

  const normalized: Record<string, unknown> = {};
  Object.entries(raw).forEach(([key, value]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return;
    }

    normalized[normalizedKey] = value;
  });

  return normalized;
}

function normalizeRelations(raw: unknown): WorldbuildingDraft['relations'] {
  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        const parsed = WorldbuildingRelationOutputSchema.safeParse(item);
        if (!parsed.success) {
          return null;
        }

        return {
          target: parsed.data.target.trim(),
          relation: parsed.data.relation.trim(),
        };
      })
      .filter((relation): relation is WorldbuildingDraft['relations'][number] => relation !== null)
      .filter(relation => relation.target.length > 0 || relation.relation.length > 0);
  }

  if (isRecord(raw)) {
    return Object.entries(raw)
      .map(([target, relation]) => ({
        target: target.trim(),
        relation: typeof relation === 'string' ? relation.trim() : '',
      }))
      .filter(item => item.target.length > 0 || item.relation.length > 0);
  }

  return [];
}

function normalizeDraft(raw: unknown): WorldbuildingDraft | null {
  const parsed = WorldbuildingDraftOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  return {
    name: parsed.data.name.trim(),
    aliases: normalizeStringList(parsed.data.aliases),
    summary: parsed.data.summary.trim(),
    facts: normalizeStringList(parsed.data.facts),
    constraints: normalizeStringList(parsed.data.constraints),
    relations: normalizeRelations(parsed.data.relations),
    extra: normalizeExtraRecord(parsed.data.extra),
  };
}

function normalizeCandidate(raw: unknown): WorldbookEntryCandidate | null {
  const parsed = WorldbuildingCandidateOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const normalizedName = parsed.data.name.trim();
  const normalizedContent = parsed.data.content.trim();

  if (!normalizedName && !normalizedContent) {
    return null;
  }

  return {
    id: '',
    category: parsed.data.category.trim() || '设定',
    name: normalizedName,
    keywords: normalizeStringList(parsed.data.keywords),
    content: normalizedContent,
    strategy: parsed.data.strategy,
    checked: true,
  };
}

function pushUniqueJsonCandidate(candidates: string[], candidate: string): void {
  const normalized = candidate.trim().replace(/^\uFEFF/, '');
  if (!normalized) {
    return;
  }

  if (candidates.includes(normalized)) {
    return;
  }

  candidates.push(normalized);
}

function extractBalancedJsonSegments(text: string, openChar: '{' | '[', closeChar: '}' | ']'): string[] {
  const segments: string[] = [];

  let depth = 0;
  let segmentStart = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) {
      if (depth === 0) {
        segmentStart = index;
      }
      depth += 1;
      continue;
    }

    if (char === closeChar && depth > 0) {
      depth -= 1;
      if (depth === 0 && segmentStart >= 0) {
        segments.push(text.slice(segmentStart, index + 1));
        segmentStart = -1;
      }
    }
  }

  return segments;
}

function escapeUnescapedControlCharsInJsonStrings(text: string): string {
  let normalized = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        normalized += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        normalized += char;
        escaped = true;
        continue;
      }

      if (char === '"') {
        normalized += char;
        inString = false;
        continue;
      }

      if (char === '\n') {
        normalized += '\\n';
        continue;
      }

      if (char === '\r') {
        normalized += '\\r';
        continue;
      }

      if (char === '\t') {
        normalized += '\\t';
        continue;
      }

      normalized += char;
      continue;
    }

    if (char === '"') {
      inString = true;
    }

    normalized += char;
  }

  return normalized;
}

function tryParseJsonCandidate(candidate: string): unknown | null {
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const escapedControlChars = escapeUnescapedControlCharsInJsonStrings(candidate);
    const withoutTrailingCommas = escapedControlChars.replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(withoutTrailingCommas) as unknown;
    } catch {
      return null;
    }
  }
}

function extractJsonPayload(responseText: string): unknown | null {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return null;
  }

  const candidates: string[] = [];
  pushUniqueJsonCandidate(candidates, trimmed);

  const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of fencedMatches) {
    if (match[1]) {
      pushUniqueJsonCandidate(candidates, match[1]);
    }
  }

  extractBalancedJsonSegments(trimmed, '{', '}').forEach(candidate => pushUniqueJsonCandidate(candidates, candidate));
  extractBalancedJsonSegments(trimmed, '[', ']').forEach(candidate => pushUniqueJsonCandidate(candidates, candidate));

  for (const candidate of candidates) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
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

  return '已完成本轮设定协作。';
}

function extractDraftPayload(payload: unknown): unknown | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (isRecord(payload.draft)) {
    return payload.draft;
  }

  if (isRecord(payload.worldbuildingDraft)) {
    return payload.worldbuildingDraft;
  }

  if (isRecord(payload.resultDraft)) {
    return payload.resultDraft;
  }

  const draftFieldKeys = ['name', 'aliases', 'summary', 'facts', 'constraints', 'relations', 'extra'];
  const looksLikeDraft = draftFieldKeys.some(key => key in payload);
  if (looksLikeDraft) {
    return payload;
  }

  return null;
}

function extractCandidateItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidateKeys = ['candidates', 'entries', 'worldbookCandidates', 'worldbookEntries'];
  for (const key of candidateKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  if (isRecord(payload.candidate)) {
    return [payload.candidate];
  }

  return [];
}

function extractConsistencyIssues(payload: unknown): string[] {
  if (!isRecord(payload)) {
    return [];
  }

  const source = payload.consistencyIssues ?? payload.issues ?? payload.warnings;
  return normalizeStringList(source);
}

function stringifyRecentMessages(messages: WorldbuildingMessage[]): string {
  if (messages.length === 0) {
    return '（暂无历史消息）';
  }

  return messages
    .map(message => {
      const role = message.role === 'assistant' ? '助手' : message.role === 'system' ? '系统' : '用户';
      return `[${role}] ${message.text}`;
    })
    .join('\n');
}

function stringifyEnvironmentHints(environment: WorldbuildingEnvironmentHints | undefined): string {
  if (!environment) {
    return '（未提供环境提示）';
  }

  const sections: string[] = [];

  const presetName = environment.loadedPresetName?.trim();
  sections.push(`- 当前预设：${presetName || '未知'}`);

  const activePromptCount =
    typeof environment.activePromptCount === 'number' && Number.isFinite(environment.activePromptCount)
      ? Math.max(0, Math.trunc(environment.activePromptCount))
      : null;
  if (activePromptCount !== null) {
    sections.push(`- in_use 已启用提示词条目：${activePromptCount}`);
  }

  const characterName = environment.currentCharacterName?.trim();
  sections.push(`- 当前角色卡：${characterName || '未绑定'}`);

  return sections.join('\n');
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

function getTypeLabel(type: WorldbuildingType): string {
  switch (type) {
    case 'character':
      return '角色';
    case 'faction':
      return '势力组织';
    case 'location':
      return '地点';
    case 'system':
      return '规则体系';
    case 'history_placeholder':
      return '历史事件（占位）';
    case 'item_placeholder':
      return '物品技术（占位）';
    case 'culture_placeholder':
      return '文化习俗（占位）';
    case 'custom_placeholder':
      return '自定义扩展（占位）';
    default:
      return '设定';
  }
}

function buildCommonPromptSections(input: WorldbuildingAIRequestInput): string[] {
  const mentionWarnings = normalizeMentionPromptWarnings(input.mentionWarnings);
  const foundationSection = input.foundation ? buildFoundationWorldBriefSection(input.foundation) : '（当前故事基底为空）';

  return [
    `设定类型：${getTypeLabel(input.type)}`,
    `会话标题：${input.sessionTitle || '（未命名）'}`,
    `会话种子：${input.seed || '（无）'}`,
    `用户需求：${input.userInstruction || '（无）'}`,
    '',
    '环境提示（仅提醒，不强制覆盖用户需求）：',
    stringifyEnvironmentHints(input.environment),
    '',
    `锁定字段（必须保持与当前草案一致）：${input.lockedFields.length > 0 ? input.lockedFields.join('、') : '无'}`,
    '',
    '最近会话消息：',
    stringifyRecentMessages(input.recentMessages),
    '',
    '当前故事基底：',
    foundationSection,
    '',
    '当前结构化草案：',
    JSON.stringify(input.draft, null, 2),
    '',
    '引用上下文（来自@）：',
    renderOutlineMentionSnapshotsForPromptSection(input.mentionSnapshots ?? []),
    ...(mentionWarnings.length > 0
      ? ['', '引用上下文告警：', ...mentionWarnings.map(warning => `- ${warning}`)]
      : []),
  ];
}

function buildDraftPrompt(input: WorldbuildingAIRequestInput, intent: Exclude<WorldbuildingAIIntent, 'candidates'>): string {
  const taskDescription =
    intent === 'expand'
      ? '在保持核心设定方向的前提下，补齐缺失的细节并扩充内容。重点关注：别名、事实、关系、约束等字段中尚未充分展开的部分。'
      : intent === 'refine'
        ? '在不偏离用户目标的前提下，精修措辞、压缩冗余，使每个字段更简洁准确。'
        : '仔细审查草案中各字段之间是否存在矛盾或不一致，并给出修正后的统一草案。将发现的问题列入 consistencyIssues 数组。';

  return [
    '你是小说世界观设定助手。根据下面的上下文完成本轮任务。',
    `任务：${taskDescription}`,
    '',
    ...buildCommonPromptSections(input),
    '',
    '重要规则：',
    '- 锁定字段的内容必须与当前草案完全一致，不可修改、删除或改写。',
    '- 当前故事基底只代表这个故事真正需要的设定约束，不要把它扩写成完整世界百科。',
    '- 如果故事基底里的世界需求还很少，只补当前任务真正需要的设定，不要凭空铺开大世界。',
    '- draft 中的每个键（name, aliases, summary, facts, constraints, relations, extra）都必须出现，即使内容未变也要原样保留。',
    '',
    '输出格式：',
    '1. 先写 2-6 句自然语言，简要说明你本轮做了什么修改。',
    '2. 然后输出一个 ```json 代码块，包含以下结构：',
    '   - assistantReply：与上面自然语言内容相同的摘要（字符串）。',
    '   - draft：完整的结构化草案对象，包含全部 7 个键。',
    '   - consistencyIssues：你发现的一致性问题数组（没有问题则填空数组 []）。',
    '',
    'JSON 代码块示例：',
    '```json',
    '{',
    '  "assistantReply": "本轮我补全了角色成长线，并保持了锁定字段不变。",',
    '  "draft": {',
    '    "name": "林川",',
    '    "aliases": ["小川"],',
    '    "summary": "边境出身的侦察兵。",',
    '    "facts": ["擅长追踪与潜行"],',
    '    "constraints": ["不可使用魔法"],',
    '    "relations": [{ "target": "", "relation": "" }],',
    '    "extra": {}',
    '  },',
    '  "consistencyIssues": []',
    '}',
    '```',
    '',
    '注意：只输出上述自然语言 + 一个 JSON 代码块，不要输出其他代码块或结构化片段。',
  ].join('\n');
}

function buildCandidatePrompt(input: WorldbuildingAIRequestInput): string {
  return [
    '你是小说世界观设定助手。请把当前草案拆成可以写进世界书的独立条目。',
    '',
    ...buildCommonPromptSections(input),
    '',
    '拆解要求：',
    '1. 每个条目必须自包含——仅凭该条目的 content 就能理解其含义，不依赖其他条目。',
    '2. keywords 填写能触发该条目的关键词（如角色名、地名、术语等），通常 2-5 个。',
    '3. strategy 选择规则：',
    '   - "constant"：该条目应始终注入上下文（如核心世界规则、主角基础设定）。',
    '   - "selective"：该条目仅在关键词被提及时注入（如次要角色、特定地点）。',
    '4. category 填写条目类别（如 角色、地点、势力、规则、物品 等）。',
    '5. 如果故事基底里的世界需求还很少，只拆出当前故事已经需要的条目，不要凭空扩写世界百科。',
    '',
    '输出格式：',
    '1. 先写 1-3 句自然语言总结。',
    '2. 然后输出一个 ```json 代码块，包含以下结构：',
    '',
    'JSON 代码块示例：',
    '```json',
    '{',
    '  "assistantReply": "已将草案拆解为 3 个世界书条目。",',
    '  "candidates": [',
    '    {',
    '      "category": "角色",',
    '      "name": "林川",',
    '      "keywords": ["林川", "小川", "侦察兵"],',
    '      "content": "林川，边境出身的侦察兵，擅长追踪与潜行。性格谨慎但重义气。",',
    '      "strategy": "selective"',
    '    }',
    '  ]',
    '}',
    '```',
    '',
    '注意：只输出上述自然语言 + 一个 JSON 代码块，不要输出其他代码块或结构化片段。',
  ].join('\n');
}

async function requestWorldbuildingAIResponse(prompt: string, llm: WorldbuildingAIRuntimeOptions = {}): Promise<string> {
  return requestLLMText({
    ...llm,
    prompt,
    channel: 'worldbuilding',
  });
}

async function requestDraftByIntent(
  input: WorldbuildingAIRequestInput,
  intent: Exclude<WorldbuildingAIIntent, 'candidates'>,
  llm: WorldbuildingAIRuntimeOptions = {},
): Promise<WorldbuildingDraftAIResult> {
  const rawResponse = await requestWorldbuildingAIResponse(buildDraftPrompt(input, intent), llm);
  const payload = extractJsonPayload(rawResponse);
  const draftPayload = extractDraftPayload(payload);
  const draft = draftPayload ? normalizeDraft(draftPayload) : null;

  const parseError =
    draft !== null ? null : payload === null ? '结构化解析失败：未提取到 JSON 结果' : '结构化解析失败：JSON 中缺少有效 draft';

  return {
    assistantText: extractAssistantText(rawResponse, payload),
    rawResponse,
    payload,
    draft,
    parseError,
    consistencyIssues: extractConsistencyIssues(payload),
  };
}

export async function expandDraftByAI(
  input: WorldbuildingAIRequestInput,
  llm: WorldbuildingAIRuntimeOptions = {},
): Promise<WorldbuildingDraftAIResult> {
  return requestDraftByIntent(input, 'expand', llm);
}

export async function refineDraftByAI(
  input: WorldbuildingAIRequestInput,
  llm: WorldbuildingAIRuntimeOptions = {},
): Promise<WorldbuildingDraftAIResult> {
  return requestDraftByIntent(input, 'refine', llm);
}

export async function checkDraftConsistencyByAI(
  input: WorldbuildingAIRequestInput,
  llm: WorldbuildingAIRuntimeOptions = {},
): Promise<WorldbuildingDraftAIResult> {
  return requestDraftByIntent(input, 'consistency', llm);
}

export async function generateCandidatesByAI(
  input: WorldbuildingAIRequestInput,
  llm: WorldbuildingAIRuntimeOptions = {},
): Promise<WorldbuildingCandidateAIResult> {
  const rawResponse = await requestWorldbuildingAIResponse(buildCandidatePrompt(input), llm);
  const payload = extractJsonPayload(rawResponse);
  const candidates = extractCandidateItems(payload)
    .map(item => normalizeCandidate(item))
    .filter((candidate): candidate is WorldbookEntryCandidate => candidate !== null);

  const parseError =
    candidates.length > 0
      ? null
      : payload === null
        ? '结构化解析失败：未提取到 JSON 结果'
        : '结构化解析失败：JSON 中未提取到有效 candidates';

  return {
    assistantText: extractAssistantText(rawResponse, payload),
    rawResponse,
    payload,
    candidates,
    parseError,
  };
}
