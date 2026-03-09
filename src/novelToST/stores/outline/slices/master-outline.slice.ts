import type { ChapterDetail, MasterOutlineNode } from '../../../types/outline';
import {
  cloneStoryline,
  ensureMainStoryline,
  normalizeChapter,
  normalizeMasterOutlineNode,
  normalizeMasterOutlineNodesForStorylines,
} from '../core/outline.domain';
import type { OutlineMutationContext } from './context';

export function createMasterOutlineSlice(context: OutlineMutationContext) {
  const replaceMasterOutline = (nodes: MasterOutlineNode[]) => {
    const ensuredStorylines = ensureMainStoryline(context.storylines.value.map(cloneStoryline));
    context.storylines.value = ensuredStorylines;
    context.masterOutline.value = normalizeMasterOutlineNodesForStorylines(nodes, ensuredStorylines);
    context.touchUpdatedAt();
  };

  const appendMasterOutlineNode = (seed: Partial<MasterOutlineNode> = {}): MasterOutlineNode => {
    const chapterStart = normalizeChapter(seed.chapterStart ?? 1, 1);
    const storylineIds = new Set(context.storylines.value.map(storyline => storyline.id));
    const fallbackStorylineId =
      context.storylines.value.find(storyline => storyline.type === 'main')?.id ?? context.storylines.value[0]?.id ?? '';
    const seedStorylineId = typeof seed.storylineId === 'string' ? seed.storylineId.trim() : '';
    const normalizedSeedStorylineId = seedStorylineId && storylineIds.has(seedStorylineId)
      ? seedStorylineId
      : fallbackStorylineId;

    const nextNode = normalizeMasterOutlineNode({
      ...seed,
      chapterStart,
      chapterEnd: seed.chapterEnd ?? chapterStart,
      storylineId: normalizedSeedStorylineId,
    });

    context.masterOutline.value = [...context.masterOutline.value, nextNode];
    context.touchUpdatedAt();

    return nextNode;
  };

  const patchMasterOutlineNode = (nodeId: string, patch: Partial<MasterOutlineNode>) => {
    context.masterOutline.value = context.masterOutline.value.map(node => {
      if (node.id !== nodeId) {
        return node;
      }

      const storylineIds = new Set(context.storylines.value.map(storyline => storyline.id));
      const fallbackStorylineId =
        context.storylines.value.find(storyline => storyline.type === 'main')?.id ?? context.storylines.value[0]?.id ?? '';
      const normalizedNode = normalizeMasterOutlineNode({
        ...node,
        ...patch,
        id: node.id,
      });
      const normalizedStorylineId = normalizedNode.storylineId && storylineIds.has(normalizedNode.storylineId)
        ? normalizedNode.storylineId
        : fallbackStorylineId;

      return { ...normalizedNode, storylineId: normalizedStorylineId };
    });

    context.touchUpdatedAt();
  };

  const removeMasterOutlineNode = (nodeId: string) => {
    context.masterOutline.value = context.masterOutline.value.filter(node => node.id !== nodeId);

    if (context.lockedNodeIds.value.includes(nodeId)) {
      context.lockedNodeIds.value = context.lockedNodeIds.value.filter(id => id !== nodeId);
    }

    context.detailsByChapter.value = Object.fromEntries(
      Object.entries(context.detailsByChapter.value).map(([chapter, detail]) => {
        const nextRelatedNodeIds = (detail.relatedNodeIds ?? []).filter(relatedNodeId => relatedNodeId !== nodeId);

        if (detail.parentNodeId !== nodeId && nextRelatedNodeIds.length === (detail.relatedNodeIds?.length ?? 0)) {
          return [chapter, detail] satisfies [string, ChapterDetail];
        }

        if (detail.parentNodeId !== nodeId) {
          return [chapter, { ...detail, relatedNodeIds: nextRelatedNodeIds }] satisfies [string, ChapterDetail];
        }

        return [
          chapter,
          { ...detail, parentNodeId: '', relatedNodeIds: nextRelatedNodeIds },
        ] satisfies [string, ChapterDetail];
      }),
    );

    context.touchUpdatedAt();
  };

  return {
    replaceMasterOutline,
    appendMasterOutlineNode,
    patchMasterOutlineNode,
    removeMasterOutlineNode,
  };
}
