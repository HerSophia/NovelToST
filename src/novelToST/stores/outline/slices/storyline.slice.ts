import type { Storyline } from '../../../types/outline';
import { ensureMainStoryline, normalizeStoryline } from '../core/outline.domain';
import type { OutlineMutationContext } from './context';

export function createStorylineSlice(context: OutlineMutationContext) {
  const createStoryline = (seed: Partial<Storyline> = {}): Storyline => {
    const nextSortOrder = context.storylines.value.reduce(
      (maxSortOrder, storyline) => Math.max(maxSortOrder, storyline.sortOrder),
      -1,
    ) + 1;
    const created = normalizeStoryline({
      ...seed,
      type: seed.type ?? (context.storylines.value.some(item => item.type === 'main') ? 'subplot' : 'main'),
      title: typeof seed.title === 'string' && seed.title.trim() ? seed.title : `叙事线 ${context.storylines.value.length + 1}`,
      sortOrder: seed.sortOrder ?? nextSortOrder,
      status: seed.status ?? 'draft',
    });

    context.storylines.value = [...context.storylines.value, created];
    context.touchUpdatedAt();
    return created;
  };

  const patchStoryline = (storylineId: string, patch: Partial<Storyline>) => {
    const normalizedStorylineId = storylineId.trim();
    if (!normalizedStorylineId) {
      return;
    }

    context.storylines.value = context.storylines.value.map(storyline => {
      if (storyline.id !== normalizedStorylineId) {
        return storyline;
      }

      return normalizeStoryline({
        ...storyline,
        ...patch,
        id: storyline.id,
      });
    });

    context.touchUpdatedAt();
  };

  const removeStoryline = (storylineId: string) => {
    const normalizedStorylineId = storylineId.trim();
    if (!normalizedStorylineId || context.storylines.value.length <= 1) {
      return;
    }

    if (!context.storylines.value.some(storyline => storyline.id === normalizedStorylineId)) {
      return;
    }

    const nextStorylines = ensureMainStoryline(
      context.storylines.value.filter(storyline => storyline.id !== normalizedStorylineId),
    );
    const fallbackStorylineId =
      nextStorylines.find(storyline => storyline.type === 'main')?.id ?? nextStorylines[0]?.id ?? '';
    const nextStorylineIds = new Set(nextStorylines.map(storyline => storyline.id));

    context.masterOutline.value = context.masterOutline.value.map(node => {
      const normalizedStorylineIdOnNode = node.storylineId && nextStorylineIds.has(node.storylineId)
        ? node.storylineId
        : fallbackStorylineId;

      if (node.storylineId === normalizedStorylineId || normalizedStorylineIdOnNode !== node.storylineId) {
        return {
          ...node,
          storylineId: normalizedStorylineIdOnNode,
        };
      }

      return node;
    });

    context.storylines.value = nextStorylines;

    if (context.lockedStorylineIds.value.includes(normalizedStorylineId)) {
      context.lockedStorylineIds.value = context.lockedStorylineIds.value.filter(id => id !== normalizedStorylineId);
    }
    context.touchUpdatedAt();
  };

  return {
    createStoryline,
    patchStoryline,
    removeStoryline,
  };
}
