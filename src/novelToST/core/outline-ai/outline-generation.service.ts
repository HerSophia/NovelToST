import type { StoryFoundation } from '../../types/foundation';
import type {
  ChapterDetail,
  MasterOutlineNode,
  OutlineAIConfig,
} from '../../types/outline';
import { buildFoundationPromptSection } from '../foundation-prompt.service';
import {
  requestLLMText,
  type LLMRuntimeOptions,
} from '../llm-api.service';
import { normalizeChapterDetailsFromPayload } from './detail-commands';
import { extractJsonPayload } from './json-payload';
import { parseOutlineWorkshopPayload } from './payload-parser';

type RequestOutlineAIOptions = {
  prompt: string;
  systemPrompt?: string;
  aiConfig: OutlineAIConfig;
  llm?: LLMRuntimeOptions;
};

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
      turningPoints: node.turningPoints,
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

function resolveParentNodeIdByChapter(nodes: MasterOutlineNode[], chapter: number): string {
  const target = nodes.find(node => chapter >= node.chapterStart && chapter <= node.chapterEnd);
  return target?.id ?? '';
}

export async function requestOutlineAIResponse(options: RequestOutlineAIOptions): Promise<string> {
  if (!options.aiConfig.enabled) {
    throw new Error('Outline AI 功能未启用');
  }

  const llmOptions = options.llm ?? {};

  return requestLLMText({
    ...llmOptions,
    prompt: options.prompt,
    systemPrompt: options.systemPrompt ?? llmOptions.systemPrompt,
    channel: 'outline',
    provider: options.aiConfig.provider,
    model: options.aiConfig.model,
    temperature: options.aiConfig.temperature,
    customProviderFallbackWarning:
      llmOptions.customProviderFallbackWarning ??
      '[novelToST][outline-ai] provider=custom 缺少 custom_api 配置，当前回退 Tavern 预设通道',
  });
}

export async function generateMasterOutlineByAI(input: {
  foundation: StoryFoundation;
  chapterCount: number;
  aiConfig: OutlineAIConfig;
  llm?: LLMRuntimeOptions;
}): Promise<MasterOutlineNode[]> {
  const chapterCount = Math.max(1, Math.trunc(input.chapterCount));

  const prompt = [
    '你是小说策划助手。请根据故事基底，生成大纲骨架。',
    `目标章节数：${chapterCount}`,
    '输出要求：',
    '1. 重点输出 storylines + nodes（或 masterOutline）。',
    '2. 每个 node 建议包含 phase、events、timeStart、timeEnd、keywords、characters、locations。',
    '3. 细纲可以留空，不要强制每章都写细纲。',
    '4. chapterStart 和 chapterEnd 必须在 1 到目标章节数之间。',
    '5. 先抓住主角、对手、冲突和失败代价，再安排节点推进。',
    '6. 世界需求只当成故事运行条件，不要扩写成百科式设定说明。',
    '请仅返回 JSON，不要附加解释。',
    'JSON 示例：',
    '{',
    '  "storylines": [',
    '    {',
    '      "id": "line-main",',
    '      "type": "main",',
    '      "title": "主线",',
    '      "description": "主角寻找真相",',
    '      "status": "draft"',
    '    }',
    '  ],',
    '  "nodes": [',
    '    {',
    '      "id": "node-1",',
    '      "storylineId": "line-main",',
    '      "title": "迷航开局",',
    '      "summary": "主角接管残舰并发现异常信号",',
    '      "chapterStart": 1,',
    '      "chapterEnd": 4,',
    '      "phase": "setup",',
    '      "events": [{ "tag": "turning_point", "label": "", "description": "被迫接管舰桥" }],',
    '      "timeStart": { "label": "T+0", "sortKey": 0, "note": "" },',
    '      "timeEnd": { "label": "T+3", "sortKey": 3, "note": "" },',
    '      "keywords": ["失忆", "残舰"],',
    '      "characters": ["黎曜"],',
    '      "locations": ["灰港"],',
    '      "status": "draft"',
    '    }',
    '  ]',
    '}',
    '',
    '故事基底：',
    buildFoundationPromptSection(input.foundation),
  ].join('\n');

  const response = await requestOutlineAIResponse({
    prompt,
    aiConfig: input.aiConfig,
    llm: input.llm,
  });

  const payload = extractJsonPayload(response);
  const parsed = parseOutlineWorkshopPayload(payload, { chapterCount });
  const nodes = parsed.masterOutline ?? [];

  if (nodes.length === 0) {
    throw new Error('AI 总纲解析失败：未提取到有效节点');
  }

  return nodes;
}

export async function deriveChapterDetailsByAI(input: {
  foundation: StoryFoundation;
  masterOutline: MasterOutlineNode[];
  chapterCount: number;
  aiConfig: OutlineAIConfig;
  llm?: LLMRuntimeOptions;
}): Promise<ChapterDetail[]> {
  if (input.masterOutline.length === 0) {
    throw new Error('请先提供总纲后再派生细纲');
  }

  const chapterCount = Math.max(1, Math.trunc(input.chapterCount));

  const prompt = [
    '你是小说策划助手。请根据总纲，输出可以直接用来写正文的章节细纲。',
    '',
    '故事基底：',
    buildFoundationPromptSection(input.foundation),
    '',
    '总纲：',
    stringifyMasterOutlineForPrompt(input.masterOutline),
    '',
    `目标章节范围：第 1 章到第 ${chapterCount} 章（可按需输出关键章节，不要求全量覆盖）`,
    '',
    '要求：',
    '1. 只输出你认为当前最需要推进的章节细纲，可少于总章节数。',
    '2. 若输出某章，parentNodeId 必须填写该章所属总纲节点 id。',
    '3. goal 写本章要推进的核心叙事目标（1-2 句话）。',
    '4. conflict 写本章的主要矛盾或张力来源。',
    '5. beats 写 2-5 个按时间顺序排列的关键剧情节拍，每个节拍用一句话概括具体事件。',
    '6. mustInclude 列出本章必须出现的人物、道具或设定元素；mustAvoid 列出应回避的内容（可为空数组）。',
    '7. 所有 status 设为 "draft"。',
    '8. 细纲优先体现主角目标、对手阻力和失败代价，不要把设定说明写成大段介绍。',
    '',
    '请仅返回以下格式的 JSON，不要附加任何解释文字：',
    '{',
    '  "details": [',
    '    {',
    '      "chapter": 1,',
    '      "parentNodeId": "node-1",',
    '      "title": "本章标题",',
    '      "goal": "本章叙事目标",',
    '      "conflict": "本章核心冲突",',
    '      "beats": ["节拍1：具体事件", "节拍2：具体事件"],',
    '      "mustInclude": ["必须出现的元素"],',
    '      "mustAvoid": ["应回避的内容"],',
    '      "status": "draft"',
    '    }',
    '  ]',
    '}',
  ].join('\n');

  const response = await requestOutlineAIResponse({
    prompt,
    aiConfig: input.aiConfig,
    llm: input.llm,
  });

  const payload = extractJsonPayload(response);
  const parsed = normalizeChapterDetailsFromPayload(payload, { allowRootArray: true });
  const details = parsed.details
    .filter(detail => detail.chapter <= chapterCount)
    .map(detail => ({
      ...detail,
      parentNodeId: detail.parentNodeId || resolveParentNodeIdByChapter(input.masterOutline, detail.chapter),
    }));

  if (details.length === 0) {
    throw new Error('AI 细纲解析失败：未提取到有效章节细纲');
  }

  return details;
}

export async function rewriteChapterDetailByAI(input: {
  foundation: StoryFoundation;
  masterOutline: MasterOutlineNode[];
  chapter: number;
  currentDetail: ChapterDetail | null;
  aiConfig: OutlineAIConfig;
  llm?: LLMRuntimeOptions;
}): Promise<ChapterDetail> {
  const targetChapter = Math.max(1, Math.trunc(input.chapter));

  const prompt = [
    '你是小说策划助手。请在总纲框架内重写指定章节的细纲，改进不足之处。',
    '',
    '故事基底：',
    buildFoundationPromptSection(input.foundation),
    '',
    '总纲：',
    stringifyMasterOutlineForPrompt(input.masterOutline),
    '',
    '当前细纲（如果为空则表示需要从零创建）：',
    JSON.stringify(input.currentDetail ?? { chapter: targetChapter }, null, 2),
    '',
    `目标章节：第 ${targetChapter} 章`,
    '',
    '要求：',
    `1. 只输出第 ${targetChapter} 章这一条细纲，不要输出其他章节。`,
    '2. parentNodeId 必须填写该章所属总纲节点的 id。',
    '3. 在当前细纲基础上改进，保留合理部分，补充或修正不足之处。',
    '4. beats 写 2-5 个按时间顺序排列的关键剧情节拍，每个用一句话概括具体事件。',
    '5. 确保与前后章节的剧情衔接合理，不要引入与总纲矛盾的设定。',
    '6. status 设为 "draft"。',
    '7. 优先改进主角目标、对手阻力和失败代价的落地方式，不要把世界设定写成说明文。',
    '',
    '请仅返回以下格式的 JSON，不要附加任何解释文字：',
    '{',
    '  "detail": {',
    `    "chapter": ${targetChapter},`,
    '    "parentNodeId": "对应总纲节点id",',
    '    "title": "本章标题",',
    '    "goal": "本章叙事目标",',
    '    "conflict": "本章核心冲突",',
    '    "beats": ["节拍1：具体事件", "节拍2：具体事件"],',
    '    "mustInclude": ["必须出现的元素"],',
    '    "mustAvoid": ["应回避的内容"],',
    '    "status": "draft"',
    '  }',
    '}',
  ].join('\n');

  const response = await requestOutlineAIResponse({
    prompt,
    aiConfig: input.aiConfig,
    llm: input.llm,
  });

  const payload = extractJsonPayload(response);
  const parsedDetails = normalizeChapterDetailsFromPayload(payload, { allowRootArray: true }).details;
  const firstDetail = parsedDetails[0];

  if (!firstDetail) {
    throw new Error('AI 重写解析失败：未提取到有效章节细纲');
  }

  const parentNodeIdFromRange = resolveParentNodeIdByChapter(input.masterOutline, targetChapter);

  return {
    ...firstDetail,
    chapter: targetChapter,
    parentNodeId: firstDetail.parentNodeId || input.currentDetail?.parentNodeId || parentNodeIdFromRange,
  };
}
