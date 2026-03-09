import type {
  ChapterDetail,
  EventAnnotation,
  MasterOutlineNode,
  NarrativeCalendar,
  NarrativeTime,
  OutlineFoundationSyncInfo,
  OutlineAIConfig,
  OutlineMessage,
  OutlineMessageRole,
  OutlineMentionKind,
  OutlineMentionRef,
  OutlineMentionSnapshot,
  OutlineMentionConfig,
  OutlineNodeStatus,
  OutlineSession,
  OutlineSessionType,
  OutlineSnapshot,
  Storyline,
} from '../../../types/outline';
import {
  createOutlineMessageId,
  createOutlineNodeId,
  createOutlineSessionId,
  createOutlineSnapshotId,
  createStorylineId,
} from './outline.ids';
import {
  ChapterDetailSchema,
  EventAnnotationSchema,
  MasterOutlineNodeSchema,
  NarrativeCalendarSchema,
  NarrativeTimeSchema,
  OutlineFoundationSyncInfoSchema,
  OutlineAIConfigSchema,
  OutlineMessageSchema,
  OutlineSessionSchema,
  OutlineSnapshotSchema,
  OutlineMentionRefSchema,
  OutlineMentionSnapshotSchema,
  OutlineMentionConfigSchema,
  StorylineSchema,
} from './outline.schemas';
import { normalizeLegacyOutlineMentionId, normalizeLegacyOutlineMentionKind } from '../../../core/foundation-legacy.service';
import { normalizeTimestamp } from './outline.time';
import { MAX_OUTLINE_SNAPSHOTS_PER_SESSION } from './outline.constants';

const capToLatest = <T>(items: T[], maxCount: number): T[] => {
  if (maxCount <= 0) {
    return [];
  }

  return items.length > maxCount ? items.slice(-maxCount) : items;
};

export function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
}

export function normalizeUniqueStringList(values: unknown): string[] {
  return [...new Set(normalizeStringList(values))];
}

export function normalizeExtraRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const result: Record<string, unknown> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return;
    }
    result[normalizedKey] = value;
  });

  return result;
}

export function normalizeNarrativeCalendar(raw: unknown): NarrativeCalendar {
  const parsed = NarrativeCalendarSchema.parse(raw);
  return {
    type: parsed.type,
    name: parsed.name.trim(),
    description: parsed.description.trim(),
    formatHint: parsed.formatHint.trim(),
  };
}

export function normalizeNarrativeTime(raw: unknown): NarrativeTime {
  const parsed = NarrativeTimeSchema.parse(raw);
  const sortKey = Number.isFinite(parsed.sortKey) ? parsed.sortKey : 0;

  return {
    label: parsed.label.trim(),
    sortKey,
    note: parsed.note.trim(),
  };
}

export function normalizeChapter(value: unknown, fallback: number = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Math.max(1, Math.trunc(fallback));
  }

  return Math.max(1, Math.trunc(value));
}

export function normalizeSnapshotVersion(value: unknown, fallback: number = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Math.max(1, Math.trunc(fallback));
  }

  return Math.max(1, Math.trunc(value));
}

export function normalizeEventAnnotation(raw: unknown): EventAnnotation {
  const parsed = EventAnnotationSchema.parse(raw);

  return {
    tag: parsed.tag,
    label: parsed.label.trim(),
    description: parsed.description.trim(),
    extra: normalizeExtraRecord(parsed.extra),
  };
}

export function normalizeEventAnnotations(raw: unknown): EventAnnotation[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map(item => normalizeEventAnnotation(item))
    .filter(item => item.description.length > 0 || item.label.length > 0 || Object.keys(item.extra).length > 0);
}

export function normalizeStoryline(raw: unknown): Storyline {
  const parsed = StorylineSchema.parse(raw);

  return {
    id: parsed.id.trim() || createStorylineId(),
    type: parsed.type,
    title: parsed.title.trim(),
    description: parsed.description.trim(),
    color: parsed.color.trim(),
    sortOrder: Number.isFinite(parsed.sortOrder) ? Math.trunc(parsed.sortOrder) : 0,
    status: parsed.status as OutlineNodeStatus,
    extra: normalizeExtraRecord(parsed.extra),
    themeKeywords: normalizeUniqueStringList(parsed.themeKeywords),
    linkedCharacters: normalizeUniqueStringList(parsed.linkedCharacters),
  };
}

export function ensureMainStoryline(storylines: Storyline[]): Storyline[] {
  if (storylines.length > 0) {
    return storylines;
  }

  return [
    {
      id: createStorylineId(),
      type: 'main',
      title: '主线',
      description: '',
      color: '',
      sortOrder: 0,
      status: 'draft',
      extra: {},
    },
  ];
}

export function normalizeMasterOutlineNode(raw: unknown): MasterOutlineNode {
  const parsed = MasterOutlineNodeSchema.parse(raw);
  const chapterStart = normalizeChapter(parsed.chapterStart, 1);
  const chapterEnd = Math.max(chapterStart, normalizeChapter(parsed.chapterEnd, chapterStart));
  const turningPoints = normalizeStringList(parsed.turningPoints);
  const parsedEvents = normalizeEventAnnotations(parsed.events);
  const events = parsedEvents.length
    ? parsedEvents
    : turningPoints.map(turningPoint => ({ tag: 'turning_point' as const, label: '', description: turningPoint, extra: {} }));
  const storylineId = parsed.storylineId.trim();

  return {
    id: parsed.id.trim() || createOutlineNodeId(),
    title: parsed.title.trim(),
    summary: parsed.summary.trim(),
    chapterStart,
    chapterEnd,
    turningPoints,
    storylineId,
    phase: parsed.phase,
    events,
    timeStart: parsed.timeStart ? normalizeNarrativeTime(parsed.timeStart) : null,
    timeEnd: parsed.timeEnd ? normalizeNarrativeTime(parsed.timeEnd) : null,
    keywords: normalizeUniqueStringList(parsed.keywords),
    characters: normalizeUniqueStringList(parsed.characters),
    locations: normalizeUniqueStringList(parsed.locations),
    dependsOn: normalizeUniqueStringList(parsed.dependsOn),
    notes: parsed.notes.trim(),
    extra: normalizeExtraRecord(parsed.extra),
    status: parsed.status,
    tensionLevel: parsed.tensionLevel != null ? Math.max(1, Math.min(10, Math.trunc(parsed.tensionLevel))) : undefined,
    emotionalTone: parsed.emotionalTone.trim(),
    foreshadowing: normalizeStringList(parsed.foreshadowing),
    payoffs: normalizeStringList(parsed.payoffs),
  };
}

export function normalizeMasterOutlineNodesForStorylines(rawNodes: unknown, targetStorylines: Storyline[]): MasterOutlineNode[] {
  if (!Array.isArray(rawNodes)) {
    return [];
  }

  const storylineIds = new Set(targetStorylines.map(storyline => storyline.id));
  const fallbackStorylineId = targetStorylines.find(storyline => storyline.type === 'main')?.id ?? targetStorylines[0]?.id ?? '';

  return rawNodes.map(node => {
    const normalizedNode = normalizeMasterOutlineNode(node);
    const normalizedStorylineId = normalizedNode.storylineId && storylineIds.has(normalizedNode.storylineId)
      ? normalizedNode.storylineId
      : fallbackStorylineId;

    return { ...normalizedNode, storylineId: normalizedStorylineId };
  });
}

export function normalizeChapterDetail(raw: unknown, fallbackChapter: number): ChapterDetail {
  const parsed = ChapterDetailSchema.parse(raw);

  return {
    chapter: normalizeChapter(parsed.chapter, fallbackChapter),
    parentNodeId: parsed.parentNodeId.trim(),
    title: parsed.title.trim(),
    goal: parsed.goal.trim(),
    conflict: parsed.conflict.trim(),
    beats: normalizeStringList(parsed.beats),
    mustInclude: normalizeStringList(parsed.mustInclude),
    mustAvoid: normalizeStringList(parsed.mustAvoid),
    relatedNodeIds: normalizeUniqueStringList(parsed.relatedNodeIds),
    pov: parsed.pov.trim(),
    narrativeTime: parsed.narrativeTime ? normalizeNarrativeTime(parsed.narrativeTime) : null,
    emotionalArc: parsed.emotionalArc.trim(),
    endHook: parsed.endHook.trim(),
    notes: parsed.notes.trim(),
    extra: normalizeExtraRecord(parsed.extra),
    status: parsed.status,
    wordCountEstimate: parsed.wordCountEstimate != null ? Math.max(0, Math.trunc(parsed.wordCountEstimate)) : undefined,
    pacing: parsed.pacing.trim(),
    sceneBreakdown: normalizeStringList(parsed.sceneBreakdown),
  };
}

export function normalizeDetailsRecord(raw: unknown): Record<number, ChapterDetail> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const details: Record<number, ChapterDetail> = {};
  for (const [key, detailValue] of Object.entries(raw as Record<string, unknown>)) {
    const keyChapter = normalizeChapter(Number(key), 1);
    const normalizedDetail = normalizeChapterDetail(detailValue, keyChapter);
    details[normalizedDetail.chapter] = normalizedDetail;
  }

  return details;
}

function normalizeOutlineMentionKind(raw: unknown): OutlineMentionKind {
  const normalized = normalizeLegacyOutlineMentionKind(raw);
  return normalized ?? 'node';
}

function normalizeOutlineMentionLabel(raw: unknown, fallbackId: string): string {
  if (typeof raw !== 'string') {
    return fallbackId;
  }

  const normalized = raw.trim();
  return normalized || fallbackId;
}

function normalizeOutlineMentionRef(raw: unknown): OutlineMentionRef {
  const rawRecord = typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const parsed = OutlineMentionRefSchema.parse({
    ...rawRecord,
    kind: normalizeOutlineMentionKind(rawRecord.kind),
    id: normalizeLegacyOutlineMentionId(rawRecord.kind, rawRecord.id),
  });
  const id = normalizeLegacyOutlineMentionId(rawRecord.kind, parsed.id);

  return {
    kind: normalizeOutlineMentionKind(parsed.kind),
    id,
    label: normalizeOutlineMentionLabel(rawRecord.label ?? parsed.label, id),
  };
}

function normalizeOutlineMentionRefs(raw: unknown): OutlineMentionRef[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const deduped = new Map<string, OutlineMentionRef>();

  raw.forEach(item => {
    try {
      const normalized = normalizeOutlineMentionRef(item);
      if (!normalized.id) {
        return;
      }
      deduped.set(`${normalized.kind}:${normalized.id}`, normalized);
    } catch {
      // 忽略无效 mention 项，避免脏数据导致整个消息归一化失败。
    }
  });

  return [...deduped.values()];
}

function normalizeOutlineMentionSnapshot(raw: unknown): OutlineMentionSnapshot {
  const rawRecord = typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const parsed = OutlineMentionSnapshotSchema.parse({
    ...rawRecord,
    kind: normalizeOutlineMentionKind(rawRecord.kind),
    id: normalizeLegacyOutlineMentionId(rawRecord.kind, rawRecord.id),
  });
  const id = normalizeLegacyOutlineMentionId(rawRecord.kind, parsed.id);

  return {
    kind: normalizeOutlineMentionKind(parsed.kind),
    id,
    label: normalizeOutlineMentionLabel(rawRecord.label ?? parsed.label, id),
    frozenAt: normalizeTimestamp(parsed.frozenAt),
    content: parsed.content,
  };
}

function normalizeOutlineMentionSnapshots(raw: unknown): OutlineMentionSnapshot[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map(item => {
      try {
        return normalizeOutlineMentionSnapshot(item);
      } catch {
        return null;
      }
    })
    .filter((item): item is OutlineMentionSnapshot => item !== null)
    .filter(item => item.id.length > 0 && item.content.trim().length > 0);
}

export function normalizeOutlineMentionConfig(raw: unknown): OutlineMentionConfig {
  const parsed = OutlineMentionConfigSchema.parse(raw);

  return {
    worldbookEntryLabel: {
      includeWorldbookName: parsed.worldbookEntryLabel.includeWorldbookName,
      includeTriggerKeywords: parsed.worldbookEntryLabel.includeTriggerKeywords,
      includeStrategyType: parsed.worldbookEntryLabel.includeStrategyType,
    },
  };
}

export function normalizeOutlineMessage(raw: unknown): OutlineMessage {
  const rawRecord =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const parsed = OutlineMessageSchema.parse(raw);

  const rawResponse =
    rawRecord && typeof rawRecord.rawResponse === 'string' && rawRecord.rawResponse.trim().length > 0
      ? rawRecord.rawResponse
      : undefined;
  const parseErrorRaw = rawRecord?.parseError;
  const parseError =
    typeof parseErrorRaw === 'string' ? (parseErrorRaw.trim() || null) : parseErrorRaw === null ? null : undefined;
  const mentions = normalizeOutlineMentionRefs(rawRecord?.mentions);
  const mentionSnapshots = normalizeOutlineMentionSnapshots(rawRecord?.mentionSnapshots);
  const mentionWarnings = normalizeUniqueStringList(rawRecord?.mentionWarnings);

  const normalized: OutlineMessage & {
    rawResponse?: string;
    parseError?: string | null;
    mentions?: OutlineMentionRef[];
    mentionSnapshots?: OutlineMentionSnapshot[];
    mentionWarnings?: string[];
  } = {
    id: parsed.id.trim() || createOutlineMessageId(),
    role: parsed.role as OutlineMessageRole,
    text: parsed.text.trim(),
    createdAt: normalizeTimestamp(parsed.createdAt),
  };

  if (rawResponse !== undefined) {
    normalized.rawResponse = rawResponse;
  }

  if (parseError !== undefined) {
    normalized.parseError = parseError;
  }

  if (mentions.length > 0) {
    normalized.mentions = mentions;
  }

  if (mentionSnapshots.length > 0) {
    normalized.mentionSnapshots = mentionSnapshots;
  }

  if (mentionWarnings.length > 0) {
    normalized.mentionWarnings = mentionWarnings;
  }

  return normalized;
}

export function normalizeOutlineSnapshot(raw: unknown): OutlineSnapshot {
  const parsed = OutlineSnapshotSchema.parse(raw);
  const normalizedStorylines = ensureMainStoryline(parsed.storylines.map(storyline => normalizeStoryline(storyline)));

  return {
    id: parsed.id.trim() || createOutlineSnapshotId(),
    version: normalizeSnapshotVersion(parsed.version, 1),
    storylines: normalizedStorylines,
    masterOutline: normalizeMasterOutlineNodesForStorylines(parsed.masterOutline, normalizedStorylines),
    detailsByChapter: normalizeDetailsRecord(parsed.detailsByChapter),
    createdAt: normalizeTimestamp(parsed.createdAt),
  };
}

export function normalizeOutlineSession(raw: unknown): OutlineSession {
  const parsed = OutlineSessionSchema.parse(raw);
  const normalizedSnapshots = parsed.snapshots.map(snapshot => normalizeOutlineSnapshot(snapshot));
  const dedupedSnapshots: OutlineSnapshot[] = [];
  const snapshotIds = new Set<string>();

  normalizedSnapshots.forEach(snapshot => {
    const nextSnapshot = snapshotIds.has(snapshot.id) ? { ...snapshot, id: createOutlineSnapshotId() } : snapshot;
    snapshotIds.add(nextSnapshot.id);
    dedupedSnapshots.push(nextSnapshot);
  });

  const cappedSnapshots = capToLatest(dedupedSnapshots, MAX_OUTLINE_SNAPSHOTS_PER_SESSION);
  const requestedActiveSnapshotId = parsed.activeSnapshotId?.trim() || null;
  const activeSnapshotId =
    requestedActiveSnapshotId && cappedSnapshots.some(snapshot => snapshot.id === requestedActiveSnapshotId)
      ? requestedActiveSnapshotId
      : (cappedSnapshots.at(-1)?.id ?? null);

  const requestedAppliedSnapshotId = parsed.appliedSnapshotId?.trim() || null;
  const appliedSnapshotId =
    requestedAppliedSnapshotId && cappedSnapshots.some(snapshot => snapshot.id === requestedAppliedSnapshotId)
      ? requestedAppliedSnapshotId
      : null;

  return {
    id: parsed.id.trim() || createOutlineSessionId(),
    type: parsed.type as OutlineSessionType,
    title: parsed.title.trim(),
    seed: parsed.seed.trim(),
    targetChapter: parsed.targetChapter === null ? null : normalizeChapter(parsed.targetChapter, 1),
    messages: parsed.messages.map(message => normalizeOutlineMessage(message)),
    snapshots: cappedSnapshots,
    activeSnapshotId,
    appliedSnapshotId,
    updatedAt: normalizeTimestamp(parsed.updatedAt),
  };
}

export function normalizeAIConfig(raw: unknown): OutlineAIConfig {
  const parsed = OutlineAIConfigSchema.parse(raw);

  return {
    enabled: true,
    provider: parsed.provider,
    model: parsed.model.trim(),
    temperature: Math.round(parsed.temperature * 100) / 100,
  };
}

export function normalizeFoundationSyncInfo(raw: unknown): OutlineFoundationSyncInfo | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const parsed = OutlineFoundationSyncInfoSchema.parse(raw);
  return {
    syncedAt: parsed.syncedAt.trim(),
    logline:parsed.logline.trim(),
    coreConflict: parsed.coreConflict.trim(),
    emotionalTone: parsed.emotionalTone.trim(),
  };
}
