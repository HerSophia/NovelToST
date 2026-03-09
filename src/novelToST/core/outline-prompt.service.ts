import { matchMasterOutlineNodeByChapter } from './outline-node-match';
import { buildFoundationSection } from './foundation-prompt.service';
import type { NovelSettings } from '../types';
import type { StoryFoundation } from '../types/foundation';
import type { ChapterDetail, MasterOutlineNode, OutlineState, Storyline } from '../types/outline';

export type ChapterPromptResolveWarning = {
  code: 'outline_missing_detail_fallback';
  chapter: number;
  message: string;
};

export type ChapterPromptResolveResult = {
  prompt: string;
  warning: ChapterPromptResolveWarning | null;
  usedOutline: boolean;
};

function normalizeChapter(chapter: number): number {
  return Math.max(1, Math.trunc(chapter));
}

function trimOrEmpty(value: string | undefined | null): string {
  return (value ?? '').trim();
}

/**
 * 仅当值非空时才返回一行 `- label：value`，否则返回 null（调用方可过滤）。
 */
function optionalLine(label: string, value: string | undefined | null): string | null {
  const trimmed = trimOrEmpty(value);
  return trimmed ? `- ${label}：${trimmed}` : null;
}

function formatList(values: string[] | undefined | null, fallback: string = '无'): string {
  const normalized = (values ?? []).map(v => v.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join('；') : fallback;
}

function formatListOrNull(values: string[] | undefined | null): string | null {
  const normalized = (values ?? []).map(v => v.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join('；') : null;
}

function compactLines(lines: (string | null | undefined)[]): string {
  return lines.filter((line): line is string => line != null && line.trim() !== '').join('\n');
}

function formatStorylineType(type: Storyline['type']): string {
  switch (type) {
    case 'main':
      return '主线';
    case 'subplot':
      return '支线';
    case 'parallel':
      return '并行线';
    default:
      return '叙事线';
  }
}

function hasMeaningfulDetail(detail: ChapterDetail | null): detail is ChapterDetail {
  if (!detail) {
    return false;
  }

  return Boolean(
    detail.title.trim() ||
      detail.goal.trim() ||
      detail.conflict.trim() ||
      detail.beats.some(item => item.trim()) ||
      detail.mustInclude.some(item => item.trim()) ||
      detail.mustAvoid.some(item => item.trim()) ||
      trimOrEmpty(detail.pov) ||
      trimOrEmpty(detail.emotionalArc) ||
      trimOrEmpty(detail.endHook) ||
      trimOrEmpty(detail.notes),
  );
}

function findMatchedMasterNode(
  chapter: number,
  detail: ChapterDetail,
  nodes: MasterOutlineNode[],
): MasterOutlineNode | null {
  const detailParentNodeId = detail.parentNodeId.trim();
  if (detailParentNodeId) {
    const byParentId = nodes.find(node => node.id === detailParentNodeId);
    if (byParentId) {
      return byParentId;
    }
  }

  return matchMasterOutlineNodeByChapter(chapter, nodes).node;
}

/**
 * 收集本章相关联的所有总纲节点（parentNodeId + relatedNodeIds）。
 */
function collectRelatedNodes(
  detail: ChapterDetail,
  nodes: MasterOutlineNode[],
): MasterOutlineNode[] {
  const relatedIds = (detail.relatedNodeIds ?? []).map(id => id.trim()).filter(Boolean);
  if (relatedIds.length === 0) {
    return [];
  }

  const parentId = detail.parentNodeId.trim();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const result: MasterOutlineNode[] = [];

  for (const id of relatedIds) {
    if (id === parentId) continue; // 主节点已单独展示
    const node = nodeMap.get(id);
    if (node) {
      result.push(node);
    }
  }

  return result;
}

function findStorylineById(
  storylineId: string | undefined,
  storylines: Storyline[] | undefined,
): Storyline | null {
  if (!storylineId || !storylines) return null;
  return storylines.find(s => s.id === storylineId) ?? null;
}

// ─── Section Builders ───────────────────────────────────────────────────────

function buildStorylineSection(storylines: Storyline[] | undefined): string | null {
  if (!storylines || storylines.length === 0) {
    return null;
  }

  const sorted = [...storylines]
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title, 'zh-Hans-CN');
    });

  const lines = sorted.map(s => {
    const desc = trimOrEmpty(s.description);
    const base = `- ${formatStorylineType(s.type)}「${trimOrEmpty(s.title) || '未命名'}」`;
    return desc ? `${base}：${desc}` : base;
  });

  return lines.join('\n');
}

function buildMasterNodeSection(
  node: MasterOutlineNode | null,
  storylines?: Storyline[],
): string {
  if (!node) {
    return '- （未匹配到对应总纲节点）';
  }

  const storyline = findStorylineById(node.storylineId, storylines);

  return compactLines([
    optionalLine('节点标题', node.title),
    `- 章节范围：第 ${node.chapterStart} - ${node.chapterEnd} 章`,
    optionalLine('节点摘要', node.summary),
    storyline ? `- 所属叙事线：${formatStorylineType(storyline.type)}「${trimOrEmpty(storyline.title)}」` : null,
    optionalLine('叙事阶段', node.phase && node.phase !== 'custom' ? formatPhase(node.phase) : null),
    formatListOrNull(node.turningPoints) ? `- 关键转折：${formatList(node.turningPoints)}` : null,
    formatListOrNull(node.keywords) ? `- 关键词：${formatList(node.keywords)}` : null,
    formatListOrNull(node.characters) ? `- 涉及角色：${formatList(node.characters)}` : null,
    formatListOrNull(node.locations) ? `- 涉及地点：${formatList(node.locations)}` : null,
    node.events && node.events.length > 0 ? `- 关键事件：${formatEvents(node.events)}` : null,
    optionalLine('节点备注', node.notes),
  ]);
}

function formatPhase(phase: string): string {
  switch (phase) {
    case 'setup': return '铺垫 / 开端';
    case 'confrontation': return '对抗 / 发展';
    case 'climax': return '高潮';
    case 'resolution': return '结局 / 收束';
    default: return phase;
  }
}

function formatEvents(events: { tag: string; label: string; description: string }[]): string {
  return events
    .map(e => {
      const label = trimOrEmpty(e.label);
      const desc = trimOrEmpty(e.description);
      if (label && desc) return `${label}（${desc}）`;
      return label || desc || '';
    })
    .filter(Boolean)
    .join('；') || '无';
}

function buildChapterDetailSection(detail: ChapterDetail): string {
  return compactLines([
    optionalLine('本章标题', detail.title),
    optionalLine('视角人物（POV）', detail.pov),
    optionalLine('本章目标', detail.goal),
    optionalLine('核心冲突', detail.conflict),
    optionalLine('情感弧线', detail.emotionalArc),
    detail.beats.filter(b => b.trim()).length > 0
      ? `- 剧情节拍：\n${detail.beats.filter(b => b.trim()).map((b, i) => `  ${i + 1}. ${b.trim()}`).join('\n')}`
      : null,
    formatListOrNull(detail.mustInclude) ? `- 必须包含：${formatList(detail.mustInclude)}` : null,
    formatListOrNull(detail.mustAvoid) ? `- 必须避免：${formatList(detail.mustAvoid)}` : null,
    optionalLine('章末钩子', detail.endHook),
    optionalLine('细纲备注', detail.notes),
  ]);
}

function buildRelatedNodesSection(
  relatedNodes: MasterOutlineNode[],
  storylines?: Storyline[],
): string | null {
  if (relatedNodes.length === 0) return null;

  const lines = relatedNodes.map(node => {
    const storyline = findStorylineById(node.storylineId, storylines);
    const parts: string[] = [`「${trimOrEmpty(node.title) || '未命名节点'}」`];
    if (storyline) parts.push(`（${formatStorylineType(storyline.type)}：${trimOrEmpty(storyline.title)}）`);
    if (trimOrEmpty(node.summary)) parts.push(`—— ${node.summary.trim()}`);
    return `- ${parts.join('')}`;
  });

  return lines.join('\n');
}

/**
 * 查找前一章和后一章的细纲摘要，用于衔接提示。
 */
function buildAdjacentChaptersHint(
  chapter: number,
  detailsByChapter: Record<number, ChapterDetail>,
): string | null {
  const hints: string[] = [];

  const prev = detailsByChapter[chapter - 1];
  if (prev && trimOrEmpty(prev.title)) {
    const parts = [`上一章（第${chapter - 1}章）「${prev.title.trim()}」`];
    if (trimOrEmpty(prev.endHook)) {
      parts.push(`，章末钩子：${prev.endHook!.trim()}`);
    } else if (trimOrEmpty(prev.goal)) {
      parts.push(`，目标：${prev.goal.trim()}`);
    }
    hints.push(`- ${parts.join('')}`);
  }

  const next = detailsByChapter[chapter + 1];
  if (next && trimOrEmpty(next.title)) {
    const parts = [`下一章（第${chapter + 1}章）「${next.title.trim()}」`];
    if (trimOrEmpty(next.goal)) {
      parts.push(`，目标：${next.goal.trim()}`);
    }
    hints.push(`- ${parts.join('')}`);
  }

  return hints.length > 0 ? hints.join('\n') : null;
}

// ─── Prompt Composers ───────────────────────────────────────────────────────

function composeMissingDetailFallbackPrompt(
  chapter: number,
  settingsPrompt: string,
  outlineState: OutlineState,
  foundation: StoryFoundation,
  matchedNode: MasterOutlineNode,
): string {
  const storylineSection = buildStorylineSection(outlineState.storylines);
  const adjacentHint = buildAdjacentChaptersHint(chapter, outlineState.detailsByChapter);

  return compactLines([
    `## 角色：章节续写助手`,
    '',
    '你正在续写一部长篇小说。以下是结构化写作上下文，请基于这些信息撰写**当前章节**的正文。',
    '',
    `> ⚠ 当前为第 ${chapter} 章「无细纲模式」：本章没有细纲，请以总纲节点为主要依据进行**保守推进**。`,
    '> 不要提前透支后续章节的转折或揭示；不要自行发明与总纲矛盾的新剧情线。',
    '',
    '---',
    '',
    '### 一、故事基底',
    buildFoundationSection(foundation, { maxLength: 2600 }),
    '',
    storylineSection ? '### 二、叙事线' : null,
    storylineSection,
    storylineSection ? '' : null,
    `### ${storylineSection ? '三' : '二'}、当前总纲节点（第 ${matchedNode.chapterStart}-${matchedNode.chapterEnd} 章）`,
    buildMasterNodeSection(matchedNode, outlineState.storylines),
    '',
    adjacentHint ? `### 相邻章节参考` : null,
    adjacentHint,
    adjacentHint ? '' : null,
    '---',
    '',
    '### 创作要求',
    '',
    '1. **保持一致性**：人物性格、世界规则、已发生事件不得自相矛盾。',
    '2. **节奏控制**：本章仅推进总纲节点范围内的适当剧情量，为后续章节留出空间。',
    '3. **具体化叙事**：用场景、对话、动作展开故事，避免概述式写作。',
    '4. **衔接自然**：确保与上一章的情节和情感状态自然衔接。',
    '',
    '### 用户续写指令',
    '',
    trimOrEmpty(settingsPrompt) || '（用户未提供额外指令，请按上述大纲自由创作）',
  ]);
}

function composeFullOutlinePrompt(
  chapter: number,
  settingsPrompt: string,
  outlineState: OutlineState,
  foundation: StoryFoundation,
  detail: ChapterDetail,
  matchedNode: MasterOutlineNode | null,
): string {
  const storylineSection = buildStorylineSection(outlineState.storylines);
  const relatedNodes = collectRelatedNodes(detail, outlineState.masterOutline);
  const relatedSection = buildRelatedNodesSection(relatedNodes, outlineState.storylines);
  const adjacentHint = buildAdjacentChaptersHint(chapter, outlineState.detailsByChapter);

  // 动态编号
  let sectionNum = 0;
  const nextSection = () => {
    sectionNum += 1;
    return numToChinese(sectionNum);
  };

  return compactLines([
    `## 角色：章节续写助手`,
    '',
    '你正在续写一部长篇小说。以下是本章的完整结构化写作上下文，请**严格按照细纲**撰写当前章节的正文。',
    '',
    '---',
    '',
    `### ${nextSection()}、故事基底`,
    buildFoundationSection(foundation, { maxLength: 2600 }),
    '',
    storylineSection ? `### ${nextSection()}、叙事线` : null,
    storylineSection,
    storylineSection ? '' : null,
    matchedNode ? `### ${nextSection()}、关联总纲节点（第 ${matchedNode.chapterStart}-${matchedNode.chapterEnd} 章）` : null,
    matchedNode ? buildMasterNodeSection(matchedNode, outlineState.storylines) : null,
    matchedNode ? '' : null,
    relatedSection ? `### ${nextSection()}、其他关联总纲节点` : null,
    relatedSection,
    relatedSection ? '' : null,
    `### ${nextSection()}、第 ${chapter} 章细纲`,
    buildChapterDetailSection(detail),
    '',
    adjacentHint ? `### ${nextSection()}、相邻章节` : null,
    adjacentHint,
    adjacentHint ? '' : null,
    '---',
    '',
    `### 创作要求`,
    '',
    '1. **严格遵循细纲**：按照剧情节拍顺序推进，不跳过、不合并、不提前揭示后续章节内容。',
    detail.mustAvoid && detail.mustAvoid.some(v => v.trim())
      ? '2. **遵守禁区**：「必须避免」中列出的内容绝对不可出现。'
      : null,
    detail.mustInclude && detail.mustInclude.some(v => v.trim())
      ? `${detail.mustAvoid && detail.mustAvoid.some(v => v.trim()) ? '3' : '2'}. **覆盖要点**：「必须包含」中的所有元素都应自然融入正文。`
      : null,
    `${getNextRuleNum(detail)}. **保持一致性**：人物性格、世界规则、已发生事件不得自相矛盾。`,
    `${getNextRuleNum(detail) + 1}. **具体化叙事**：用场景、对话、动作、内心活动展开故事，避免概述式、流水账式写作。`,
    `${getNextRuleNum(detail) + 2}. **衔接与收束**：开头自然承接上一章，结尾落在章末钩子或本章目标的完成节点上。`,
    trimOrEmpty(detail.pov) ? `${getNextRuleNum(detail) + 3}. **视角锁定**：本章以「${detail.pov!.trim()}」的视角展开叙述。` : null,
    trimOrEmpty(detail.emotionalArc) ? `- **情感走向参考**：${detail.emotionalArc!.trim()}` : null,
    '',
    '### 用户续写指令',
    '',
    trimOrEmpty(settingsPrompt) || '（用户未提供额外指令，请按上述大纲自由创作）',
  ]);
}

/** 辅助：根据 mustAvoid / mustInclude 是否存在来推算下一条规则的编号 */
function getNextRuleNum(detail: ChapterDetail): number {
  let n = 2;
  if (detail.mustAvoid && detail.mustAvoid.some(v => v.trim())) n++;
  if (detail.mustInclude && detail.mustInclude.some(v => v.trim())) n++;
  return n;
}

function numToChinese(n: number): string {
  const map = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return n <= 10 ? map[n]! : String(n);
}

// ─── Main Entry ─────────────────────────────────────────────────────────────

export function resolveChapterPrompt(
  chapter: number,
  settings: NovelSettings,
  outlineState: OutlineState,
  foundation: StoryFoundation,
): ChapterPromptResolveResult {
  const targetChapter = normalizeChapter(chapter);
  const fallbackPrompt = settings.prompt;

  if (!outlineState.enabled) {
    return {
      prompt: fallbackPrompt,
      warning: null,
      usedOutline: false,
    };
  }

  const detail = outlineState.detailsByChapter[targetChapter] ?? null;
  if (!hasMeaningfulDetail(detail)) {
    if (outlineState.missingDetailPolicy === 'strict_block') {
      throw new Error(`第 ${targetChapter} 章缺少细纲，已按 strict_block 阻断生成`);
    }

    const matchedNodeResult = matchMasterOutlineNodeByChapter(targetChapter, outlineState.masterOutline);
    if (!matchedNodeResult.node) {
      return {
        prompt: fallbackPrompt,
        warning: {
          code: 'outline_missing_detail_fallback',
          chapter: targetChapter,
          message: `第 ${targetChapter} 章缺少细纲，且未匹配到可用总纲节点，已回退到通用 prompt`,
        },
        usedOutline: false,
      };
    }

    return {
      prompt: composeMissingDetailFallbackPrompt(targetChapter, fallbackPrompt, outlineState, foundation, matchedNodeResult.node),
      warning: {
        code: 'outline_missing_detail_fallback',
        chapter: targetChapter,
        message: `第 ${targetChapter} 章缺少细纲，已回退到总纲上下文模式继续生成`,
      },
      usedOutline: true,
    };
  }

  const matchedNode = findMatchedMasterNode(targetChapter, detail, outlineState.masterOutline);
  const prompt = composeFullOutlinePrompt(targetChapter, fallbackPrompt, outlineState, foundation, detail, matchedNode);

  return {
    prompt,
    warning: null,
    usedOutline: true,
  };
}
