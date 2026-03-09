import { z } from 'zod';

export const OutlineNodeStatusSchema = z.enum(['draft', 'approved']);
export const OutlineMissingDetailPolicySchema = z.enum(['warn_fallback', 'strict_block']);
export const CalendarTypeSchema = z.enum(['gregorian', 'relative', 'custom']);
export const NarrativePhaseSchema = z.enum(['setup', 'confrontation', 'climax', 'resolution', 'custom']);
export const EventTagSchema = z.enum([
  'turning_point',
  'reveal',
  'confrontation',
  'resolution',
  'foreshadowing',
  'callback',
  'milestone',
  'custom',
]);

export const NarrativeCalendarSchema = z
  .object({
    type: CalendarTypeSchema.default('relative'),
    name: z.string().default(''),
    description: z.string().default(''),
    formatHint: z.string().default(''),
  })
  .prefault({});

export const NarrativeTimeSchema = z
  .object({
    label: z.string().default(''),
    sortKey: z.number().default(0),
    note: z.string().default(''),
  })
  .prefault({});

export const EventAnnotationSchema = z
  .object({
    tag: EventTagSchema.default('custom'),
    label: z.string().default(''),
    description: z.string().default(''),
    extra: z.record(z.string(), z.unknown()).default({}),
  })
  .prefault({});

export const StorylineSchema = z
  .object({
    id: z.string().default(''),
    type: z.enum(['main', 'subplot', 'parallel']).default('main'),
    title: z.string().default(''),
    description: z.string().default(''),
    color: z.string().default(''),
    sortOrder: z.number().int().default(0),
    status: OutlineNodeStatusSchema.default('draft'),
    extra: z.record(z.string(), z.unknown()).default({}),
    themeKeywords: z.array(z.string()).default([]),
    linkedCharacters: z.array(z.string()).default([]),
  })
  .prefault({});

export const MasterOutlineNodeSchema = z
  .object({
    id: z.string().default(''),
    title: z.string().default(''),
    summary: z.string().default(''),
    chapterStart: z.number().int().min(1).default(1),
    chapterEnd: z.number().int().min(1).default(1),
    turningPoints: z.array(z.string()).default([]),
    storylineId: z.string().default(''),
    phase: NarrativePhaseSchema.default('custom'),
    events: z.array(EventAnnotationSchema).default([]),
    timeStart: NarrativeTimeSchema.nullable().default(null),
    timeEnd: NarrativeTimeSchema.nullable().default(null),
    keywords: z.array(z.string()).default([]),
    characters: z.array(z.string()).default([]),
    locations: z.array(z.string()).default([]),
    dependsOn: z.array(z.string()).default([]),
    notes: z.string().default(''),
    extra: z.record(z.string(), z.unknown()).default({}),
    status: OutlineNodeStatusSchema.default('draft'),
    tensionLevel: z.number().int().min(1).max(10).optional(),
    emotionalTone: z.string().default(''),
    foreshadowing: z.array(z.string()).default([]),
    payoffs: z.array(z.string()).default([]),
  })
  .prefault({});

export const ChapterDetailSchema = z
  .object({
    chapter: z.number().int().min(1).default(1),
    parentNodeId: z.string().default(''),
    title: z.string().default(''),
    goal: z.string().default(''),
    conflict: z.string().default(''),
    beats: z.array(z.string()).default([]),
    mustInclude: z.array(z.string()).default([]),
    mustAvoid: z.array(z.string()).default([]),
    relatedNodeIds: z.array(z.string()).default([]),
    pov: z.string().default(''),
    narrativeTime: NarrativeTimeSchema.nullable().default(null),
    emotionalArc: z.string().default(''),
    endHook: z.string().default(''),
    notes: z.string().default(''),
    extra: z.record(z.string(), z.unknown()).default({}),
    status: OutlineNodeStatusSchema.default('draft'),
    wordCountEstimate: z.number().int().min(0).optional(),
    pacing: z.string().default(''),
    sceneBreakdown: z.array(z.string()).default([]),
  })
  .prefault({});

export const OutlineSessionTypeSchema = z.enum(['outline_chat', 'chapter_detail', 'consistency_check']);

export const OutlineMessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const OutlineMentionKindSchema = z.enum(['worldbook', 'worldbook_entry', 'foundation', 'storyline', 'node', 'detail']);

export const OutlineMentionRefSchema = z
  .object({
    kind: OutlineMentionKindSchema.default('node'),
    id: z.string().default(''),
    label: z.string().default(''),
  })
  .prefault({});

export const OutlineMentionSnapshotSchema = z
  .object({
    kind: OutlineMentionKindSchema.default('node'),
    id: z.string().default(''),
    label: z.string().default(''),
    frozenAt: z.string().default(''),
    content: z.string().default(''),
  })
  .prefault({});

export const OutlineWorldbookEntryLabelConfigSchema = z
  .object({
    includeWorldbookName: z.boolean().default(true),
    includeTriggerKeywords: z.boolean().default(false),
    includeStrategyType: z.boolean().default(false),
  })
  .prefault({});

export const OutlineMentionConfigSchema = z
  .object({
    worldbookEntryLabel: OutlineWorldbookEntryLabelConfigSchema,
  })
  .prefault({});

export const OutlineMessageSchema = z
  .object({
    id: z.string().default(''),
    role: OutlineMessageRoleSchema.default('user'),
    text: z.string().default(''),
    createdAt: z.string().default(''),
    parseError: z.string().nullable().optional(),
    rawResponse: z.string().optional(),
    mentions: z.array(OutlineMentionRefSchema).optional(),
    mentionSnapshots: z.array(OutlineMentionSnapshotSchema).optional(),
    mentionWarnings: z.array(z.string()).optional(),
  })
  .prefault({});

export const OutlineSnapshotSchema = z
  .object({
    id: z.string().default(''),
    version: z.number().int().min(1).default(1),
    storylines: z.array(StorylineSchema).default([]),
    masterOutline: z.array(MasterOutlineNodeSchema).default([]),
    detailsByChapter: z.record(z.string(), ChapterDetailSchema).default({}),
    createdAt: z.string().default(''),
  })
  .prefault({});

export const OutlineSessionSchema = z
  .object({
    id: z.string().default(''),
    type: OutlineSessionTypeSchema.default('outline_chat'),
    title: z.string().default(''),
    seed: z.string().default(''),
    targetChapter: z.number().int().min(1).nullable().default(null),
    messages: z.array(OutlineMessageSchema).default([]),
    snapshots: z.array(OutlineSnapshotSchema).default([]),
    activeSnapshotId: z.string().nullable().default(null),
    appliedSnapshotId: z.string().nullable().default(null),
    updatedAt: z.string().default(''),
  })
  .prefault({});

export const OutlineAIConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    provider: z.enum(['tavern', 'custom']).default('tavern'),
    model: z.string().default(''),
    temperature: z.number().min(0).max(2).default(0.8),
  })
  .prefault({});

export const OutlineFoundationSyncInfoSchema = z
  .object({
    syncedAt: z.string().default(''),
    logline: z.string().default(''),
    coreConflict: z.string().default(''),
    emotionalTone: z.string().default(''),
  })
  .prefault({});

export const OutlineStateSchema = z
  .object({
    enabled: z.boolean().default(false),
    missingDetailPolicy: OutlineMissingDetailPolicySchema.default('warn_fallback'),
    masterOutline: z.array(MasterOutlineNodeSchema).default([]),
    storylines: z.array(StorylineSchema).default([]),
    sessions: z.array(OutlineSessionSchema).default([]),
    activeSessionId: z.string().nullable().default(null),
    mentionConfig: OutlineMentionConfigSchema,
    detailsByChapter: z.record(z.string(), ChapterDetailSchema).default({}),
    ai: OutlineAIConfigSchema,
    updatedAt: z.string().default(''),
    lockedStorylineIds: z.array(z.string()).default([]),
    lockedNodeIds: z.array(z.string()).default([]),
    totalChapterTarget: z.number().int().min(0).default(0),
    calendar: NarrativeCalendarSchema.nullable().default(null),
    synopsis: z.string().default(''),
    foundationSyncInfo: OutlineFoundationSyncInfoSchema.nullable().default(null),
  })
  .prefault({});
