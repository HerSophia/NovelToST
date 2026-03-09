import type { ChapterDetail, MasterOutlineNode } from '../../../types/outline';
import { findMasterOutlineNodeByChapter } from '../../../core/outline-node-match';
import {
  createDefaultChapterDetail,
  normalizeChapter,
  normalizeChapterDetail,
} from '../core/outline.domain';
import type { OutlineMutationContext } from './context';

export function createChapterDetailSlice(context: OutlineMutationContext) {
  const replaceChapterDetails = (details: ChapterDetail[]) => {
    const nextDetails: Record<number, ChapterDetail> = {};
    for (const detail of details) {
      const normalized = normalizeChapterDetail(detail, detail.chapter);
      nextDetails[normalized.chapter] = normalized;
    }
    context.detailsByChapter.value = nextDetails;
    context.touchUpdatedAt();
  };

  const setChapterDetail = (detail: ChapterDetail) => {
    const normalized = normalizeChapterDetail(detail, detail.chapter);
    context.detailsByChapter.value = {
      ...context.detailsByChapter.value,
      [normalized.chapter]: normalized,
    };
    context.touchUpdatedAt();
  };

  const patchChapterDetail = (chapter: number, patch: Partial<ChapterDetail>) => {
    const normalizedChapter = normalizeChapter(chapter, 1);
    const base = context.detailsByChapter.value[normalizedChapter] ?? createDefaultChapterDetail(normalizedChapter);

    const next = normalizeChapterDetail(
      {
        ...base,
        ...patch,
        chapter: normalizedChapter,
      },
      normalizedChapter,
    );

    context.detailsByChapter.value = {
      ...context.detailsByChapter.value,
      [normalizedChapter]: next,
    };
    context.touchUpdatedAt();
  };

  const removeChapterDetail = (chapter: number) => {
    const normalizedChapter = normalizeChapter(chapter, 1);
    if (!Object.prototype.hasOwnProperty.call(context.detailsByChapter.value, normalizedChapter)) {
      return;
    }

    const nextDetails = { ...context.detailsByChapter.value };
    delete nextDetails[normalizedChapter];
    context.detailsByChapter.value = nextDetails;
    context.touchUpdatedAt();
  };

  const ensureChapterDetail = (chapter: number, parentNodeId: string = ''): ChapterDetail => {
    const normalizedChapter = normalizeChapter(chapter, 1);
    const existing = context.detailsByChapter.value[normalizedChapter];
    if (existing) {
      return existing;
    }

    const created = createDefaultChapterDetail(normalizedChapter, parentNodeId);
    context.detailsByChapter.value = {
      ...context.detailsByChapter.value,
      [normalizedChapter]: created,
    };
    context.touchUpdatedAt();
    return created;
  };

  const getChapterDetail = (chapter: number): ChapterDetail | null => {
    const normalizedChapter = normalizeChapter(chapter, 1);
    return context.detailsByChapter.value[normalizedChapter] ?? null;
  };

  const findMasterNodeByChapter = (chapter: number): MasterOutlineNode | null => {
    const normalizedChapter = normalizeChapter(chapter, 1);
    return findMasterOutlineNodeByChapter(normalizedChapter, context.masterOutline.value);
  };

  return {
    replaceChapterDetails,
    setChapterDetail,
    patchChapterDetail,
    removeChapterDetail,
    ensureChapterDetail,
    getChapterDetail,
    findMasterNodeByChapter,
  };
}
