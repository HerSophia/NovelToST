import type {
  ChapterDetail,
  OutlineSession,
  OutlineState,
} from '../../../types/outline';
import { createOutlineSessionId } from './outline.ids';
import { OutlineStateSchema } from './outline.schemas';
import { normalizeTimestamp } from './outline.time';
import {
  ensureMainStoryline,
  normalizeAIConfig,
  normalizeChapter,
  normalizeDetailsRecord,
  normalizeMasterOutlineNodesForStorylines,
  normalizeOutlineSession,
  normalizeOutlineMentionConfig,
  normalizeNarrativeCalendar,
  normalizeFoundationSyncInfo,
  normalizeStoryline,
  normalizeUniqueStringList,
} from './outline.normalize';
import { MAX_OUTLINE_SESSIONS } from './outline.constants';

const capToLatest = <T>(items: T[], maxCount: number): T[] => {
  if (maxCount <= 0) {
    return [];
  }

  return items.length > maxCount ? items.slice(-maxCount) : items;
};

export function createDefaultOutlineState(): OutlineState {
  return {
    enabled: false,
    missingDetailPolicy: 'warn_fallback',
    masterOutline: [],
    storylines: ensureMainStoryline([]),
    sessions: [],
    activeSessionId: null,
    mentionConfig: normalizeOutlineMentionConfig({}),
    detailsByChapter: {},
    ai: normalizeAIConfig({}),
    updatedAt: normalizeTimestamp(''),
    lockedStorylineIds: [],
    lockedNodeIds: [],
    totalChapterTarget: 0,
    calendar: null,
    synopsis: '',
    foundationSyncInfo: null,
  };
}

export function createDefaultChapterDetail(chapter: number, parentNodeId: string = ''): ChapterDetail {
  return {
    chapter: normalizeChapter(chapter, 1),
    parentNodeId: parentNodeId.trim(),
    title: '',
    goal: '',
    conflict: '',
    beats: [],
    mustInclude: [],
    mustAvoid: [],
    relatedNodeIds: [],
    pov: '',
    narrativeTime: null,
    emotionalArc: '',
    endHook: '',
    notes: '',
    extra: {},
    status: 'draft',
    wordCountEstimate: undefined,
    pacing: '',
    sceneBreakdown: [],
  };
}

export function normalizeOutlineState(raw: unknown): OutlineState {
  const parsed = OutlineStateSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn('[novelToST][outline] 大纲数据解析失败，回退默认结构', parsed.error);
    return createDefaultOutlineState();
  }

  const data = parsed.data;
  const normalizedStorylines = ensureMainStoryline(data.storylines.map(storyline => normalizeStoryline(storyline)));
  const normalizedMaster = normalizeMasterOutlineNodesForStorylines(data.masterOutline, normalizedStorylines);
  const normalizedSessions: OutlineSession[] = [];
  const sessionIds = new Set<string>();

  data.sessions.forEach(session => {
    let normalizedSession = normalizeOutlineSession(session);
    if (sessionIds.has(normalizedSession.id)) {
      normalizedSession = { ...normalizedSession, id: createOutlineSessionId() };
    }

    sessionIds.add(normalizedSession.id);
    normalizedSessions.push(normalizedSession);
  });

  const cappedSessions = capToLatest(normalizedSessions, MAX_OUTLINE_SESSIONS);
  const requestedActiveSessionId = data.activeSessionId?.trim() || null;
  const activeSessionId =
    requestedActiveSessionId && cappedSessions.some(session => session.id === requestedActiveSessionId)
      ? requestedActiveSessionId
      : (cappedSessions[0]?.id ?? null);
  const normalizedDetails = normalizeDetailsRecord(data.detailsByChapter);
  const normalizedUpdatedAt = normalizeTimestamp(data.updatedAt);
  const normalizedMentionConfig = normalizeOutlineMentionConfig(data.mentionConfig);

  return {
    enabled: data.enabled,
    missingDetailPolicy: data.missingDetailPolicy,
    masterOutline: normalizedMaster,
    storylines: normalizedStorylines,
    sessions: cappedSessions,
    activeSessionId,
    mentionConfig: normalizedMentionConfig,
    detailsByChapter: normalizedDetails,
    ai: normalizeAIConfig(data.ai),
    updatedAt: normalizedUpdatedAt,
    lockedStorylineIds: normalizeUniqueStringList(data.lockedStorylineIds),
    lockedNodeIds: normalizeUniqueStringList(data.lockedNodeIds),
    totalChapterTarget: data.totalChapterTarget,
    calendar: data.calendar ? normalizeNarrativeCalendar(data.calendar) : null,
    synopsis: data.synopsis.trim(),
    foundationSyncInfo: normalizeFoundationSyncInfo(data.foundationSyncInfo),
  };
}
