import { useWorldbuildingStore } from '@/novelToST/stores/worldbuilding.store';

describe('worldbuilding.store', () => {
  it('should create session and initialize active version', () => {
    const store = useWorldbuildingStore();

    const session = store.createSession({
      type: 'character',
      title: '  主角设定  ',
      seed: '  出生于边境  ',
    });

    expect(store.sessionCount).toBe(1);
    expect(store.activeSessionId).toBe(session.id);
    expect(store.activeSession?.title).toBe('主角设定');
    expect(store.activeSession?.seed).toBe('出生于边境');
    expect(store.activeVersion?.version).toBe(1);
    expect(store.activeVersion?.draft.summary).toBe('出生于边境');
  });

  it('should patch and remove sessions in CRUD workflow', () => {
    const store = useWorldbuildingStore();

    const sessionA = store.createSession({ type: 'character', title: '会话 A', seed: '种子 A' });
    const sessionB = store.createSession({ type: 'faction', title: '会话 B', seed: '种子 B' });

    const updatedSessionB = store.patchSession(sessionB.id, {
      type: 'location',
      title: '  已更新会话 B  ',
      seed: '  已更新种子  ',
    });

    expect(updatedSessionB?.type).toBe('location');
    expect(updatedSessionB?.title).toBe('已更新会话 B');
    expect(updatedSessionB?.seed).toBe('已更新种子');

    store.removeSession(sessionB.id);
    expect(store.sessions.map(session => session.id)).toEqual([sessionA.id]);
    expect(store.activeSessionId).toBe(sessionA.id);
  });

  it('should append versions and toggle locked fields on active version', () => {
    const store = useWorldbuildingStore();
    const session = store.createSession({ type: 'location', title: '王都' });

    const version2 = store.appendDraftVersion(session.id, {
      draft: {
        name: '王都',
        aliases: ['都城'],
        summary: '帝国中心',
        facts: ['城墙高耸'],
        constraints: ['不能使用魔法飞行'],
        relations: [{ target: '皇室', relation: '直属' }],
        extra: { climate: '温和' },
      },
    });

    expect(version2).not.toBeNull();
    expect(version2?.version).toBe(2);
    expect(store.activeVersion?.id).toBe(version2?.id);

    store.toggleLockedField(session.id, 'summary', version2?.id);
    expect(store.activeVersion?.lockedFields).toContain('summary');

    store.toggleLockedField(session.id, 'summary', version2?.id);
    expect(store.activeVersion?.lockedFields).not.toContain('summary');
  });

  it('should maintain candidates and commit preferences', () => {
    const store = useWorldbuildingStore();

    store.setCandidates([
      {
        id: '',
        category: '地点',
        name: '王都',
        keywords: ['王都', '帝都'],
        content: '帝国首都，城防森严。',
        strategy: 'constant',
        checked: true,
      },
    ]);

    expect(store.candidates).toHaveLength(1);
    const candidateId = store.candidates[0]?.id ?? '';
    expect(candidateId).not.toBe('');

    store.setCandidateChecked(candidateId, false);
    expect(store.candidates[0]?.checked).toBe(false);

    store.setSelectedWorldbookName('  主世界书  ');
    store.setCommitMode('keep_existing');

    expect(store.selectedWorldbookName).toBe('主世界书');
    expect(store.commitMode).toBe('keep_existing');
  });

  it('should hydrate state snapshot and normalize string fields', () => {
    const store = useWorldbuildingStore();

    store.hydrate({
      sessions: [
        {
          id: 'session-1',
          type: 'faction',
          title: '  灰烬议会  ',
          seed: '  古老组织  ',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              text: '  介绍一下该组织  ',
              createdAt: '2026-03-01T00:00:00.000Z',
            },
          ],
          versions: [
            {
              id: 'version-1',
              version: 1,
              draft: {
                name: '  灰烬议会  ',
                aliases: ['  议会  '],
                summary: '  掌控贸易线  ',
                facts: ['  由十三人组成  '],
                constraints: ['  禁止公开仪式  '],
                relations: [{ target: '  王室  ', relation: '  合作  ' }],
                extra: { sigil: '火焰眼' },
              },
              lockedFields: ['  summary  '],
              createdAt: '2026-03-01T00:10:00.000Z',
            },
          ],
          activeVersionId: 'version-1',
          updatedAt: '2026-03-01T00:15:00.000Z',
        },
      ],
      activeSessionId: 'session-1',
      candidates: [
        {
          id: 'candidate-1',
          category: '  势力  ',
          name: '  灰烬议会  ',
          keywords: ['  灰烬议会  ', '  议会  '],
          content: '  一个隐秘组织。  ',
          strategy: 'constant',
          checked: true,
          conflict: {
            kind: 'name',
            targetEntryName: '  灰烬议会（旧）  ',
          },
        },
      ],
      selectedWorldbookName: '  世界设定集  ',
      commitMode: 'append_rename',
      updatedAt: '2026-03-01T00:20:00.000Z',
    });

    expect(store.activeSession?.title).toBe('灰烬议会');
    expect(store.activeSession?.messages[0]?.text).toBe('介绍一下该组织');
    expect(store.activeVersion?.draft.aliases).toEqual(['议会']);
    expect(store.activeVersion?.lockedFields).toEqual(['summary']);
    expect(store.candidates[0]?.category).toBe('势力');
    expect(store.candidates[0]?.conflict?.targetEntryName).toBe('灰烬议会（旧）');
    expect(store.selectedWorldbookName).toBe('世界设定集');
  });
});
