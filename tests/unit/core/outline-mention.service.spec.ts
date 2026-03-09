import {
  renderOutlineMentionSnapshotForPrompt,
  resolveOutlineMentionSnapshots,
  searchOutlineMentionCandidates,
  type OutlineMentionContext,
} from '@/novelToST/core/outline-mention.service';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { stMocks } from '../../setup/st-globals.mock';

describe('outline-mention.service', () => {
  const createMentionContext = (mentionConfig?: OutlineMentionContext['mentionConfig']): OutlineMentionContext => {
    const foundationStore = useFoundationStore();
    foundationStore.reset();
    foundationStore.patchModule('positioning', {
      title: '银河残响',
      genre: '科幻',
    });
    foundationStore.patchModule('core', {
      logline: '舰队失控后重建秩序',
      emotionalTone: '紧张',
      coreConflict: '主角与议会对立',
    });
    foundationStore.patchModule('protagonist', {
      name: '黎曜',
    });
    foundationStore.patchModule('keyRelations', {
      keyCharacters: [{ id: 'key-1', name: '艾诺', role: '', relationArc: '' }],
    });
    foundationStore.patchModule('worldBrief', {
      requiredRules: ['跃迁需授权'],
    });

    return {
      foundation: JSON.parse(JSON.stringify(foundationStore.foundation)),
      storylines: [
        {
          id: 'line-main',
          type: 'main',
          title: '主线',
          description: '追查失控舰队',
          color: '',
          sortOrder: 0,
          status: 'draft',
          extra: {},
        },
      ],
      masterOutline: [
        {
          id: 'node-1',
          storylineId: 'line-main',
          title: '开场危机',
          summary: '主角接管舰桥',
          chapterStart: 1,
          chapterEnd: 3,
          turningPoints: [],
          phase: 'setup',
          status: 'draft',
        },
      ],
      detailsByChapter: {
        2: {
          chapter: 2,
          parentNodeId: 'node-1',
          title: '信号追踪',
          goal: '定位黑匣子',
          conflict: '舰队指挥权争夺',
          beats: ['追踪信号'],
          mustInclude: [],
          mustAvoid: [],
          status: 'draft',
        },
      },
      mentionConfig,
    };
  };

  it('should search node mention candidates by @ query', async () => {
    const candidates = await searchOutlineMentionCandidates({
      query: '危机',
      kinds: ['node'],
      context: createMentionContext(),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: 'node',
      id: 'node-1',
      label: '开场危机',
    });
  });

  it('should prefer bound worldbook when searching worldbook mentions', async () => {
    stMocks.getWorldbookNames.mockReturnValue(['设定补充', '主线词典', '角色档案']);
    stMocks.getChatWorldbookName.mockReturnValue('主线词典');

    const candidates = await searchOutlineMentionCandidates({
      query: '',
      kinds: ['worldbook'],
      context: createMentionContext(),
    });

    expect(candidates[0]).toMatchObject({ kind: 'worldbook', id: '主线词典' });
  });

  it('should skip worldbook_entry search on empty query to avoid heavy scanning', async () => {
    stMocks.getChatWorldbookName.mockReturnValue('主线词典');

    const candidates = await searchOutlineMentionCandidates({
      query: '',
      kinds: ['worldbook_entry'],
      context: createMentionContext(),
    });

    expect(candidates).toEqual([]);
    expect(stMocks.getWorldbook).not.toHaveBeenCalled();
  });

  it('should search worldbook_entry mentions only from currently enabled worldbooks', async () => {
    stMocks.getChatWorldbookName.mockReturnValue('主线词典');
    stMocks.getCharWorldbookNames.mockReturnValue({
      primary: '角色档案',
      additional: ['补充词典', '主线词典'],
    });
    stMocks.getGlobalWorldbookNames.mockReturnValue(['全局规则', '补充词典']);

    stMocks.getWorldbook.mockImplementation(async worldbookName => {
      if (worldbookName === '主线词典') {
        return [
          {
            uid: 11,
            name: '帝都',
            enabled: true,
            content: '帝都是联邦首都。',
            strategy: { type: 'selective', keys: ['帝都', '首都'] },
          },
        ];
      }

      if (worldbookName === '角色档案') {
        return [
          {
            uid: 21,
            name: '黎曜',
            enabled: true,
            content: '舰队代理指挥官。',
            strategy: { type: 'selective', keys: ['黎曜'] },
          },
        ];
      }

      if (worldbookName === '补充词典') {
        return [
          {
            uid: 31,
            name: '帝都旧城区',
            enabled: false,
            content: '已停用条目。',
            strategy: { type: 'constant', keys: ['旧城区'] },
          },
        ];
      }

      if (worldbookName === '全局规则') {
        return [
          {
            uid: 41,
            name: '跃迁许可',
            enabled: true,
            content: '跃迁必须经中央授权。',
            strategy: { type: 'constant', keys: ['跃迁'] },
          },
        ];
      }

      return [
        {
          uid: 99,
          name: '非启用条目',
          enabled: true,
          content: '不应被检索。',
          strategy: { type: 'constant', keys: ['非启用'] },
        },
      ];
    });

    const candidates = await searchOutlineMentionCandidates({
      query: '帝都',
      kinds: ['worldbook_entry'],
      context: createMentionContext(),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: 'worldbook_entry',
      label: '帝都（主线词典）',
    });
    expect(candidates[0]?.description).toContain('聊天绑定');

    expect(stMocks.getWorldbook).toHaveBeenCalledWith('主线词典');
    expect(stMocks.getWorldbook).toHaveBeenCalledWith('角色档案');
    expect(stMocks.getWorldbook).toHaveBeenCalledWith('补充词典');
    expect(stMocks.getWorldbook).toHaveBeenCalledWith('全局规则');
  });

  it('should render worldbook_entry label as entry name when mention config hides extra info', async () => {
    stMocks.getChatWorldbookName.mockReturnValue('主线词典');
    stMocks.getWorldbook.mockResolvedValue([
      {
        uid: 11,
        name: '帝都',
        enabled: true,
        content: '帝都是联邦首都。',
        strategy: { type: 'selective', keys: ['帝都', '首都'] },
      },
    ]);

    const candidates = await searchOutlineMentionCandidates({
      query: '帝都',
      kinds: ['worldbook_entry'],
      context: createMentionContext({
        worldbookEntryLabel: {
          includeWorldbookName: false,
          includeTriggerKeywords: false,
          includeStrategyType: false,
        },
      }),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: 'worldbook_entry',
      label: '帝都',
    });
  });

  it('should append trigger keywords and strategy to worldbook_entry label when mention config enables them', async () => {
    stMocks.getChatWorldbookName.mockReturnValue('主线词典');
    stMocks.getWorldbook.mockResolvedValue([
      {
        uid: 11,
        name: '帝都',
        enabled: true,
        content: '帝都是联邦首都。',
        strategy: { type: 'selective', keys: ['帝都', '首都'] },
      },
    ]);

    const candidates = await searchOutlineMentionCandidates({
      query: '帝都',
      kinds: ['worldbook_entry'],
      context: createMentionContext({
        worldbookEntryLabel: {
          includeWorldbookName: true,
          includeTriggerKeywords: true,
          includeStrategyType: true,
        },
      }),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.label).toContain('帝都（主线词典');
    expect(candidates[0]?.label).toContain('触发词：帝都 / 首都');
    expect(candidates[0]?.label).toContain('策略：selective');
  });

  it('should resolve worldbook_entry mention snapshot by encoded worldbook+uid id', async () => {
    stMocks.getChatWorldbookName.mockReturnValue('主线词典');
    stMocks.getWorldbook.mockResolvedValue([
      {
        uid: 11,
        name: '帝都',
        enabled: true,
        content: '帝都是联邦首都。',
        strategy: {
          type: 'selective',
          keys: ['帝都', '首都'],
        },
      },
    ]);

    const candidates = await searchOutlineMentionCandidates({
      query: '帝都',
      kinds: ['worldbook_entry'],
      context: createMentionContext(),
    });
    const mention = candidates[0];

    if (!mention) {
      throw new Error('worldbook_entry mention candidate should exist');
    }

    const result = await resolveOutlineMentionSnapshots({
      context: createMentionContext(),
      mentions: [mention],
      frozenAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.warnings).toEqual([]);
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0]).toMatchObject({
      kind: 'worldbook_entry',
      id: mention.id,
      label: mention.label,
      frozenAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.snapshots[0]?.content).toContain('世界书：主线词典');
    expect(result.snapshots[0]?.content).toContain('UID：11');
    expect(result.snapshots[0]?.content).toContain('正文：帝都是联邦首都。');

    const rendered = renderOutlineMentionSnapshotForPrompt(result.snapshots[0]!);
    expect(rendered).toContain('【世界书条目】');
    expect(rendered).toContain('帝都（主线词典）');
  });

  it('should resolve mention snapshots and keep warnings for unresolved refs', async () => {
    stMocks.getWorldbook.mockResolvedValue([
      {
        name: '帝都',
        strategy: {
          keys: ['帝都', '首都'],
        },
      },
    ]);

    const result = await resolveOutlineMentionSnapshots({
      context: createMentionContext(),
      mentions: [
        { kind: 'storyline', id: 'line-main', label: '主线' },
        { kind: 'detail', id: 'chapter:2', label: '第 2 章' },
        { kind: 'worldbook', id: '主线词典', label: '主线词典' },
        { kind: 'node', id: 'missing-node', label: '缺失节点' },
      ],
      frozenAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.snapshots).toHaveLength(3);
    expect(result.warnings).toEqual(['引用解析失败：node/缺失节点']);

    const rendered = renderOutlineMentionSnapshotForPrompt(result.snapshots[0]!);
    expect(rendered).toContain('【');
    expect(rendered).toContain('主线');
  });
});
