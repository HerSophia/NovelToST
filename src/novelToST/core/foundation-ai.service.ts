import type {
  FoundationMessage,
  FoundationModuleId,
  FoundationModuleStatus,
  StoryFoundation,
} from '../types/foundation';
import { FOUNDATION_MODULE_IDS } from '../types/foundation';
import { computeModuleStatuses } from '../stores/foundation/foundation.normalize';
import { requestLLMText, type LLMRuntimeOptions } from './llm-api.service';
import {
  computeFoundationGenerationReadiness,
  FOUNDATION_MODULE_LABELS,
  type FoundationModuleKey,
  type FoundationReadinessItem,
} from './foundation-tier';

export type FoundationAIRequestInput = {
  foundation: StoryFoundation;
  recentMessages: FoundationMessage[];
  userInstruction: string;
  targetModule?: FoundationModuleId | null;
};

export type FoundationAIRuntimeOptions = LLMRuntimeOptions;

export type FoundationAIPrompt = {
  systemPrompt: string;
  userPrompt: string;
};

export type FoundationAIResult = {
  assistantText: string;
  rawResponse: string;
  payload: unknown | null;
  parseError: string | null;
  parseWarnings: string[];
  foundationPatch: Partial<StoryFoundation> | null;
};

type NormalizedStringList = {
  items: string[];
  truncated: boolean;
};

const FOUNDATION_FALLBACK_REPLY = '已完成本轮故事基底协作。';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function compactValueForPrompt(value: unknown): unknown | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === 'boolean') {
    return value ? true : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map(item => compactValueForPrompt(item))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return normalized.length > 0 ? normalized : null;
  }

  if (isRecord(value)) {
    const normalizedEntries = Object.entries(value)
      .map(([key, fieldValue]) => [key.trim(), compactValueForPrompt(fieldValue)] as const)
      .filter(([key, fieldValue]) => key.length > 0 && fieldValue !== null);

    if (normalizedEntries.length === 0) {
      return null;
    }

    return Object.fromEntries(normalizedEntries);
  }

  return null;
}

function stringifyRecentMessages(messages: FoundationMessage[]): string {
  const recentMessages = messages.slice(-12);
  if (recentMessages.length === 0) {
    return '（暂无历史消息）';
  }

  return recentMessages
    .map(message => {
      const role = message.role === 'assistant' ? '助手' : message.role === 'system' ? '系统' : '用户';
      return `[${role}] ${message.text}`;
    })
    .join('\n');
}

function stringifyModuleStatuses(statuses: Record<FoundationModuleId, FoundationModuleStatus>): string {
  return FOUNDATION_MODULE_IDS.map(moduleId => {
    const label = FOUNDATION_MODULE_LABELS[moduleId];
    const statusCN = statuses[moduleId] === 'complete' ? '已完成' : statuses[moduleId] === 'partial' ? '部分完成' : '未填写';
    return `- ${label}（${moduleId}）：${statusCN}`;
  }).join('\n');
}

function resolveFoundationModuleLabel(moduleId: FoundationModuleKey): string {
  return moduleId === 'extensions' ? '扩展模块' : FOUNDATION_MODULE_LABELS[moduleId];
}

function stringifyReadinessItems(items: FoundationReadinessItem[]): string {
  if (items.length === 0) {
    return '（无）';
  }

  return items.map(item => `- ${item.label}（${resolveFoundationModuleLabel(item.moduleId)}）`).join('\n');
}

function stringifyCollaborationStage(foundation: StoryFoundation): string {
  const readiness = computeFoundationGenerationReadiness(foundation);

  if (!readiness.canGenerate) {
    return `当前仍处于起步阶段：起步必填已完成 ${readiness.minimumSatisfiedCount}/${readiness.minimumTotalCount}，应先补最基本的开始条件。`;
  }

  if (readiness.shouldRemind) {
    return '当前已经可以开始生成，但若继续补对手、冲突和世界需求，后续结果通常会更稳。';
  }

  return '当前起步内容和主要补强项都已有基础，可按用户要求继续打磨或做一致性检查。';
}

function stringifyFoundationSummary(foundation: StoryFoundation): string {
  const sections = FOUNDATION_MODULE_IDS.map(moduleId => {
    const compacted = compactValueForPrompt(foundation[moduleId]);
    const moduleBody = compacted === null ? '（未填写）' : JSON.stringify(compacted, null, 2);

    return [`【${FOUNDATION_MODULE_LABELS[moduleId]} | ${moduleId}】`, moduleBody].join('\n');
  });

  const extensionSummary =
    foundation.extensions.length > 0
      ? JSON.stringify(
          foundation.extensions.map(extension => ({
            id: extension.id,
            title: extension.title,
            fields: compactValueForPrompt(extension.fields) ?? {},
          })),
          null,
          2,
        )
      : '（无扩展模块）';

  return [...sections, '【扩展模块 | extensions】', extensionSummary].join('\n\n');
}

export function buildFoundationPrompt(input: FoundationAIRequestInput): FoundationAIPrompt {
  const normalizedInstruction = input.userInstruction.trim();
  const targetModule = input.targetModule ?? null;
  const moduleStatuses = computeModuleStatuses(input.foundation);
  const readiness = computeFoundationGenerationReadiness(input.foundation);

  const targetModuleInstruction = targetModule
    ? `- foundationPatch 顶层只允许包含 "${targetModule}"，并且只返回该模块里本轮真正要改的字段。`
    : '- foundationPatch 只返回本轮真正要写回表单的字段。默认只更新 1-2 个顶层模块；只有用户明确要求大改时才可更多。';

  const systemPrompt = [
    '你是一位小说策划编辑，正在帮用户补故事基底。',
    '故事基底包含八个模块：作品定位、故事核心、主角档案、关键关系、冲突结构、世界需求、叙事规则、终局方向。',
    targetModule
      ? `本轮只处理「${FOUNDATION_MODULE_LABELS[targetModule]}」（${targetModule}）。可以参考其他模块，但不得修改其他模块。`
      : '本轮未限定模块。若用户没有明确要求大改，请按“起步必填 → 建议补充 → 精细控制”的顺序处理。',
    '',
    '你必须先按下面顺序判断：',
    targetModule
      ? '1. 先检查当前模块里哪些字段是空白、过泛或与其他模块冲突。'
      : '1. 先看起步必填是否还有明显缺口；若有，优先补题材、一句话故事和主角的基本信息。',
    targetModule
      ? '2. 优先补空白字段，再打磨已经模糊的字段。'
      : '2. 起步必填基本够用后，再补关键关系、冲突结构、世界需求这些建议补充。',
    targetModule
      ? '3. 如果当前模块与其他模块有冲突，要在说明里指出，但 foundationPatch 仍然只能修改当前模块。'
      : '3. 用户没有明确要求时，不要主动大改叙事规则、终局方向等精细控制内容。',
    '4. 默认一轮只改当前最需要的少数字段，不要一次铺满很多模块。',
    '',
    '输出格式（必须遵守）：',
    '1. 先写 2-4 句自然语言，说明本轮补了什么、为什么这样补、是否发现冲突。',
    '2. 然后输出且仅输出一个 ```json 代码块。',
    '3. JSON 顶层只能包含 assistantReply（string）和 foundationPatch（object）两个字段。',
    '4. assistantReply 必须与上面的自然语言说明保持同一结论，不要写两套不同说法。',
    '5. foundationPatch 使用 partial deep merge 语义：只返回本轮要写回的字段，不要重复返回未变化内容。',
    targetModuleInstruction,
    '',
    '内容要求（必须遵守）：',
    '- 每个字段的值都要能直接写进表单，不要写“建议补充”“可以展开”这一类空话。',
    '- 一句话故事最多两句，尽量写清主角是谁、想做什么、最大的阻碍是什么。',
    '- 主角相关字段不要写成形容词列表，要写成会影响行动的具体内容。',
    '- 目标体验（targetExperience）、主题关键词（themeKeywords）、内容强度（contentIntensity）各最多 3 项，按优先级排序。',
    '- 世界需求只写故事离不开的规则和场景，不要展开成完整世界百科。',
    '- 不要把空白字段写成“待定”“暂无”“后续再补”这类占位内容。',
    '- 信息不够时可以少填，不要为了显得完整而硬凑。',
    '- 如果发现现有内容互相冲突，要先指出冲突，再给出协调后的 patch。',
    '- 不得返回 extensions，不得输出第二个 JSON、表格、伪代码或额外结构片段。',
    '',
    '一致性检查重点：',
    '- 主角目标是否真的对应主冲突。',
    '- 一句话故事和终局方向是否打架。',
    '- 主角缺点和人物变化方向是否接得上。',
    '- 主要对手的目标是否足以威胁主角。',
    '- 世界规则是否真的支撑冲突，而不是摆设。',
    '',
    'JSON 示例',
    '```json',
    '{',
    '  "assistantReply": "本轮我补了主角的行为风格和人物变化方向，并同步让失败代价更贴合主角目标。",',
    '  "foundationPatch": {',
    '    "protagonist": {',
    '      "behaviorStyle": "谨慎型，习惯先收集所有信息再行动，压力下容易陷入分析瘫痪",',
    '      "arcDirection": "从过度防御到学会在信息不完整时果断行动"',
    '    },',
    '    "conflictFramework": {',
    '      "failureCost": "如果继续犹豫，妹妹会在72小时后被转移到无法追踪的地点"',
    '    }',
    '  }',
    '}',
    '```',
  ].join('\n');

  const userPrompt = [
    '当前协作阶段：',
    stringifyCollaborationStage(input.foundation),
    '',
    '模块完成状态：',
    stringifyModuleStatuses(moduleStatuses),
    '',
    '起步必填缺口：',
    stringifyReadinessItems(readiness.blockingItems),
    '',
    '建议补充缺口：',
    stringifyReadinessItems(readiness.recommendedItems),
    '',
    '当前故事基底摘要：',
    stringifyFoundationSummary(input.foundation),
    '',
    '最近消息：',
    stringifyRecentMessages(input.recentMessages),
    '',
    `目标模块：${targetModule ? `${FOUNDATION_MODULE_LABELS[targetModule]}（${targetModule}）` : '未限定，请优先处理最影响继续写下去的内容'}`,
    '用户本轮指令：',
    normalizedInstruction,
  ].join('\n');

  return {
    systemPrompt,
    userPrompt,
  };
}

export async function requestFoundationAIResponse(
  prompt: FoundationAIPrompt,
  llm: FoundationAIRuntimeOptions = {},
): Promise<string> {
  return requestLLMText({
    ...llm,
    prompt: prompt.userPrompt,
    systemPrompt: prompt.systemPrompt,
    channel: 'foundation',
    customProviderFallbackWarning:
      llm.customProviderFallbackWarning ??
      '[novelToST][foundation-ai] provider=custom 缺少 custom_api 配置，当前回退 Tavern 预设通道',
  });
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

  return FOUNDATION_FALLBACK_REPLY;
}

function extractFoundationPatch(payload: unknown): { rawPatch: unknown | null; warnings: string[] } {
  const warnings: string[] = [];

  if (!isRecord(payload)) {
    return {
      rawPatch: null,
      warnings,
    };
  }

  if (isRecord(payload.foundationPatch)) {
    return {
      rawPatch: payload.foundationPatch,
      warnings,
    };
  }

  if (isRecord(payload.patch)) {
    warnings.push('检测到 patch 字段，已按 foundationPatch 兼容解析。');
    return {
      rawPatch: payload.patch,
      warnings,
    };
  }

  const hasRootModuleFields = FOUNDATION_MODULE_IDS.some(moduleId => moduleId in payload);
  if (hasRootModuleFields) {
    warnings.push('检测到根级模块字段，已按 foundationPatch 兼容解析。');
    return {
      rawPatch: payload,
      warnings,
    };
  }

  return {
    rawPatch: null,
    warnings,
  };
}

function normalizeStringList(rawValue: unknown, maxCount?: number): NormalizedStringList | null {
  let source: string[] | null = null;

  if (Array.isArray(rawValue)) {
    source = rawValue
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(item => item.length > 0);
  } else if (typeof rawValue === 'string') {
    source = rawValue
      .split(/\r?\n|[，,；;]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  } else if (rawValue === null) {
    source = [];
  }

  if (source === null) {
    return null;
  }

  const deduped = [...new Set(source)];

  if (typeof maxCount !== 'number') {
    return {
      items: deduped,
      truncated: false,
    };
  }

  const safeMax = Math.max(0, Math.trunc(maxCount));
  return {
    items: deduped.slice(0, safeMax),
    truncated: deduped.length > safeMax,
  };
}

function normalizeBoolean(rawValue: unknown): boolean | null {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    if (rawValue === 1) {
      return true;
    }
    if (rawValue === 0) {
      return false;
    }
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', '是', '开启'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', '否', '关闭'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function assignStringField(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  field: string,
  fieldPath: string,
  warnings: string[],
): boolean {
  if (!(field in source)) {
    return false;
  }

  const rawValue = source[field];
  if (typeof rawValue === 'string' || rawValue === null) {
    target[field] = normalizeString(rawValue);
    return true;
  }

  warnings.push(`${fieldPath} 字段类型无效，已忽略该字段。`);
  return false;
}

function assignStringListField(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  field: string,
  fieldPath: string,
  warnings: string[],
  maxCount?: number,
): boolean {
  if (!(field in source)) {
    return false;
  }

  const normalized = normalizeStringList(source[field], maxCount);
  if (normalized === null) {
    warnings.push(`${fieldPath} 字段类型无效，已忽略该字段。`);
    return false;
  }

  target[field] = normalized.items;

  if (normalized.truncated && typeof maxCount === 'number') {
    warnings.push(`${fieldPath} 最多允许 ${Math.max(0, Math.trunc(maxCount))} 项，已自动截断。`);
  }

  return true;
}

function assignBooleanField(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  field: string,
  fieldPath: string,
  warnings: string[],
): boolean {
  if (!(field in source)) {
    return false;
  }

  const normalized = normalizeBoolean(source[field]);
  if (normalized === null) {
    warnings.push(`${fieldPath} 字段类型无效，已忽略该字段。`);
    return false;
  }

  target[field] = normalized;
  return true;
}

function normalizePositioningPatch(raw: unknown, warnings: string[]): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  let hasField = false;

  hasField = assignStringField(raw, patch, 'title', 'positioning.title', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'genre', 'positioning.genre', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'mainType', 'positioning.mainType', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'subType', 'positioning.subType', warnings) || hasField;
  hasField = assignStringListField(raw, patch, 'targetExperience', 'positioning.targetExperience', warnings, 3) || hasField;
  hasField = assignStringField(raw, patch, 'length', 'positioning.length', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'audience', 'positioning.audience', warnings) || hasField;
  hasField = assignStringListField(raw, patch, 'contentIntensity', 'positioning.contentIntensity', warnings, 3) || hasField;

  return hasField ? patch : null;
}

function normalizeCorePatch(raw: unknown, warnings: string[]): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  let hasField = false;

  hasField = assignStringField(raw, patch, 'logline', 'core.logline', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'coreConflict', 'core.coreConflict', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'coreSuspense', 'core.coreSuspense', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'coreSellPoint', 'core.coreSellPoint', warnings) || hasField;
  hasField = assignStringListField(raw, patch, 'themeKeywords', 'core.themeKeywords', warnings, 3) || hasField;
  hasField = assignStringField(raw, patch, 'emotionalTone', 'core.emotionalTone', warnings) || hasField;

  return hasField ? patch : null;
}

function normalizeProtagonistPatch(raw: unknown, warnings: string[]): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  let hasField = false;

  hasField = assignStringField(raw, patch, 'name', 'protagonist.name', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'identity', 'protagonist.identity', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'visibleGoal', 'protagonist.visibleGoal', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'deepNeed', 'protagonist.deepNeed', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'coreDesire', 'protagonist.coreDesire', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'coreFear', 'protagonist.coreFear', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'coreFlaw', 'protagonist.coreFlaw', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'behaviorStyle', 'protagonist.behaviorStyle', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'moralLeaning', 'protagonist.moralLeaning', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'mostCaredAbout', 'protagonist.mostCaredAbout', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'bottomLine', 'protagonist.bottomLine', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'temptation', 'protagonist.temptation', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'arcDirection', 'protagonist.arcDirection', warnings) || hasField;

  return hasField ? patch : null;
}

function normalizeKeyCharacterPatchItem(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const patch: Record<string, unknown> = {};

  if (typeof raw.id === 'string') {
    const normalizedId = raw.id.trim();
    if (normalizedId) {
      patch.id = normalizedId;
    }
  }

  if (typeof raw.name === 'string' || raw.name === null) {
    patch.name = normalizeString(raw.name);
  }

  if (typeof raw.role === 'string' || raw.role === null) {
    patch.role = normalizeString(raw.role);
  }

  if (typeof raw.relationArc === 'string' || raw.relationArc === null) {
    patch.relationArc = normalizeString(raw.relationArc);
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function normalizeKeyRelationsPatch(raw: unknown, warnings: string[]): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  let hasField = false;

  if ('antagonist' in raw) {
    const rawAntagonist = raw.antagonist;
    if (isRecord(rawAntagonist)) {
      const antagonistPatch: Record<string, unknown> = {};
      let hasAntagonistField = false;

      hasAntagonistField =
        assignStringField(rawAntagonist, antagonistPatch, 'name', 'keyRelations.antagonist.name', warnings) ||
        hasAntagonistField;
      hasAntagonistField =
        assignStringField(rawAntagonist, antagonistPatch, 'goal', 'keyRelations.antagonist.goal', warnings) ||
        hasAntagonistField;
      hasAntagonistField =
        assignStringField(rawAntagonist, antagonistPatch, 'conflict', 'keyRelations.antagonist.conflict', warnings) ||
        hasAntagonistField;

      if (hasAntagonistField) {
        patch.antagonist = antagonistPatch;
        hasField = true;
      }
    } else {
      warnings.push('keyRelations.antagonist 字段类型无效，已忽略该字段。');
    }
  }

  if ('keyCharacters' in raw) {
    const rawKeyCharacters = raw.keyCharacters;
    if (Array.isArray(rawKeyCharacters)) {
      const normalizedKeyCharacters = rawKeyCharacters
        .map(item => normalizeKeyCharacterPatchItem(item))
        .filter((item): item is Record<string, unknown> => item !== null);

      if (rawKeyCharacters.length === 0 || normalizedKeyCharacters.length > 0) {
        patch.keyCharacters = normalizedKeyCharacters;
        hasField = true;
      } else {
        warnings.push('keyRelations.keyCharacters 未提取到有效条目，已忽略该字段。');
      }
    } else if (rawKeyCharacters === null) {
      patch.keyCharacters = [];
      hasField = true;
    } else {
      warnings.push('keyRelations.keyCharacters 字段类型无效，已忽略该字段。');
    }
  }

  return hasField ? patch : null;
}

function normalizeConflictFrameworkPatch(raw: unknown, warnings: string[]): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  let hasField = false;

  hasField = assignStringField(raw, patch, 'mainConflict', 'conflictFramework.mainConflict', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'innerConflict', 'conflictFramework.innerConflict', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'relationConflict', 'conflictFramework.relationConflict', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'externalObstacle', 'conflictFramework.externalObstacle', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'failureCost', 'conflictFramework.failureCost', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'timePressure', 'conflictFramework.timePressure', warnings) || hasField;
  hasField =
    assignStringListField(raw, patch, 'irreversibleEvents', 'conflictFramework.irreversibleEvents', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'escalationPattern', 'conflictFramework.escalationPattern', warnings) || hasField;

  return hasField ? patch : null;
}

function normalizeNarrativeRulesPatch(raw: unknown, warnings: string[]): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  let hasField = false;

  hasField = assignStringField(raw, patch, 'pov', 'narrativeRules.pov', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'tenseAndStyle', 'narrativeRules.tenseAndStyle', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'languageQuality', 'narrativeRules.languageQuality', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'infoDisclosure', 'narrativeRules.infoDisclosure', warnings) || hasField;
  hasField = assignBooleanField(raw, patch, 'allowExposition', 'narrativeRules.allowExposition', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'plotDriver', 'narrativeRules.plotDriver', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'romanceWeight', 'narrativeRules.romanceWeight', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'ensembleWeight', 'narrativeRules.ensembleWeight', warnings) || hasField;
  hasField = assignStringListField(raw, patch, 'emphasisTags', 'narrativeRules.emphasisTags', warnings) || hasField;
  hasField =
    assignStringListField(raw, patch, 'forbiddenPatterns', 'narrativeRules.forbiddenPatterns', warnings) || hasField;

  return hasField ? patch : null;
}

function normalizeWorldBriefPatch(raw: unknown, warnings: string[]): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  let hasField = false;

  hasField = assignStringField(raw, patch, 'worldType', 'worldBrief.worldType', warnings) || hasField;
  hasField = assignStringListField(raw, patch, 'requiredRules', 'worldBrief.requiredRules', warnings) || hasField;
  hasField = assignStringListField(raw, patch, 'keyScenes', 'worldBrief.keyScenes', warnings) || hasField;
  hasField = assignStringListField(raw, patch, 'settingPivots', 'worldBrief.settingPivots', warnings) || hasField;
  hasField =
    assignStringListField(raw, patch, 'conflictGeneratingRules', 'worldBrief.conflictGeneratingRules', warnings) || hasField;
  hasField =
    assignStringListField(raw, patch, 'forbiddenSettings', 'worldBrief.forbiddenSettings', warnings) || hasField;

  return hasField ? patch : null;
}

function normalizeEndgamePatch(raw: unknown, warnings: string[]): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  let hasField = false;

  hasField = assignStringField(raw, patch, 'overallDirection', 'endgame.overallDirection', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'endingType', 'endgame.endingType', warnings) || hasField;
  hasField = assignBooleanField(raw, patch, 'protagonistChanges', 'endgame.protagonistChanges', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'rootProblem', 'endgame.rootProblem', warnings) || hasField;
  hasField = assignStringField(raw, patch, 'readerFeeling', 'endgame.readerFeeling', warnings) || hasField;
  hasField = assignStringListField(raw, patch, 'mustResolve', 'endgame.mustResolve', warnings) || hasField;

  return hasField ? patch : null;
}

function normalizeModulePatch(moduleId: FoundationModuleId, rawModulePatch: unknown, warnings: string[]): Record<string, unknown> | null {
  switch (moduleId) {
    case 'positioning':
      return normalizePositioningPatch(rawModulePatch, warnings);
    case 'core':
      return normalizeCorePatch(rawModulePatch, warnings);
    case 'protagonist':
      return normalizeProtagonistPatch(rawModulePatch, warnings);
    case 'keyRelations':
      return normalizeKeyRelationsPatch(rawModulePatch, warnings);
    case 'conflictFramework':
      return normalizeConflictFrameworkPatch(rawModulePatch, warnings);
    case 'narrativeRules':
      return normalizeNarrativeRulesPatch(rawModulePatch, warnings);
    case 'worldBrief':
      return normalizeWorldBriefPatch(rawModulePatch, warnings);
    case 'endgame':
      return normalizeEndgamePatch(rawModulePatch, warnings);
    default: {
      const exhaustive: never = moduleId;
      return exhaustive;
    }
  }
}

function dedupeWarnings(warnings: string[]): string[] {
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

function normalizeFoundationPatch(
  rawPatch: unknown,
  targetModule: FoundationModuleId | null,
): { patch: Partial<StoryFoundation> | null; warnings: string[] } {
  const warnings: string[] = [];

  if (!isRecord(rawPatch)) {
    return {
      patch: null,
      warnings,
    };
  }

  const patch: Record<string, unknown> = {};

  if ('extensions' in rawPatch) {
    warnings.push('extensions 不支持通过 foundationPatch 更新，已忽略该字段。');
  }

  FOUNDATION_MODULE_IDS.forEach(moduleId => {
    if (targetModule !== null && moduleId !== targetModule && moduleId in rawPatch) {
      warnings.push(`检测到目标模块外字段：${moduleId}，已忽略。`);
    }

    if (targetModule !== null && moduleId !== targetModule) {
      return;
    }

    if (!(moduleId in rawPatch)) {
      return;
    }

    const normalizedModulePatch = normalizeModulePatch(moduleId, rawPatch[moduleId], warnings);
    if (!normalizedModulePatch) {
      return;
    }

    patch[moduleId] = normalizedModulePatch;
  });

  return {
    patch: Object.keys(patch).length > 0 ? (patch as Partial<StoryFoundation>) : null,
    warnings: dedupeWarnings(warnings),
  };
}

export async function runFoundationCollaborationByAI(
  input: FoundationAIRequestInput,
  llm: FoundationAIRuntimeOptions = {},
): Promise<FoundationAIResult> {
  const userInstruction = input.userInstruction.trim();
  if (!userInstruction) {
    throw new Error('请输入本轮故事基底协作指令');
  }

  const targetModule = input.targetModule ?? null;

  const prompt = buildFoundationPrompt({
    ...input,
    userInstruction,
    targetModule,
  });
  const rawResponse = await requestFoundationAIResponse(prompt, llm);

  const payload = extractJsonPayload(rawResponse);
  const assistantText = extractAssistantText(rawResponse, payload);

  const extractedPatch = extractFoundationPatch(payload);
  const normalizedPatchResult = normalizeFoundationPatch(extractedPatch.rawPatch, targetModule);
  const parseWarnings = dedupeWarnings([...extractedPatch.warnings, ...normalizedPatchResult.warnings]);

  const parseError =
    payload === null
      ? '结构化解析失败：未提取到 JSON 结果'
      : extractedPatch.rawPatch === null
        ? '结构化解析失败：JSON 中缺少有效 foundationPatch'
        : normalizedPatchResult.patch === null
          ? '结构化解析失败：foundationPatch 为空或无有效字段'
          : null;

  return {
    assistantText,
    rawResponse,
    payload,
    parseError,
    parseWarnings,
    foundationPatch: normalizedPatchResult.patch,
  };
}
