import type { MasterOutlineNode } from '../types/outline';

export type MasterOutlineNodeMatchMode = 'covered' | 'nearest' | 'none';

export type MasterOutlineNodeMatchResult = {
  node: MasterOutlineNode | null;
  mode: MasterOutlineNodeMatchMode;
};

type NodeRangeCandidate = {
  node: MasterOutlineNode;
  start: number;
  end: number;
  span: number;
  index: number;
};

function normalizeChapter(chapter: number): number {
  if (!Number.isFinite(chapter)) {
    return 1;
  }

  return Math.max(1, Math.trunc(chapter));
}

function buildNodeRangeCandidates(nodes: MasterOutlineNode[]): NodeRangeCandidate[] {
  return nodes.map((node, index) => {
    const start = normalizeChapter(node.chapterStart);
    const end = Math.max(start, normalizeChapter(node.chapterEnd));

    return {
      node,
      start,
      end,
      span: end - start,
      index,
    };
  });
}

function distanceToRange(targetChapter: number, rangeStart: number, rangeEnd: number): number {
  if (targetChapter < rangeStart) {
    return rangeStart - targetChapter;
  }

  if (targetChapter > rangeEnd) {
    return targetChapter - rangeEnd;
  }

  return 0;
}

function centerDistance(targetChapter: number, rangeStart: number, rangeEnd: number): number {
  const center = (rangeStart + rangeEnd) / 2;
  return Math.abs(targetChapter - center);
}

export function matchMasterOutlineNodeByChapter(
  chapter: number,
  nodes: MasterOutlineNode[],
): MasterOutlineNodeMatchResult {
  const targetChapter = normalizeChapter(chapter);
  const candidates = buildNodeRangeCandidates(nodes);

  if (candidates.length === 0) {
    return {
      node: null,
      mode: 'none',
    };
  }

  const coveredCandidates = candidates
    .filter(candidate => targetChapter >= candidate.start && targetChapter <= candidate.end)
    .sort((a, b) => {
      if (a.span !== b.span) {
        return a.span - b.span;
      }

      const centerDistanceDiff =
        centerDistance(targetChapter, a.start, a.end) - centerDistance(targetChapter, b.start, b.end);
      if (centerDistanceDiff !== 0) {
        return centerDistanceDiff;
      }

      if (a.start !== b.start) {
        return a.start - b.start;
      }

      if (a.end !== b.end) {
        return a.end - b.end;
      }

      return a.index - b.index;
    });

  if (coveredCandidates.length > 0) {
    return {
      node: coveredCandidates[0]?.node ?? null,
      mode: 'covered',
    };
  }

  const nearestCandidates = candidates
    .map(candidate => ({
      ...candidate,
      distance: distanceToRange(targetChapter, candidate.start, candidate.end),
      centerDistance: centerDistance(targetChapter, candidate.start, candidate.end),
    }))
    .sort((a, b) => {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }

      if (a.span !== b.span) {
        return a.span - b.span;
      }

      if (a.centerDistance !== b.centerDistance) {
        return a.centerDistance - b.centerDistance;
      }

      if (a.start !== b.start) {
        return a.start - b.start;
      }

      if (a.end !== b.end) {
        return a.end - b.end;
      }

      return a.index - b.index;
    });

  return {
    node: nearestCandidates[0]?.node ?? null,
    mode: 'nearest',
  };
}

export function findMasterOutlineNodeByChapter(chapter: number, nodes: MasterOutlineNode[]): MasterOutlineNode | null {
  return matchMasterOutlineNodeByChapter(chapter, nodes).node;
}
