import { matchMasterOutlineNodeByChapter } from '@/novelToST/core/outline-node-match';
import type { MasterOutlineNode } from '@/novelToST/types/outline';

function createNode(overrides: Partial<MasterOutlineNode> & Pick<MasterOutlineNode, 'id'>): MasterOutlineNode {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    summary: overrides.summary ?? '',
    chapterStart: overrides.chapterStart ?? 1,
    chapterEnd: overrides.chapterEnd ?? 1,
    turningPoints: overrides.turningPoints ?? [],
    status: overrides.status ?? 'draft',
  };
}

describe('outline-node-match', () => {
  it('should prefer covered node with smaller span when chapter falls into overlap', () => {
    const nodes = [
      createNode({ id: 'wide', chapterStart: 1, chapterEnd: 10 }),
      createNode({ id: 'narrow', chapterStart: 4, chapterEnd: 6 }),
    ];

    const result = matchMasterOutlineNodeByChapter(5, nodes);

    expect(result.mode).toBe('covered');
    expect(result.node?.id).toBe('narrow');
  });

  it('should resolve covered tie by center distance first', () => {
    const nodes = [
      createNode({ id: 'left', chapterStart: 1, chapterEnd: 5 }),
      createNode({ id: 'right', chapterStart: 3, chapterEnd: 7 }),
    ];

    const result = matchMasterOutlineNodeByChapter(5, nodes);

    expect(result.mode).toBe('covered');
    expect(result.node?.id).toBe('right');
  });

  it('should use nearest node when chapter is in uncovered gap', () => {
    const nodes = [
      createNode({ id: 'front', chapterStart: 1, chapterEnd: 2 }),
      createNode({ id: 'back', chapterStart: 6, chapterEnd: 8 }),
    ];

    const result = matchMasterOutlineNodeByChapter(4, nodes);

    expect(result.mode).toBe('nearest');
    expect(result.node?.id).toBe('front');
  });

  it('should return none when no node exists', () => {
    const result = matchMasterOutlineNodeByChapter(3, []);

    expect(result.mode).toBe('none');
    expect(result.node).toBeNull();
  });
});
