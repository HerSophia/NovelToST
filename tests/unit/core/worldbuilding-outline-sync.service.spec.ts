import { syncCommittedCandidatesToFoundation } from '@/novelToST/core/worldbuilding-outline-sync.service';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import type { CommittedWorldbookCandidate } from '@/novelToST/core/worldbook-commit.service';

function createCommittedCandidate(overrides: Partial<CommittedWorldbookCandidate>): CommittedWorldbookCandidate {
  return {
    candidateId: overrides.candidateId ?? 'candidate-default',
    category: overrides.category ?? '设定',
    originalName: overrides.originalName ?? '默认条目',
    resolvedName: overrides.resolvedName ?? overrides.originalName ?? '默认条目',
    content: overrides.content ?? '默认内容',
  };
}

describe('worldbuilding-outline-sync.service', () => {
  it('should append committed candidates into foundation buckets with dedupe', () => {
    const foundationStore = useFoundationStore();
    foundationStore.patchModule('keyRelations', {
      keyCharacters: [{ id: 'key-1', name: '林川', role: '边境侦察兵', relationArc: '' }],
    });
    foundationStore.patchModule('worldBrief', {
      requiredRules: ['旧规则：夜间宵禁'],
      forbiddenSettings: ['旧约束：禁止公开仪式'],
    });

    const receipt = syncCommittedCandidatesToFoundation([
      createCommittedCandidate({
        candidateId: 'c1',
        category: '角色',
        originalName: '林川',
        resolvedName: '林川',
        content: '边境侦察兵',
      }),
      createCommittedCandidate({
        candidateId: 'c2',
        category: '角色',
        originalName: '伊芙',
        resolvedName: '伊芙',
        content: '王都线人',
      }),
      createCommittedCandidate({
        candidateId: 'c3',
        category: '规则体系',
        originalName: '边境法则',
        resolvedName: '边境法则',
        content: '夜间宵禁',
      }),
      createCommittedCandidate({
        candidateId: 'c4',
        category: '地点',
        originalName: '灰港',
        resolvedName: '灰港',
        content: '边境港口',
      }),
    ]);

    expect(receipt.appendedCountByField).toEqual({
      protagonist: 0,
      keyCharacters: 1,
      requiredRules: 1,
      forbiddenSettings: 1,
      forbiddenPatterns: 0,
    });
    expect(receipt.appendedCount).toBe(3);
    expect(receipt.skippedCount).toBe(1);

    expect(
      foundationStore.foundation.keyRelations.keyCharacters.some(
        character => character.name === '伊芙' && character.role === '王都线人',
      ),
    ).toBe(true);
    expect(foundationStore.foundation.worldBrief.requiredRules).toContain('边境法则：夜间宵禁');
    expect(foundationStore.foundation.worldBrief.forbiddenSettings).toContain('灰港：边境港口');
  });

  it('should skip empty committed candidates and keep foundation unchanged', () => {
    const foundationStore = useFoundationStore();

    const receipt = syncCommittedCandidatesToFoundation([
      createCommittedCandidate({
        candidateId: 'c-empty',
        category: '角色',
        originalName: '   ',
        resolvedName: '   ',
        content: '   ',
      }),
    ]);

    expect(receipt.appendedCount).toBe(0);
    expect(receipt.skippedCount).toBe(1);
    expect(foundationStore.foundation.keyRelations.keyCharacters).toEqual([]);
    expect(foundationStore.foundation.worldBrief.requiredRules).toEqual([]);
    expect(foundationStore.foundation.worldBrief.forbiddenSettings).toEqual([]);
  });
});
