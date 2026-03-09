import type { StoryFoundation } from '../types/foundation';
import type {
  ChapterDetail,
  MasterOutlineNode,
  OutlineMentionConfig,
  OutlineMentionKind,
  OutlineMentionRef,
  OutlineMentionSnapshot,
  Storyline,
} from '../types/outline';

const DEFAULT_SEARCH_LIMIT = 8;
const DETAIL_MENTION_ID_PREFIX = 'chapter:';
const DEFAULT_WORLDBOOK_PREVIEW_ENTRY_LIMIT = 12;
const WORLDBOOK_ENTRY_MENTION_ID_PREFIX = 'worldbook-entry:';
const WORLDBOOK_ENTRY_CACHE_TTL_MS = 1000;

export type OutlineMentionContext = {
  foundation: StoryFoundation;
  storylines: Storyline[];
  masterOutline: MasterOutlineNode[];
  detailsByChapter: Record<number, ChapterDetail>;
  mentionConfig?: OutlineMentionConfig;
};

export type OutlineMentionCandidate = OutlineMentionRef & {
  description: string;
};

export type OutlineMentionProviderSearchInput = {
  query: string;
  limit: number;
  context: OutlineMentionContext;
};

export type OutlineMentionProviderResolveInput = {
  mention: OutlineMentionRef;
  context: OutlineMentionContext;
  frozenAt?: string;
};

export type OutlineMentionProvider = {
  kind: OutlineMentionKind;
  search: (input: OutlineMentionProviderSearchInput) => Promise<OutlineMentionCandidate[]>;
  resolve: (input: OutlineMentionProviderResolveInput) => Promise<OutlineMentionSnapshot | null>;
  renderForPrompt: (snapshot: OutlineMentionSnapshot) => string;
};

export type SearchOutlineMentionCandidatesInput = {
  query?: string;
  limit?: number;
  kinds?: OutlineMentionKind[];
  context: OutlineMentionContext;
};

export type ResolveOutlineMentionSnapshotsInput = {
  mentions: OutlineMentionRef[];
  context: OutlineMentionContext;
  frozenAt?: string;
};

export type ResolveOutlineMentionSnapshotsResult = {
  snapshots: OutlineMentionSnapshot[];
  warnings: string[];
};

type EnabledWorldbookSource = 'chat' | 'character.primary' | 'character.additional' | 'global';

type EnabledWorldbookSnapshot = {
  name: string;
  priority: number;
  sources: EnabledWorldbookSource[];
};

type WorldbookEntrySearchRecord = {
  worldbookName: string;
  worldbookPriority: number;
  worldbookSources: EnabledWorldbookSource[];
  uid: number;
  name: string;
  content: string;
  strategyType: string;
  keyPreview: string;
};

type WorldbookEntrySearchCache = {
  cacheKey: string;
  expiresAt: number;
  entries: WorldbookEntrySearchRecord[];
};

let worldbookEntrySearchCache: WorldbookEntrySearchCache | null = null;

const OUTLINE_MENTION_KIND_ORDER: OutlineMentionKind[] = ['node', 'storyline', 'detail', 'foundation', 'worldbook_entry', 'worldbook'];
const ENABLED_WORLDBOOK_SOURCE_ORDER: EnabledWorldbookSource[] = ['chat', 'character.primary', 'character.additional', 'global'];
const ENABLED_WORLDBOOK_SOURCE_LABELS: Record<EnabledWorldbookSource, string> = {
  chat: '聊天绑定',
  'character.primary': '角色主绑定',
  'character.additional': '角色附加',
  global: '全局启用',
};
const DEFAULT_OUTLINE_MENTION_CONFIG: OutlineMentionConfig = {
  worldbookEntryLabel: {
    includeWorldbookName: true,
    includeTriggerKeywords: false,
    includeStrategyType: false,
  },
};
const WORLDBOOK_ENTRY_LABEL_TRIGGER_MAX_LENGTH = 24;

function normalizeSearchQuery(query: string | undefined): string {
  return (query ?? '').trim();
}

function normalizeSearchLimit(limit: number | undefined): number {
  const rawLimit = typeof limit === 'number' ? limit : DEFAULT_SEARCH_LIMIT;
  const resolved = Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : DEFAULT_SEARCH_LIMIT;
  return Math.max(1, resolved);
}

function toLowerCaseText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeWorldbookName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWorldbookNameList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized = values.map(item => normalizeWorldbookName(item)).filter(Boolean);
  return [...new Set(normalized)];
}

function matchByQuery(query: string, ...candidates: unknown[]): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = toLowerCaseText(query);
  if (!normalizedQuery) {
    return true;
  }

  return candidates.some(candidate => toLowerCaseText(candidate).includes(normalizedQuery));
}

function limitItems<T>(items: T[], limit: number): T[] {
  return items.slice(0, Math.max(1, limit));
}

function createFrozenAt(frozenAt?: string): string {
  const candidate = typeof frozenAt === 'string' ? frozenAt.trim() : '';
  return candidate || new Date().toISOString();
}

function createSnapshotFromMention(mention: OutlineMentionRef, frozenAt: string, content: string): OutlineMentionSnapshot {
  return {
    kind: mention.kind,
    id: mention.id,
    label: mention.label,
    frozenAt,
    content,
  };
}

function findStorylineLabel(storylines: Storyline[], storylineId: string | undefined): string {
  const normalizedId = (storylineId ?? '').trim();
  if (!normalizedId) {
    return '未分配故事线';
  }

  const matched = storylines.find(storyline => storyline.id === normalizedId);
  if (!matched) {
    return normalizedId;
  }

  return matched.title.trim() || normalizedId;
}

function formatNodeSummary(node: MasterOutlineNode, storylines: Storyline[]): string {
  return `第 ${node.chapterStart}-${node.chapterEnd} 章 · ${findStorylineLabel(storylines, node.storylineId)}`;
}

function buildFoundationContent(foundation: StoryFoundation): string {
  const lines = [
    `标题：${foundation.positioning.title || '（未填写）'}`,
    `题材：${foundation.positioning.genre || '（未填写）'}`,
    `主类型：${foundation.positioning.mainType || '（未填写）'}`,
    `一句话梗概：${foundation.core.logline || '（未填写）'}`,
    `核心冲突：${foundation.core.coreConflict || '（未填写）'}`,
    `情绪基调：${foundation.core.emotionalTone || '（未填写）'}`,
    `主角：${foundation.protagonist.name || '（未填写）'}`,
    `主角身份：${foundation.protagonist.identity || '（未填写）'}`,
  ];

  if (foundation.keyRelations.antagonist.name.trim()) {
    lines.push(`主要对立者：${foundation.keyRelations.antagonist.name}`);
  }

  if (foundation.keyRelations.keyCharacters.length > 0) {
    lines.push(
      `关键人物：${foundation.keyRelations.keyCharacters
        .map(character => character.name.trim() || character.role.trim())
        .filter(Boolean)
        .join('、')}`,
    );
  }

  if (foundation.worldBrief.requiredRules.length > 0) {
    lines.push(`世界规则：${foundation.worldBrief.requiredRules.join('；')}`);
  }

  if (foundation.worldBrief.forbiddenSettings.length > 0) {
    lines.push(`禁用设定：${foundation.worldBrief.forbiddenSettings.join('；')}`);
  }

  if (foundation.narrativeRules.forbiddenPatterns.length > 0) {
    lines.push(`禁止套路：${foundation.narrativeRules.forbiddenPatterns.join('；')}`);
  }

  return lines.join('\n');
}

function buildStorylineContent(storyline: Storyline): string {
  return [
    `ID：${storyline.id}`,
    `名称：${storyline.title || '（未命名）'}`,
    `类型：${storyline.type}`,
    `状态：${storyline.status}`,
    `描述：${storyline.description || '（无）'}`,
  ].join('\n');
}

function buildNodeContent(node: MasterOutlineNode, storylines: Storyline[]): string {
  return [
    `ID：${node.id}`,
    `标题：${node.title || '（未命名）'}`,
    `章节范围：${node.chapterStart}-${node.chapterEnd}`,
    `所属故事线：${findStorylineLabel(storylines, node.storylineId)}`,
    `叙事阶段：${node.phase ?? 'custom'}`,
    `概要：${node.summary || '（无）'}`,
  ].join('\n');
}

function buildDetailMentionId(chapter: number): string {
  return `${DETAIL_MENTION_ID_PREFIX}${chapter}`;
}

function parseDetailMentionChapter(id: string): number | null {
  const normalized = id.trim();
  if (!normalized.startsWith(DETAIL_MENTION_ID_PREFIX)) {
    return null;
  }

  const chapter = Number(normalized.slice(DETAIL_MENTION_ID_PREFIX.length));
  if (!Number.isFinite(chapter)) {
    return null;
  }

  return Math.max(1, Math.trunc(chapter));
}

function buildDetailContent(detail: ChapterDetail): string {
  return [
    `章节：${detail.chapter}`,
    `标题：${detail.title || '（未命名）'}`,
    `目标：${detail.goal || '（无）'}`,
    `冲突：${detail.conflict || '（无）'}`,
    `节拍：${detail.beats.length > 0 ? detail.beats.join('；') : '（无）'}`,
  ].join('\n');
}

function safeReadWorldbookNames(): string[] {
  if (typeof getWorldbookNames !== 'function') {
    return [];
  }

  try {
    return normalizeWorldbookNameList(getWorldbookNames());
  } catch {
    return [];
  }
}

function safeReadCurrentBoundWorldbook(): string | null {
  if (typeof getChatWorldbookName !== 'function') {
    return null;
  }

  try {
    const normalized = normalizeWorldbookName(getChatWorldbookName('current'));
    return normalized || null;
  } catch {
    return null;
  }
}

function safeReadGlobalWorldbookNames(): string[] {
  if (typeof getGlobalWorldbookNames !== 'function') {
    return [];
  }

  try {
    return normalizeWorldbookNameList(getGlobalWorldbookNames());
  } catch {
    return [];
  }
}

function safeReadCurrentCharacterWorldbooks(): { primary: string | null; additional: string[] } {
  if (typeof getCharWorldbookNames !== 'function') {
    return {
      primary: null,
      additional: [],
    };
  }

  try {
    const snapshot = getCharWorldbookNames('current');
    if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
      return {
        primary: null,
        additional: [],
      };
    }

    const record = snapshot as Record<string, unknown>;
    const primary = normalizeWorldbookName(record.primary) || null;
    const additional = normalizeWorldbookNameList(record.additional);

    return {
      primary,
      additional,
    };
  } catch {
    return {
      primary: null,
      additional: [],
    };
  }
}

function sortEnabledWorldbookSources(sources: EnabledWorldbookSource[]): EnabledWorldbookSource[] {
  return [...sources].sort(
    (left, right) => ENABLED_WORLDBOOK_SOURCE_ORDER.indexOf(left) - ENABLED_WORLDBOOK_SOURCE_ORDER.indexOf(right),
  );
}

function upsertEnabledWorldbook(
  target: Map<string, EnabledWorldbookSnapshot>,
  name: string,
  source: EnabledWorldbookSource,
  priority: number,
): void {
  const normalizedName = normalizeWorldbookName(name);
  if (!normalizedName) {
    return;
  }

  const existing = target.get(normalizedName);
  if (!existing) {
    target.set(normalizedName, {
      name: normalizedName,
      priority,
      sources: [source],
    });
    return;
  }

  existing.priority = Math.min(existing.priority, priority);
  if (!existing.sources.includes(source)) {
    existing.sources.push(source);
  }
}

function readEnabledWorldbooks(): EnabledWorldbookSnapshot[] {
  const merged = new Map<string, EnabledWorldbookSnapshot>();

  const boundWorldbook = safeReadCurrentBoundWorldbook();
  if (boundWorldbook) {
    upsertEnabledWorldbook(merged, boundWorldbook, 'chat', 0);
  }

  const characterWorldbooks = safeReadCurrentCharacterWorldbooks();
  if (characterWorldbooks.primary) {
    upsertEnabledWorldbook(merged, characterWorldbooks.primary, 'character.primary', 1);
  }

  characterWorldbooks.additional.forEach(name => {
    upsertEnabledWorldbook(merged, name, 'character.additional', 2);
  });

  safeReadGlobalWorldbookNames().forEach(name => {
    upsertEnabledWorldbook(merged, name, 'global', 3);
  });

  return [...merged.values()]
    .map(snapshot => ({
      ...snapshot,
      sources: sortEnabledWorldbookSources(snapshot.sources),
    }))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      return left.name.localeCompare(right.name, 'zh-Hans-CN');
    });
}

function formatEnabledWorldbookSources(sources: EnabledWorldbookSource[]): string {
  if (sources.length === 0) {
    return '启用世界书';
  }

  return sortEnabledWorldbookSources(sources).map(source => ENABLED_WORLDBOOK_SOURCE_LABELS[source]).join(' / ');
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeWorldbookEntryUid(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(candidate)) {
    return Math.max(0, Math.trunc(fallback));
  }

  return Math.max(0, Math.trunc(candidate));
}

function buildWorldbookEntryMentionId(worldbookName: string, uid: number): string {
  return `${WORLDBOOK_ENTRY_MENTION_ID_PREFIX}${encodeURIComponent(worldbookName)}:${Math.max(0, Math.trunc(uid))}`;
}

function parseWorldbookEntryMentionId(mentionId: string): { worldbookName: string; uid: number } | null {
  const normalized = mentionId.trim();
  if (!normalized.startsWith(WORLDBOOK_ENTRY_MENTION_ID_PREFIX)) {
    return null;
  }

  const payload = normalized.slice(WORLDBOOK_ENTRY_MENTION_ID_PREFIX.length);
  const separatorIndex = payload.lastIndexOf(':');
  if (separatorIndex <= 0) {
    return null;
  }

  const encodedWorldbookName = payload.slice(0, separatorIndex);
  const uidValue = Number(payload.slice(separatorIndex + 1));
  if (!Number.isFinite(uidValue)) {
    return null;
  }

  try {
    const worldbookName = decodeURIComponent(encodedWorldbookName).trim();
    if (!worldbookName) {
      return null;
    }
    return {
      worldbookName,
      uid: Math.max(0, Math.trunc(uidValue)),
    };
  } catch {
    return null;
  }
}

function extractWorldbookEntryKeyPreview(entry: unknown): string {
  const record = toRecord(entry);
  if (!record) {
    return '';
  }

  const strategy = record.strategy;
  const strategyRecord = toRecord(strategy);
  if (!strategyRecord) {
    return '';
  }

  const keys = strategyRecord.keys;
  if (!Array.isArray(keys)) {
    return '';
  }

  const normalizedKeys = keys
    .map(key => {
      if (typeof key === 'string') {
        return key.trim();
      }
      if (key instanceof RegExp) {
        return key.toString();
      }
      return '';
    })
    .filter(Boolean);

  return normalizedKeys.join(' / ');
}

function buildWorldbookEntriesPreview(entries: unknown[], maxEntries: number): string {
  if (entries.length === 0) {
    return '（世界书为空）';
  }

  const lines = entries.slice(0, maxEntries).map((entry, index) => {
    const record = toRecord(entry) ?? {};
    const name = normalizeWorldbookName(record.name);
    const keyPreview = extractWorldbookEntryKeyPreview(entry);
    const label = name || `条目 #${index + 1}`;

    return keyPreview ? `- ${label}（关键词：${keyPreview}）` : `- ${label}`;
  });

  if (entries.length > maxEntries) {
    lines.push(`- ……其余 ${entries.length - maxEntries} 条省略`);
  }

  return lines.join('\n');
}

type NormalizedWorldbookEntry = {
  uid: number;
  name: string;
  enabled: boolean;
  content: string;
  strategyType: string;
  keyPreview: string;
};

function normalizeWorldbookEntry(entry: unknown, fallbackUid: number): NormalizedWorldbookEntry | null {
  const record = toRecord(entry);
  if (!record) {
    return null;
  }

  const uid = normalizeWorldbookEntryUid(record.uid, fallbackUid);
  const name = normalizeWorldbookName(record.name) || `条目 #${uid}`;
  const enabled = record.enabled !== false;
  const content = typeof record.content === 'string' ? record.content.trim() : '';
  const strategyRecord = toRecord(record.strategy);
  const strategyType = typeof strategyRecord?.type === 'string' ? strategyRecord.type.trim() : '';
  const keyPreview = extractWorldbookEntryKeyPreview(record);

  return {
    uid,
    name,
    enabled,
    content,
    strategyType,
    keyPreview,
  };
}

function buildWorldbookEntryPromptContent(worldbookName: string, entry: NormalizedWorldbookEntry): string {
  return [
    `世界书：${worldbookName}`,
    `UID：${entry.uid}`,
    `条目：${entry.name}`,
    `启用：${entry.enabled ? '是' : '否'}`,
    `激活策略：${entry.strategyType || '（未知）'}`,
    `关键词：${entry.keyPreview || '（无）'}`,
    `正文：${entry.content || '（空）'}`,
  ].join('\n');
}

function truncatePreviewText(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return '';
  }

  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength === 1) {
    return '…';
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function resolveOutlineMentionConfig(context: OutlineMentionContext): OutlineMentionConfig {
  const config = context.mentionConfig;
  if (!config) {
    return DEFAULT_OUTLINE_MENTION_CONFIG;
  }

  const labelConfig = config.worldbookEntryLabel;
  return {
    worldbookEntryLabel: {
      includeWorldbookName: labelConfig?.includeWorldbookName !== false,
      includeTriggerKeywords: labelConfig?.includeTriggerKeywords === true,
      includeStrategyType: labelConfig?.includeStrategyType === true,
    },
  };
}

function buildWorldbookEntryCandidateLabel(
  entry: WorldbookEntrySearchRecord,
  config: OutlineMentionConfig,
): string {
  const labelParts: string[] = [];

  if (config.worldbookEntryLabel.includeWorldbookName) {
    labelParts.push(entry.worldbookName);
  }

  if (config.worldbookEntryLabel.includeTriggerKeywords && entry.keyPreview) {
    labelParts.push(`触发词：${truncatePreviewText(entry.keyPreview, WORLDBOOK_ENTRY_LABEL_TRIGGER_MAX_LENGTH)}`);
  }

  if (config.worldbookEntryLabel.includeStrategyType && entry.strategyType) {
    labelParts.push(`策略：${entry.strategyType}`);
  }

  return labelParts.length > 0 ? `${entry.name}（${labelParts.join('｜')}）` : entry.name;
}

function buildWorldbookEntrySearchCacheKey(worldbooks: EnabledWorldbookSnapshot[]): string {
  return worldbooks
    .map(worldbook => `${worldbook.name}:${worldbook.priority}:${sortEnabledWorldbookSources(worldbook.sources).join(',')}`)
    .join('|');
}

async function loadEnabledWorldbookEntries(): Promise<WorldbookEntrySearchRecord[]> {
  const enabledWorldbooks = readEnabledWorldbooks();
  if (enabledWorldbooks.length === 0 || typeof getWorldbook !== 'function') {
    return [];
  }

  const cacheKey = buildWorldbookEntrySearchCacheKey(enabledWorldbooks);
  const now = Date.now();
  if (worldbookEntrySearchCache && worldbookEntrySearchCache.cacheKey === cacheKey && worldbookEntrySearchCache.expiresAt > now) {
    return worldbookEntrySearchCache.entries;
  }

  const loadedWorldbooks = await Promise.all(
    enabledWorldbooks.map(async worldbook => {
      try {
        const entries = await getWorldbook(worldbook.name);
        return {
          worldbook,
          entries: Array.isArray(entries) ? entries : [],
        };
      } catch {
        return {
          worldbook,
          entries: [] as unknown[],
        };
      }
    }),
  );

  const normalizedEntries: WorldbookEntrySearchRecord[] = [];

  loadedWorldbooks.forEach(({ worldbook, entries }) => {
    entries.forEach((entry, index) => {
      const normalized = normalizeWorldbookEntry(entry, index + 1);
      if (!normalized || !normalized.enabled) {
        return;
      }

      normalizedEntries.push({
        worldbookName: worldbook.name,
        worldbookPriority: worldbook.priority,
        worldbookSources: worldbook.sources,
        uid: normalized.uid,
        name: normalized.name,
        content: normalized.content,
        strategyType: normalized.strategyType,
        keyPreview: normalized.keyPreview,
      });
    });
  });

  worldbookEntrySearchCache = {
    cacheKey,
    expiresAt: now + WORLDBOOK_ENTRY_CACHE_TTL_MS,
    entries: normalizedEntries,
  };

  return normalizedEntries;
}

function getMentionProvider(kind: OutlineMentionKind): OutlineMentionProvider {
  return OUTLINE_MENTION_PROVIDERS[kind];
}

const foundationMentionProvider: OutlineMentionProvider = {
  kind: 'foundation',
  async search(input) {
    const foundation = input.context.foundation;
    if (!matchByQuery(input.query, foundation.positioning.title, foundation.positioning.genre, foundation.core.logline, foundation.core.coreConflict, foundation.protagonist.name, foundation.keyRelations.antagonist.name)) {
      return [];
    }

    return [
      {
        kind: 'foundation',
        id: 'foundation:current',
        label: foundation.positioning.title.trim() || '故事基底',
        description: foundation.positioning.genre.trim() || '当前故事基底',
      },
    ];
  },
  async resolve(input) {
    if (input.mention.id.trim() !== 'foundation:current') {
      return null;
    }

    const frozenAt = createFrozenAt(input.frozenAt);
    return createSnapshotFromMention(input.mention, frozenAt, buildFoundationContent(input.context.foundation));
  },
  renderForPrompt(snapshot) {
    return `【故事基底】${snapshot.label}\n${snapshot.content}`;
  },
};

const storylineMentionProvider: OutlineMentionProvider = {
  kind: 'storyline',
  async search(input) {
    const candidates = input.context.storylines
      .filter(storyline => matchByQuery(input.query, storyline.title, storyline.description, storyline.id))
      .map<OutlineMentionCandidate>(storyline => ({
        kind: 'storyline',
        id: storyline.id,
        label: storyline.title.trim() || storyline.id,
        description: `${storyline.type} · ${storyline.status}`,
      }));

    return limitItems(candidates, input.limit);
  },
  async resolve(input) {
    const storyline = input.context.storylines.find(item => item.id === input.mention.id);
    if (!storyline) {
      return null;
    }

    return createSnapshotFromMention(input.mention, createFrozenAt(input.frozenAt), buildStorylineContent(storyline));
  },
  renderForPrompt(snapshot) {
    return `【故事线】${snapshot.label}\n${snapshot.content}`;
  },
};

const nodeMentionProvider: OutlineMentionProvider = {
  kind: 'node',
  async search(input) {
    const candidates = input.context.masterOutline
      .filter(node =>
        matchByQuery(
          input.query,
          node.title,
          node.summary,
          node.id,
          `${node.chapterStart}`,
          `${node.chapterEnd}`,
          findStorylineLabel(input.context.storylines, node.storylineId),
        ),
      )
      .map<OutlineMentionCandidate>(node => ({
        kind: 'node',
        id: node.id,
        label: node.title.trim() || node.id,
        description: formatNodeSummary(node, input.context.storylines),
      }));

    return limitItems(candidates, input.limit);
  },
  async resolve(input) {
    const node = input.context.masterOutline.find(item => item.id === input.mention.id);
    if (!node) {
      return null;
    }

    return createSnapshotFromMention(input.mention, createFrozenAt(input.frozenAt), buildNodeContent(node, input.context.storylines));
  },
  renderForPrompt(snapshot) {
    return `【大纲节点】${snapshot.label}\n${snapshot.content}`;
  },
};

const detailMentionProvider: OutlineMentionProvider = {
  kind: 'detail',
  async search(input) {
    const details = Object.values(input.context.detailsByChapter).sort((left, right) => left.chapter - right.chapter);

    const candidates = details
      .filter(detail => matchByQuery(input.query, `${detail.chapter}`, detail.title, detail.goal, detail.conflict, detail.parentNodeId))
      .map<OutlineMentionCandidate>(detail => ({
        kind: 'detail',
        id: buildDetailMentionId(detail.chapter),
        label: `第 ${detail.chapter} 章 · ${detail.title || '未命名细纲'}`,
        description: detail.goal || detail.conflict || '章节细纲',
      }));

    return limitItems(candidates, input.limit);
  },
  async resolve(input) {
    const chapter = parseDetailMentionChapter(input.mention.id);
    if (chapter === null) {
      return null;
    }

    const detail = input.context.detailsByChapter[chapter];
    if (!detail) {
      return null;
    }

    return createSnapshotFromMention(input.mention, createFrozenAt(input.frozenAt), buildDetailContent(detail));
  },
  renderForPrompt(snapshot) {
    return `【章节细纲】${snapshot.label}\n${snapshot.content}`;
  },
};

const worldbookEntryMentionProvider: OutlineMentionProvider = {
  kind: 'worldbook_entry',
  async search(input) {
    const query = input.query.trim();
    if (!query) {
      return [];
    }

    const entries = await loadEnabledWorldbookEntries();
    const matchedEntries = entries
      .filter(entry =>
        matchByQuery(
          query,
          entry.name,
          entry.content,
          entry.keyPreview,
          entry.strategyType,
          `${entry.uid}`,
          entry.worldbookName,
        ),
      )
      .sort((left, right) => {
        if (left.worldbookPriority !== right.worldbookPriority) {
          return left.worldbookPriority - right.worldbookPriority;
        }
        const worldbookNameCompare = left.worldbookName.localeCompare(right.worldbookName, 'zh-Hans-CN');
        if (worldbookNameCompare !== 0) {
          return worldbookNameCompare;
        }
        const entryNameCompare = left.name.localeCompare(right.name, 'zh-Hans-CN');
        if (entryNameCompare !== 0) {
          return entryNameCompare;
        }
        return left.uid - right.uid;
      });

    const mentionConfig = resolveOutlineMentionConfig(input.context);
    const candidates = matchedEntries.map<OutlineMentionCandidate>(entry => {
      const sourceSummary = formatEnabledWorldbookSources(entry.worldbookSources);
      const keySummary = entry.keyPreview ? ` · 关键词：${truncatePreviewText(entry.keyPreview, 32)}` : '';
      return {
        kind: 'worldbook_entry',
        id: buildWorldbookEntryMentionId(entry.worldbookName, entry.uid),
        label: buildWorldbookEntryCandidateLabel(entry, mentionConfig),
        description: `${sourceSummary}${keySummary}`,
      };
    });

    return limitItems(candidates, input.limit);
  },
  async resolve(input) {
    const parsedMention = parseWorldbookEntryMentionId(input.mention.id);
    if (!parsedMention || typeof getWorldbook !== 'function') {
      return null;
    }

    try {
      const worldbookEntries = await getWorldbook(parsedMention.worldbookName);
      const normalizedEntries = Array.isArray(worldbookEntries) ? worldbookEntries : [];
      const matchedEntry = normalizedEntries
        .map((entry, index) => normalizeWorldbookEntry(entry, index + 1))
        .find((entry): entry is NormalizedWorldbookEntry => Boolean(entry && entry.uid === parsedMention.uid));
      if (!matchedEntry) {
        return null;
      }

      return createSnapshotFromMention(
        input.mention,
        createFrozenAt(input.frozenAt),
        buildWorldbookEntryPromptContent(parsedMention.worldbookName, matchedEntry),
      );
    } catch {
      return null;
    }
  },
  renderForPrompt(snapshot) {
    return `【世界书条目】${snapshot.label}\n${snapshot.content}`;
  },
};

const worldbookMentionProvider: OutlineMentionProvider = {
  kind: 'worldbook',
  async search(input) {
    const names = safeReadWorldbookNames();
    const boundName = safeReadCurrentBoundWorldbook();
    const enabledWorldbookMap = new Map(readEnabledWorldbooks().map(item => [item.name, item] as const));

    const filtered = names.filter(name => matchByQuery(input.query, name));
    filtered.sort((left, right) => {
      const leftPriority = enabledWorldbookMap.get(left)?.priority ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = enabledWorldbookMap.get(right)?.priority ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      if (boundName && left === boundName && right !== boundName) {
        return -1;
      }
      if (boundName && right === boundName && left !== boundName) {
        return 1;
      }
      return left.localeCompare(right, 'zh-Hans-CN');
    });

    return limitItems(
      filtered.map<OutlineMentionCandidate>(name => ({
        kind: 'worldbook',
        id: name,
        label: name,
        description:
          enabledWorldbookMap.get(name)
            ? `已启用 · ${formatEnabledWorldbookSources(enabledWorldbookMap.get(name)?.sources ?? [])}`
            : boundName === name
              ? '当前聊天绑定世界书'
              : '世界书',
      })),
      input.limit,
    );
  },
  async resolve(input) {
    const worldbookName = input.mention.id.trim();
    if (!worldbookName || typeof getWorldbook !== 'function') {
      return null;
    }

    try {
      const entries = await getWorldbook(worldbookName);
      const normalizedEntries = Array.isArray(entries) ? entries : [];
      const content = [
        `世界书：${worldbookName}`,
        `条目数：${normalizedEntries.length}`,
        buildWorldbookEntriesPreview(normalizedEntries, DEFAULT_WORLDBOOK_PREVIEW_ENTRY_LIMIT),
      ].join('\n');

      return createSnapshotFromMention(input.mention, createFrozenAt(input.frozenAt), content);
    } catch {
      return null;
    }
  },
  renderForPrompt(snapshot) {
    return `【世界书】${snapshot.label}\n${snapshot.content}`;
  },
};

const OUTLINE_MENTION_PROVIDERS: Record<OutlineMentionKind, OutlineMentionProvider> = {
  worldbook: worldbookMentionProvider,
  worldbook_entry: worldbookEntryMentionProvider,
  foundation: foundationMentionProvider,
  storyline: storylineMentionProvider,
  node: nodeMentionProvider,
  detail: detailMentionProvider,
};

function resolveSearchKinds(kinds: OutlineMentionKind[] | undefined): OutlineMentionKind[] {
  if (!Array.isArray(kinds) || kinds.length === 0) {
    return OUTLINE_MENTION_KIND_ORDER;
  }

  const accepted = new Set<OutlineMentionKind>(OUTLINE_MENTION_KIND_ORDER);
  const ordered = kinds
    .filter(kind => accepted.has(kind))
    .sort((left, right) => OUTLINE_MENTION_KIND_ORDER.indexOf(left) - OUTLINE_MENTION_KIND_ORDER.indexOf(right));

  return ordered.length > 0 ? ordered : OUTLINE_MENTION_KIND_ORDER;
}

export function getOutlineMentionProviders(): OutlineMentionProvider[] {
  return OUTLINE_MENTION_KIND_ORDER.map(kind => getMentionProvider(kind));
}

export async function searchOutlineMentionCandidates(input: SearchOutlineMentionCandidatesInput): Promise<OutlineMentionCandidate[]> {
  const query = normalizeSearchQuery(input.query);
  const limit = normalizeSearchLimit(input.limit);
  const kinds = resolveSearchKinds(input.kinds);

  const collected: OutlineMentionCandidate[] = [];
  const deduped = new Set<string>();

  for (const kind of kinds) {
    const provider = getMentionProvider(kind);
    const candidates = await provider.search({
      query,
      limit,
      context: input.context,
    });

    for (const candidate of candidates) {
      const key = `${candidate.kind}:${candidate.id}`;
      if (deduped.has(key)) {
        continue;
      }

      deduped.add(key);
      collected.push(candidate);

      if (collected.length >= limit) {
        return collected;
      }
    }
  }

  return collected;
}

export async function resolveOutlineMentionSnapshot(input: OutlineMentionProviderResolveInput): Promise<OutlineMentionSnapshot | null> {
  const provider = getMentionProvider(input.mention.kind);
  return provider.resolve(input);
}

export async function resolveOutlineMentionSnapshots(
  input: ResolveOutlineMentionSnapshotsInput,
): Promise<ResolveOutlineMentionSnapshotsResult> {
  const snapshots: OutlineMentionSnapshot[] = [];
  const warnings: string[] = [];

  for (const mention of input.mentions) {
    const snapshot = await resolveOutlineMentionSnapshot({
      mention,
      context: input.context,
      frozenAt: input.frozenAt,
    });

    if (!snapshot) {
      warnings.push(`引用解析失败：${mention.kind}/${mention.label || mention.id}`);
      continue;
    }

    snapshots.push(snapshot);
  }

  return {
    snapshots,
    warnings,
  };
}

export function renderOutlineMentionSnapshotForPrompt(snapshot: OutlineMentionSnapshot): string {
  const provider = getMentionProvider(snapshot.kind);
  return provider.renderForPrompt(snapshot);
}

export function renderOutlineMentionSnapshotsForPromptSection(snapshots: OutlineMentionSnapshot[]): string {
  if (snapshots.length === 0) {
    return '（无）';
  }

  return snapshots
    .map(snapshot => renderOutlineMentionSnapshotForPrompt(snapshot))
    .join('\n\n');
}
