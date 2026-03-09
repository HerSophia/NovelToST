import { computed, type Ref } from 'vue';
import type {
  ChapterDetail,
  MasterOutlineNode,
  OutlineSession,
  OutlineSnapshot,
  Storyline,
} from '../../../types/outline';
import { normalizeChapter } from '../core/outline.domain';

export interface OutlineSelectorContext {
  storylines: Ref<Storyline[]>;
  masterOutline: Ref<MasterOutlineNode[]>;
  detailsByChapter: Ref<Record<number, ChapterDetail>>;
  sessions: Ref<OutlineSession[]>;
  activeSessionId: Ref<string | null>;
}

export function createOutlineSelectors(context: OutlineSelectorContext) {
  const detailChapters = computed(() =>
    Object.keys(context.detailsByChapter.value)
      .map(chapter => normalizeChapter(Number(chapter), 1))
      .sort((a, b) => a - b),
  );

  const approvedDetailCount = computed(
    () => detailChapters.value.filter(chapter => context.detailsByChapter.value[chapter]?.status === 'approved').length,
  );

  const sortedMasterOutline = computed(() =>
    [...context.masterOutline.value].sort((a, b) => {
      if (a.chapterStart !== b.chapterStart) {
        return a.chapterStart - b.chapterStart;
      }
      return a.chapterEnd - b.chapterEnd;
    }),
  );

  const sortedStorylines = computed(() =>
    [...context.storylines.value].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.title.localeCompare(b.title, 'zh-Hans-CN');
    }),
  );

  const activeSession = computed<OutlineSession | null>(
    () => context.sessions.value.find(session => session.id === context.activeSessionId.value) ?? null,
  );

  const activeSnapshot = computed<OutlineSnapshot | null>(() => {
    const session = activeSession.value;
    if (!session) {
      return null;
    }

    return session.snapshots.find(snapshot => snapshot.id === session.activeSnapshotId) ?? session.snapshots.at(-1) ?? null;
  });

  return {
    detailChapters,
    approvedDetailCount,
    sortedMasterOutline,
    sortedStorylines,
    activeSession,
    activeSnapshot,
  };
}
