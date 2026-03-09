import {
  buildCommitPreview,
  commitCandidates,
  listSelectableWorldbooks,
} from '@/novelToST/core/worldbook-commit.service';
import type { WorldbookEntryCandidate } from '@/novelToST/types/worldbuilding';
import { stMocks } from '../../setup/st-globals.mock';

function createCandidate(overrides: Partial<WorldbookEntryCandidate>): WorldbookEntryCandidate {
  return {
    id: overrides.id ?? 'candidate-default',
    category: overrides.category ?? '角色',
    name: overrides.name ?? '默认条目',
    keywords: overrides.keywords ? [...overrides.keywords] : ['默认关键词'],
    content: overrides.content ?? '默认内容',
    strategy: overrides.strategy ?? 'selective',
    checked: overrides.checked ?? true,
    conflict: overrides.conflict,
  };
}

describe('worldbook-commit.service', () => {
  it('should list selectable worldbooks with trim + dedupe', async () => {
    stMocks.getWorldbookNames.mockReturnValue([' 主世界书 ', '设定总库', '主世界书', '']);

    const names = await listSelectableWorldbooks();

    expect(names).toEqual(['主世界书', '设定总库']);
  });

  it('should build commit preview with name/keyword conflicts and rename suggestions', async () => {
    stMocks.getWorldbook.mockResolvedValue([
      {
        name: '灰港',
        strategy: {
          keys: ['灰港', '港口'],
        },
      },
      {
        name: '影盟',
        strategy: {
          keys: ['影盟', '暗网'],
        },
      },
    ]);

    const preview = await buildCommitPreview({
      worldbookName: '主世界书',
      candidates: [
        createCandidate({ id: 'c1', name: '灰港', keywords: ['灰港'], checked: true }),
        createCandidate({ id: 'c2', name: '黑港线', keywords: ['暗网', '走私'], checked: true }),
        createCandidate({ id: 'c3', name: '灰港', keywords: ['边境'], checked: true }),
        createCandidate({ id: 'c4', name: '灰港', keywords: ['旁支'], checked: false }),
      ],
      mode: 'append_rename',
    });

    expect(preview.checkedCount).toBe(3);
    expect(preview.conflictCountByKind).toEqual({
      none: 0,
      name: 2,
      keyword_overlap: 1,
    });
    expect(preview.renameCount).toBe(2);

    const previewById = new Map(preview.candidates.map(item => [item.candidate.id, item]));
    expect(previewById.get('c1')?.resolvedName).toBe('灰港 (2)');
    expect(previewById.get('c1')?.conflict.kind).toBe('name');
    expect(previewById.get('c2')?.conflict.kind).toBe('keyword_overlap');
    expect(previewById.get('c2')?.conflict.targetEntryName).toBe('影盟');
    expect(previewById.get('c3')?.resolvedName).toBe('灰港 (3)');
    expect(previewById.get('c4')?.resolvedName).toBe('灰港');
    expect(previewById.get('c4')?.willRename).toBe(false);
  });

  it('should commit checked candidates with append_rename and return receipt', async () => {
    stMocks.getWorldbook.mockResolvedValue([
      {
        name: '灰港',
        strategy: {
          keys: ['灰港'],
        },
      },
    ]);

    stMocks.createWorldbookEntries.mockResolvedValue({
      worldbook: [],
      new_entries: [{ name: '灰港 (2)' }, { name: '影盟' }],
    });

    const receipt = await commitCandidates({
      worldbookName: '主世界书',
      candidates: [
        createCandidate({ id: 'c1', name: '灰港', checked: true }),
        createCandidate({ id: 'c2', name: '影盟', checked: true }),
        createCandidate({ id: 'c3', name: '旁支', checked: false }),
      ],
    });

    expect(stMocks.createWorldbookEntries).toHaveBeenCalledTimes(1);
    expect(stMocks.createWorldbookEntries.mock.calls[0]?.[0]).toBe('主世界书');

    const payload = stMocks.createWorldbookEntries.mock.calls[0]?.[1] ?? [];
    expect(payload).toHaveLength(2);
    expect(payload[0]?.name).toBe('灰港 (2)');
    expect(payload[1]?.name).toBe('影盟');

    expect(receipt).toMatchObject({
      worldbookName: '主世界书',
      attemptedCount: 2,
      successCount: 2,
      renamedCount: 1,
      failedCount: 0,
      skippedCount: 1,
      errorMessage: null,
    });

    expect(receipt.committedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ candidateId: 'c1', resolvedName: '灰港 (2)' }),
        expect.objectContaining({ candidateId: 'c2', resolvedName: '影盟' }),
      ]),
    );
    expect(receipt.committedCandidates).toHaveLength(2);
  });

  it('should return failed receipt when createWorldbookEntries throws', async () => {
    stMocks.getWorldbook.mockResolvedValue([]);
    stMocks.createWorldbookEntries.mockRejectedValue(new Error('worldbook unavailable'));

    const receipt = await commitCandidates({
      worldbookName: '主世界书',
      candidates: [createCandidate({ id: 'c1', name: '灰港', checked: true })],
    });

    expect(receipt.successCount).toBe(0);
    expect(receipt.failedCount).toBe(1);
    expect(receipt.errorMessage).toContain('worldbook unavailable');
  });
});
