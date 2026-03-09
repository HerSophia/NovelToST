import type {
  ChapterDetail,
  EventAnnotation,
  OutlineFoundationSyncInfo,
  MasterOutlineNode,
  NarrativeCalendar,
  NarrativeTime,
  OutlineAIConfig,
  OutlineMessage,
  OutlineSession,
  OutlineMentionRef,
  OutlineMentionSnapshot,
  OutlineMentionConfig,
  OutlineSnapshot,
  Storyline,
} from '../../../types/outline';
import { normalizeChapter } from './outline.normalize';

export function cloneNarrativeCalendar(calendar: NarrativeCalendar): NarrativeCalendar {
  return {
    type: calendar.type,
    name: calendar.name,
    description: calendar.description,
    formatHint: calendar.formatHint,
  };
}

export function cloneNarrativeTime(time: NarrativeTime): NarrativeTime {
  return {
    label: time.label,
    sortKey: time.sortKey,
    note: time.note,
  };
}

export function cloneEventAnnotation(event: EventAnnotation): EventAnnotation {
  return {
    tag: event.tag,
    label: event.label,
    description: event.description,
    extra: { ...event.extra },
  };
}

export function cloneStoryline(storyline: Storyline): Storyline {
  return {
    id: storyline.id,
    type: storyline.type,
    title: storyline.title,
    description: storyline.description,
    color: storyline.color,
    sortOrder: storyline.sortOrder,
    status: storyline.status,
    extra: { ...storyline.extra },
    themeKeywords: [...(storyline.themeKeywords ?? [])],
    linkedCharacters: [...(storyline.linkedCharacters ?? [])],
  };
}

export function cloneMasterOutlineNode(node: MasterOutlineNode): MasterOutlineNode {
  return {
    id: node.id,
    title: node.title,
    summary: node.summary,
    chapterStart: node.chapterStart,
    chapterEnd: node.chapterEnd,
    turningPoints: [...node.turningPoints],
    storylineId: node.storylineId ?? '',
    phase: node.phase ?? 'custom',
    events: (node.events ?? []).map(cloneEventAnnotation),
    timeStart: node.timeStart ? cloneNarrativeTime(node.timeStart) : null,
    timeEnd: node.timeEnd ? cloneNarrativeTime(node.timeEnd) : null,
    keywords: [...(node.keywords ?? [])],
    characters: [...(node.characters ?? [])],
    locations: [...(node.locations ?? [])],
    dependsOn: [...(node.dependsOn ?? [])],
    notes: node.notes ?? '',
    extra: { ...(node.extra ?? {}) },
    status: node.status,
    tensionLevel: node.tensionLevel,
    emotionalTone: node.emotionalTone ?? '',
    foreshadowing: [...(node.foreshadowing ?? [])],
    payoffs: [...(node.payoffs ?? [])],
  };
}

export function cloneChapterDetail(detail: ChapterDetail): ChapterDetail {
  return {
    chapter: detail.chapter,
    parentNodeId: detail.parentNodeId,
    title: detail.title,
    goal: detail.goal,
    conflict: detail.conflict,
    beats: [...detail.beats],
    mustInclude: [...detail.mustInclude],
    mustAvoid: [...detail.mustAvoid],
    relatedNodeIds: [...(detail.relatedNodeIds ?? [])],
    pov: detail.pov ?? '',
    narrativeTime: detail.narrativeTime ? cloneNarrativeTime(detail.narrativeTime) : null,
    emotionalArc: detail.emotionalArc ?? '',
    endHook: detail.endHook ?? '',
    notes: detail.notes ?? '',
    extra: { ...(detail.extra ?? {}) },
    status: detail.status,
    wordCountEstimate: detail.wordCountEstimate,
    pacing: detail.pacing ?? '',
    sceneBreakdown: [...(detail.sceneBreakdown ?? [])],
  };
}

export function cloneDetailsRecord(details: Record<number, ChapterDetail>): Record<number, ChapterDetail> {
  const cloned: Record<number, ChapterDetail> = {};
  for (const [chapterKey, detail] of Object.entries(details)) {
    const chapter = normalizeChapter(Number(chapterKey), detail.chapter);
    cloned[chapter] = cloneChapterDetail(detail);
  }
  return cloned;
}

export function cloneOutlineMessage(message: OutlineMessage): OutlineMessage {
  const cloned: OutlineMessage = {
    id: message.id,
    role: message.role,
    text: message.text,
    createdAt: message.createdAt,
  };

  if (Object.prototype.hasOwnProperty.call(message, 'parseError')) {
    cloned.parseError = message.parseError ?? null;
  }

  if (typeof message.rawResponse === 'string') {
    cloned.rawResponse = message.rawResponse;
  }

  if (Array.isArray(message.mentions) && message.mentions.length > 0) {
    cloned.mentions = message.mentions.map((mention): OutlineMentionRef => ({ ...mention }));
  }

  if (Array.isArray(message.mentionSnapshots) && message.mentionSnapshots.length > 0) {
    cloned.mentionSnapshots = message.mentionSnapshots.map(
      (snapshot): OutlineMentionSnapshot => ({
        ...snapshot,
      }),
    );
  }

  if (Array.isArray(message.mentionWarnings) && message.mentionWarnings.length > 0) {
    cloned.mentionWarnings = [...message.mentionWarnings];
  }

  return cloned;
}

export function cloneOutlineSnapshot(snapshot: OutlineSnapshot): OutlineSnapshot {
  return {
    id: snapshot.id,
    version: snapshot.version,
    storylines: snapshot.storylines.map(cloneStoryline),
    masterOutline: snapshot.masterOutline.map(cloneMasterOutlineNode),
    detailsByChapter: cloneDetailsRecord(snapshot.detailsByChapter),
    createdAt: snapshot.createdAt,
  };
}

export function cloneOutlineSession(session: OutlineSession): OutlineSession {
  return {
    id: session.id,
    type: session.type,
    title: session.title,
    seed: session.seed,
    targetChapter: session.targetChapter,
    messages: session.messages.map(cloneOutlineMessage),
    snapshots: session.snapshots.map(cloneOutlineSnapshot),
    activeSnapshotId: session.activeSnapshotId,
    appliedSnapshotId: session.appliedSnapshotId,
    updatedAt: session.updatedAt,
  };
}

export function cloneAIConfig(ai: OutlineAIConfig): OutlineAIConfig {
  return {
    enabled: ai.enabled,
    provider: ai.provider,
    model: ai.model,
    temperature: ai.temperature,
  };
}

export function cloneOutlineMentionConfig(config: OutlineMentionConfig): OutlineMentionConfig {
  return {
    worldbookEntryLabel: {
      includeWorldbookName: config.worldbookEntryLabel.includeWorldbookName,
      includeTriggerKeywords: config.worldbookEntryLabel.includeTriggerKeywords,
      includeStrategyType: config.worldbookEntryLabel.includeStrategyType,
    },
  };
}

export function cloneFoundationSyncInfo(info: OutlineFoundationSyncInfo): OutlineFoundationSyncInfo {
  return {
    syncedAt: info.syncedAt,
    logline: info.logline,
    coreConflict: info.coreConflict,
    emotionalTone: info.emotionalTone,
  };
}
