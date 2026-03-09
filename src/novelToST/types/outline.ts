export type OutlineMissingDetailPolicy = 'warn_fallback' | 'strict_block';

export type OutlineNodeStatus = 'draft' | 'approved';

export type CalendarType = 'gregorian' | 'relative' | 'custom';

export type NarrativeCalendar = {
  type: CalendarType;
  name: string;
  description: string;
  formatHint: string;
};

export type NarrativeTime = {
  label: string;
  sortKey: number;
  note: string;
};

export type StorylineType = 'main' | 'subplot' | 'parallel';

export type Storyline = {
  id: string;
  type: StorylineType;
  title: string;
  description: string;
  color: string;
  sortOrder: number;
  status: OutlineNodeStatus;
  extra: Record<string, unknown>;

  /** v3 新增（兼容字段） */
  themeKeywords?: string[];
  linkedCharacters?: string[];
};

export type NarrativePhase = 'setup' | 'confrontation' | 'climax' | 'resolution' | 'custom';

export type EventTag =
  | 'turning_point'
  | 'reveal'
  | 'confrontation'
  | 'resolution'
  | 'foreshadowing'
  | 'callback'
  | 'milestone'
  | 'custom';

export type EventAnnotation = {
  tag: EventTag;
  label: string;
  description: string;
  extra: Record<string, unknown>;
};

export type MasterOutlineNode = {
  id: string;
  title: string;
  summary: string;
  chapterStart: number;
  chapterEnd: number;
  turningPoints: string[];
  status: OutlineNodeStatus;

  /** v2 新增（兼容字段） */
  storylineId?: string;
  phase?: NarrativePhase;
  events?: EventAnnotation[];
  timeStart?: NarrativeTime | null;
  timeEnd?: NarrativeTime | null;
  keywords?: string[];
  characters?: string[];
  locations?: string[];
  dependsOn?: string[];
  notes?: string;
  extra?: Record<string, unknown>;

  /** v3 新增（兼容字段） */
  tensionLevel?: number;
  emotionalTone?: string;
  foreshadowing?: string[];
  payoffs?: string[];
};

export type ChapterDetail = {
  chapter: number;
  parentNodeId: string;
  title: string;
  goal: string;
  conflict: string;
  beats: string[];
  mustInclude: string[];
  mustAvoid: string[];
  status: OutlineNodeStatus;

  /** v2 新增（兼容字段） */
  relatedNodeIds?: string[];
  pov?: string;
  narrativeTime?: NarrativeTime | null;
  emotionalArc?: string;
  endHook?: string;
  notes?: string;
  extra?: Record<string, unknown>;

  /** v3 新增（兼容字段） */
  wordCountEstimate?: number;
  pacing?: string;
  sceneBreakdown?: string[];
};

export type OutlineAIProvider = 'tavern' | 'custom';

export type OutlineAIConfig = {
  enabled: boolean;
  provider: OutlineAIProvider;
  model: string;
  temperature: number;
};

export type OutlineSessionType = 'outline_chat' | 'chapter_detail' | 'consistency_check';

export type OutlineMessageRole = 'user' | 'assistant' | 'system';

export type OutlineMentionKind = 'worldbook' | 'worldbook_entry' | 'foundation' | 'storyline' | 'node' | 'detail';

export type OutlineMentionRef = {
  kind: OutlineMentionKind;
  id: string;
  label: string;
};

export type OutlineMentionSnapshot = {
  kind: OutlineMentionKind;
  id: string;
  label: string;
  frozenAt: string;
  content: string;
};

export type OutlineWorldbookEntryLabelConfig = {
  includeWorldbookName: boolean;
  includeTriggerKeywords: boolean;
  includeStrategyType: boolean;
};

export type OutlineMentionConfig = {
  worldbookEntryLabel: OutlineWorldbookEntryLabelConfig;
};

export type OutlineMessage = {
  id: string;
  role: OutlineMessageRole;
  text: string;
  createdAt: string;

  /** 调试字段：结构化解析失败时记录错误与原始响应 */
  parseError?: string | null;
  /** 调试字段：结构化解析失败时保留原始返回，供“消息全文”查看 */
  rawResponse?: string;

  /** Mention 字段：发送时记录引用对象（轻量引用） */
  mentions?: OutlineMentionRef[];
  /** Mention 字段：发送时固化的引用快照（用于重试可复现） */
  mentionSnapshots?: OutlineMentionSnapshot[];
  /** Mention 字段：解析/固化过程中产生的告警 */
  mentionWarnings?: string[];
};

export type OutlineSnapshot = {
  id: string;
  version: number;
  storylines: Storyline[];
  masterOutline: MasterOutlineNode[];
  detailsByChapter: Record<number, ChapterDetail>;
  createdAt: string;
};

export type OutlineSession = {
  id: string;
  type: OutlineSessionType;
  title: string;
  seed: string;
  targetChapter: number | null;
  messages: OutlineMessage[];
  snapshots: OutlineSnapshot[];
  activeSnapshotId: string | null;
  appliedSnapshotId: string | null;
  updatedAt: string;
};

export type OutlineFoundationSyncInfo = {
  syncedAt: string;
  logline: string;
  coreConflict: string;
  emotionalTone: string;
};

export type OutlineState = {
  enabled: boolean;
  missingDetailPolicy: OutlineMissingDetailPolicy;
  masterOutline: MasterOutlineNode[];
  detailsByChapter: Record<number, ChapterDetail>;
  ai: OutlineAIConfig;
  updatedAt: string;

  /** v2 新增（兼容字段） */
  storylines?: Storyline[];
  sessions?: OutlineSession[];
  activeSessionId?: string | null;
  mentionConfig?: OutlineMentionConfig;
  lockedStorylineIds?: string[];
  lockedNodeIds?: string[];

  /** v3 新增（兼容字段） */
  totalChapterTarget?: number;
  calendar?: NarrativeCalendar | null;
  synopsis?: string;
  foundationSyncInfo?: OutlineFoundationSyncInfo | null;
};
