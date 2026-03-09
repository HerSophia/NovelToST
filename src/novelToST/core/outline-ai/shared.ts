import { z } from 'zod';
import type {
  ChapterDetail,
  EventAnnotation,
  MasterOutlineNode,
  NarrativePhase,
  NarrativeTime,
  OutlineNodeStatus,
  Storyline,
} from '../../types/outline';

const OutlineNodeStatusSchema = z.enum(['draft', 'approved']);
const EventTagSchema = z.enum([
  'turning_point',
  'reveal',
  'confrontation',
  'resolution',
  'foreshadowing',
  'callback',
  'milestone',
  'custom',
]);

const NarrativeTimeOutputSchema = z
  .object({
    label: z.string().default(''),
    sortKey: z.number().default(0),
    note: z.string().default(''),
  })
  .prefault({});

const EventAnnotationOutputSchema = z
  .object({
    tag: EventTagSchema.default('custom'),
    label: z.string().default(''),
    description: z.string().default(''),
    extra: z.record(z.string(), z.unknown()).default({}),
  })
  .prefault({});

const StorylineOutputSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(['main', 'subplot', 'parallel']).default('main'),
    title: z.string().default(''),
    description: z.string().default(''),
    color: z.string().default(''),
    sortOrder: z.number().int().default(0),
    status: OutlineNodeStatusSchema.optional().default('draft'),
    extra: z.record(z.string(), z.unknown()).default({}),
  })
  .prefault({});

const MasterOutlineNodeOutputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().default(''),
    summary: z.string().default(''),
    chapterStart: z.number().int().min(1).default(1),
    chapterEnd: z.number().int().min(1).default(1),
    turningPoints: z.unknown().optional(),
    storylineId: z.string().default(''),
    phase: z.unknown().optional(),
    events: z.unknown().optional(),
    timeStart: z.unknown().optional(),
    timeEnd: z.unknown().optional(),
    keywords: z.unknown().optional(),
    characters: z.unknown().optional(),
    locations: z.unknown().optional(),
    dependsOn: z.unknown().optional(),
    notes: z.string().default(''),
    extra: z.record(z.string(), z.unknown()).default({}),
    status: OutlineNodeStatusSchema.optional().default('draft'),
  })
  .prefault({});

const ChapterDetailOutputSchema = z
  .object({
    chapter: z.number().int().min(1).default(1),
    parentNodeId: z.string().default(''),
    title: z.string().default(''),
    goal: z.string().default(''),
    conflict: z.string().default(''),
    beats: z.unknown().optional(),
    mustInclude: z.unknown().optional(),
    mustAvoid: z.unknown().optional(),
    relatedNodeIds: z.unknown().optional(),
    pov: z.string().default(''),
    narrativeTime: z.unknown().optional(),
    emotionalArc: z.string().default(''),
    endHook: z.string().default(''),
    notes: z.string().default(''),
    extra: z.record(z.string(), z.unknown()).default({}),
    status: OutlineNodeStatusSchema.optional().default('draft'),
  })
  .prefault({});

export type ExtractedItems = {
  hasField: boolean;
  items: unknown[];
};

export type OutlineCrudCommandOp = 'create' | 'update' | 'delete';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeStringList(values: unknown): string[] {
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

export function normalizeUniqueStringList(values: unknown): string[] {
  return [...new Set(normalizeStringList(values))];
}

export function normalizeStatus(value: unknown): OutlineNodeStatus {
  return value === 'approved' ? 'approved' : 'draft';
}

export function normalizeNarrativePhase(value: unknown): NarrativePhase {
  if (typeof value !== 'string') {
    return 'custom';
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized) {
    return 'custom';
  }

  if (
    normalized === 'setup' ||
    normalized === 'opening' ||
    normalized === 'beginning' ||
    normalized === 'start' ||
    normalized === 'introduction' ||
    normalized === '开端' ||
    normalized === '起始'
  ) {
    return 'setup';
  }

  if (normalized === 'confrontation' || normalized === 'development' || normalized === 'middle' || normalized === '发展') {
    return 'confrontation';
  }

  if (normalized === 'climax' || normalized === 'peak' || normalized === '高潮') {
    return 'climax';
  }

  if (normalized === 'resolution' || normalized === 'ending' || normalized === '结局' || normalized === '收束') {
    return 'resolution';
  }

  return 'custom';
}

export function normalizeChapter(value: unknown, fallback: number = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Math.max(1, Math.trunc(fallback));
  }

  return Math.max(1, Math.trunc(value));
}

export function normalizeExtraRecord(raw: unknown): Record<string, unknown> {
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

export function normalizeNarrativeTime(raw: unknown): NarrativeTime | null {
  if (raw == null) {
    return null;
  }

  if (typeof raw === 'string') {
    const label = raw.trim();
    if (!label) {
      return null;
    }

    return {
      label,
      sortKey: 0,
      note: '',
    };
  }

  const parsed = NarrativeTimeOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  return {
    label: parsed.data.label.trim(),
    sortKey: Number.isFinite(parsed.data.sortKey) ? parsed.data.sortKey : 0,
    note: parsed.data.note.trim(),
  };
}

export function normalizeEventAnnotations(raw: unknown): EventAnnotation[] {
  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        if (typeof item === 'string') {
          const description = item.trim();
          if (!description) {
            return null;
          }

          return {
            tag: 'turning_point' as const,
            label: '',
            description,
            extra: {},
          } satisfies EventAnnotation;
        }

        const parsed = EventAnnotationOutputSchema.safeParse(item);
        if (!parsed.success) {
          return null;
        }

        return {
          tag: parsed.data.tag,
          label: parsed.data.label.trim(),
          description: parsed.data.description.trim(),
          extra: normalizeExtraRecord(parsed.data.extra),
        } satisfies EventAnnotation;
      })
      .filter((event): event is EventAnnotation => event !== null)
      .filter(event => event.description.length > 0 || event.label.length > 0 || Object.keys(event.extra).length > 0);
  }

  return normalizeStringList(raw).map(description => ({
    tag: 'turning_point' as const,
    label: '',
    description,
    extra: {},
  }));
}

export function normalizeStorylineFromItem(item: unknown, index: number): Storyline | null {
  const parsed = StorylineOutputSchema.safeParse(item);
  if (!parsed.success) {
    return null;
  }

  const data = parsed.data;

  return {
    id: data.id?.trim() || `outline-ai-storyline-${index + 1}`,
    type: data.type,
    title: data.title.trim(),
    description: data.description.trim(),
    color: data.color.trim(),
    sortOrder: Number.isFinite(data.sortOrder) ? Math.trunc(data.sortOrder) : index,
    status: normalizeStatus(data.status),
    extra: normalizeExtraRecord(data.extra),
  };
}

export function normalizeMasterOutlineNodeFromItem(
  item: unknown,
  index: number,
  chapterCount: number,
): MasterOutlineNode | null {
  const parsed = MasterOutlineNodeOutputSchema.safeParse(item);
  if (!parsed.success) {
    return null;
  }

  const data = parsed.data;
  const chapterStart = Math.min(chapterCount, normalizeChapter(data.chapterStart, 1));
  const chapterEnd = Math.max(chapterStart, Math.min(chapterCount, normalizeChapter(data.chapterEnd, chapterStart)));

  const turningPoints = normalizeStringList(data.turningPoints);
  const events = normalizeEventAnnotations(data.events);
  const resolvedTurningPoints =
    turningPoints.length > 0 ? turningPoints : events.map(event => event.description).filter(Boolean);
  const resolvedEvents =
    events.length > 0
      ? events
      : resolvedTurningPoints.map(description => ({
          tag: 'turning_point' as const,
          label: '',
          description,
          extra: {},
        }));

  return {
    id: data.id?.trim() || `outline-ai-node-${index + 1}`,
    title: data.title.trim(),
    summary: data.summary.trim(),
    chapterStart,
    chapterEnd,
    turningPoints: resolvedTurningPoints,
    storylineId: data.storylineId.trim(),
    phase: normalizeNarrativePhase(data.phase),
    events: resolvedEvents,
    timeStart: normalizeNarrativeTime(data.timeStart),
    timeEnd: normalizeNarrativeTime(data.timeEnd),
    keywords: normalizeUniqueStringList(data.keywords),
    characters: normalizeUniqueStringList(data.characters),
    locations: normalizeUniqueStringList(data.locations),
    dependsOn: normalizeUniqueStringList(data.dependsOn),
    notes: data.notes.trim(),
    extra: normalizeExtraRecord(data.extra),
    status: normalizeStatus(data.status),
  };
}

export function normalizeChapterDetailFromItem(item: unknown, fallbackChapter: number): ChapterDetail | null {
  const parsed = ChapterDetailOutputSchema.safeParse(item);
  if (!parsed.success) {
    return null;
  }

  const data = parsed.data;

  return {
    chapter: normalizeChapter(data.chapter, fallbackChapter),
    parentNodeId: data.parentNodeId.trim(),
    title: data.title.trim(),
    goal: data.goal.trim(),
    conflict: data.conflict.trim(),
    beats: normalizeStringList(data.beats),
    mustInclude: normalizeStringList(data.mustInclude),
    mustAvoid: normalizeStringList(data.mustAvoid),
    relatedNodeIds: normalizeUniqueStringList(data.relatedNodeIds),
    pov: data.pov.trim(),
    narrativeTime: normalizeNarrativeTime(data.narrativeTime),
    emotionalArc: data.emotionalArc.trim(),
    endHook: data.endHook.trim(),
    notes: data.notes.trim(),
    extra: normalizeExtraRecord(data.extra),
    status: normalizeStatus(data.status),
  };
}

export function extractGenericCommandItems(payload: unknown): ExtractedItems {
  if (!isRecord(payload)) {
    return {
      hasField: false,
      items: [],
    };
  }

  if (Array.isArray(payload.commands)) {
    return {
      hasField: true,
      items: payload.commands,
    };
  }

  const outlineSection = payload.outline;
  if (isRecord(outlineSection) && Array.isArray(outlineSection.commands)) {
    return {
      hasField: true,
      items: outlineSection.commands,
    };
  }

  return {
    hasField: false,
    items: [],
  };
}

export function normalizeCrudCommandOperation(raw: unknown): OutlineCrudCommandOp | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'create' || normalized === 'c') {
    return 'create';
  }

  if (normalized === 'update' || normalized === 'u') {
    return 'update';
  }

  if (normalized === 'delete' || normalized === 'd') {
    return 'delete';
  }

  return null;
}
