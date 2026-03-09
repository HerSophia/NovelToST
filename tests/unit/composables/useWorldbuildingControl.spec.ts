import { useWorldbuildingControl } from '@/novelToST/composables/useWorldbuildingControl';
import { useWorldbuildingStore } from '@/novelToST/stores/worldbuilding.store';
import { stMocks } from '../../setup/st-globals.mock';

describe('useWorldbuildingControl', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();

  beforeEach(() => {
    generateRawMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);

    stMocks.getLoadedPresetName.mockReturnValue('写实奇幻');
    stMocks.getCurrentCharacterName.mockReturnValue('阿尔娜');
    stMocks.getPreset.mockImplementation(() => ({
      prompts: [{ enabled: true }, { enabled: false }, { enabled: true }],
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should append a new version while preserving locked fields', async () => {
    const store = useWorldbuildingStore();
    const session = store.createSession({ type: 'character', title: '林川' });

    store.appendDraftVersion(session.id, {
      draft: {
        name: '林川',
        aliases: ['边境猎犬'],
        summary: '旧摘要',
        facts: ['旧事实'],
        constraints: ['不主动泄密'],
        relations: [{ target: '夏珀', relation: '旧搭档' }],
        extra: { age: 24 },
      },
      lockedFields: ['summary'],
    });

    generateRawMock.mockResolvedValue(JSON.stringify({
      assistantReply: '我补全了背景线，并保留锁定字段。',
      draft: {
        name: '林川·改',
        aliases: ['边境猎犬', '雾行者'],
        summary: '新摘要（应被锁定）',
        facts: ['旧事实', '参与过灰港行动'],
        constraints: ['不主动泄密'],
        relations: [{ target: '夏珀', relation: '战友' }],
        extra: { age: 24, rank: '中士' },
      },
    }));

    const control = useWorldbuildingControl();
    control.messageInput.value = '补充他的成长经历';

    await control.runExpand();

    expect(store.activeSession?.messages).toHaveLength(2);
    expect(store.activeSession?.versions).toHaveLength(3);
    expect(store.activeVersion?.draft.name).toBe('林川·改');
    expect(store.activeVersion?.draft.summary).toBe('旧摘要');
    expect(store.activeVersion?.lockedFields).toEqual(['summary']);
    expect(control.lastParseWarning.value).toBeNull();
    expect(stMocks.toastr.success).toHaveBeenCalled();
  });

  it('should keep draft unchanged when structured parsing fails', async () => {
    const store = useWorldbuildingStore();
    store.createSession({ type: 'location', title: '灰港' });

    generateRawMock.mockResolvedValue('灰港与王都之间的贸易线仍存在逻辑冲突，建议补充时间线。');

    const control = useWorldbuildingControl();
    control.messageInput.value = '检查并精修';

    await control.runRefine();

    expect(store.activeSession?.versions).toHaveLength(1);
    expect(store.activeSession?.messages).toHaveLength(2);
    expect(control.lastParseWarning.value).toContain('结构化解析失败');
    expect(stMocks.toastr.warning).toHaveBeenCalled();
  });

  it('should generate candidates and expose preset/character collaboration hints', async () => {
    const store = useWorldbuildingStore();
    store.createSession({ type: 'faction', title: '灰烬议会' });

    generateRawMock.mockResolvedValue(JSON.stringify({
      assistantReply: '已拆解为候选条目。',
      candidates: [
        {
          category: '势力',
          name: '灰烬议会',
          keywords: ['灰烬议会', '议会'],
          content: '控制边境贸易线的隐秘组织。',
          strategy: 'selective',
        },
      ],
    }));

    const control = useWorldbuildingControl();

    await control.runGenerateCandidates();

    expect(store.candidates).toHaveLength(1);
    expect(store.candidates[0]).toMatchObject({
      category: '势力',
      name: '灰烬议会',
      checked: true,
      strategy: 'selective',
    });
    expect(store.activeSession?.messages).toHaveLength(2);
    expect(control.lastParseWarning.value).toBeNull();

    const mergedHints = control.collaborationHints.value.join(' | ');
    expect(mergedHints).toContain('写实奇幻');
    expect(mergedHints).toContain('阿尔娜');
  });

  it('should include provided mention snapshots in ai prompt', async () => {
    const store = useWorldbuildingStore();
    store.createSession({ type: 'character', title: '林川' });

    generateRawMock.mockResolvedValue(
      JSON.stringify({
        assistantReply: '已补全背景。',
        draft: {
          name: '林川',
          aliases: ['边境猎犬'],
          summary: '边境侦察兵。',
          facts: ['擅长追踪'],
          constraints: ['不主动泄密'],
          relations: [{ target: '夏珀', relation: '搭档' }],
          extra: { age: 24 },
        },
      }),
    );

    const control = useWorldbuildingControl();
    control.messageInput.value = '请补全背景';

    await control.runExpand({
      mentionSnapshots: [
        {
          kind: 'foundation',
          id: 'foundation:current',
          label: '故事基底',
          frozenAt: '2026-03-06T00:00:00.000Z',
          content: '标题：星图设定',
        },
      ],
    });

    expect(generateRawMock.mock.calls[0]?.[0]?.user_input ?? '').toContain('【故事基底】故事基底');
  });
});
