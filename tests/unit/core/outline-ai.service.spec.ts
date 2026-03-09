import {
  deriveChapterDetailsByAI,
  extractJsonPayload,
  generateMasterOutlineByAI,
  parseOutlineWorkshopPayload,
  rewriteChapterDetailByAI,
} from '@/novelToST/core/outline-ai.service';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import type { StoryFoundation } from '@/novelToST/types/foundation';
import type { ChapterDetail, MasterOutlineNode } from '@/novelToST/types/outline';

describe('outline-ai.service', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();
  const makeDetail = (chapter: number, patch: Partial<ChapterDetail> = {}): ChapterDetail => ({
    chapter,
    parentNodeId: '',
    title: '',
    goal: '',
    conflict: '',
    beats: [],
    mustInclude: [],
    mustAvoid: [],
    status: 'draft',
    ...patch,
  });

  let foundation: StoryFoundation;

  const aiConfig = {
    enabled: true,
    provider: 'tavern' as const,
    model: '',
    temperature: 0.8,
  };

  beforeEach(() => {
    generateRawMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);

    const foundationStore = useFoundationStore();
    foundationStore.reset();
    foundationStore.patchModule('positioning', { title: '星海回响', genre: '科幻' });
    foundationStore.patchModule('core', {
      logline: '失忆舰长在碎裂星域寻找真相',
      emotionalTone: '悬疑、史诗',
      coreConflict: '自由意志与宿命系统对抗',
    });
    foundationStore.patchModule('protagonist', {
      name: '黎曜',
    });
    foundationStore.patchModule('keyRelations', {
      keyCharacters: [{ id: 'key-1', name: '艾诺', role: '', relationArc: '' }, { id: 'key-2', name: '赛门', role: '', relationArc: '' }],
    });
    foundationStore.patchModule('worldBrief', { requiredRules: ['跃迁需要代价', '记忆可被改写'] });
    foundationStore.patchModule('narrativeRules', { pov: '第一人称', forbiddenPatterns: ['每章有推进'] });
    foundation = JSON.parse(JSON.stringify(foundationStore.foundation)) as StoryFoundation;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should generate master outline from fenced json response', async () => {
    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "masterOutline": [
    {
      "id": "arc-1",
      "title": "迷航",
      "summary": "主角被迫接管残舰",
      "chapterStart": 1,
      "chapterEnd": 6,
      "turningPoints": ["接管舰桥", "发现黑匣子"],
      "status": "approved"
    }
  ]
}\n\`\`\``);

    const nodes = await generateMasterOutlineByAI({
      foundation,
      chapterCount: 20,
      aiConfig,
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: 'arc-1',
      title: '迷航',
      chapterStart: 1,
      chapterEnd: 6,
      status: 'approved',
    });
  });

  it('should parse v2 node fields from storylines/nodes payload', async () => {
    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "storylines": [
    {
      "id": "line-main",
      "type": "main",
      "title": "主线",
      "description": "追查黑匣子",
      "status": "draft"
    }
  ],
  "nodes": [
    {
      "id": "node-v2-1",
      "storylineId": "line-main",
      "title": "残舰迷航",
      "summary": "主角被迫接管舰桥",
      "chapterStart": 1,
      "chapterEnd": 4,
      "phase": "setup",
      "events": [
        { "tag": "turning_point", "label": "", "description": "接管舰桥" }
      ],
      "timeStart": { "label": "T+0", "sortKey": 0, "note": "" },
      "timeEnd": { "label": "T+3", "sortKey": 3, "note": "" },
      "keywords": ["失忆", "残舰"],
      "characters": ["黎曜"],
      "locations": ["灰港"],
      "status": "draft"
    }
  ]
}\n\`\`\``);

    const nodes = await generateMasterOutlineByAI({
      foundation,
      chapterCount: 20,
      aiConfig,
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: 'node-v2-1',
      storylineId: 'line-main',
      phase: 'setup',
      chapterStart: 1,
      chapterEnd: 4,
      keywords: ['失忆', '残舰'],
    });
    expect(nodes[0]?.events?.[0]?.description).toBe('接管舰桥');
    expect(nodes[0]?.timeStart?.label).toBe('T+0');
  });

  it('should recover workshop commands from JSON with trailing commas', () => {
    const payload = extractJsonPayload(`
已根据你的要求整理完成，下面给出结构化更新。

\`\`\`json
{
  "commands": [
    {
      "type": "node.create",
      "node": {
        "id": "node-2",
        "storylineId": "line-main",
        "title": "龙门试炼",
        "summary": "主角在古城试炼中突破化神瓶颈。",
        "chapterStart": 4,
        "chapterEnd": 6,
        "phase": "confrontation",
        "status": "draft",
      },
    },
  ],
}
\`\`\`

若你希望我继续，我可以再补充下一批节点。
`);

    const parsed = parseOutlineWorkshopPayload(payload, { chapterCount: 20 });

    expect(parsed.hasStructuredUpdate).toBe(true);
    expect(parsed.masterOutline).toHaveLength(1);
    expect(parsed.masterOutline?.[0]).toMatchObject({
      id: 'node-2',
      storylineId: 'line-main',
      title: '龙门试炼',
      chapterStart: 4,
      chapterEnd: 6,
      phase: 'confrontation',
      status: 'draft',
    });
  });

  it('should unwrap quoted JSON payload strings', () => {
    const payload = extractJsonPayload(
      '```json\n"{\\"commands\\":[{\\"type\\":\\"setup.patch\\",\\"patch\\":{\\"tone\\":\\"冷峻悬疑\\"}}]}"\n```',
    );

    const parsed = parseOutlineWorkshopPayload(payload, { chapterCount: 20 });
    expect(parsed.hasStructuredUpdate).toBe(true);
    expect(parsed.foundationPatch).toMatchObject({ core: { emotionalTone: '冷峻悬疑' } });
  });

  it('should map phase alias "development" to confrontation in node commands', () => {
    const parsed = parseOutlineWorkshopPayload(
      {
        commands: [
          {
            type: 'node.create',
            node: {
              id: 'node-phase-alias',
              storylineId: 'line-main',
              title: '中段推进',
              summary: '主线进入中段发展。',
              chapterStart: 10,
              chapterEnd: 20,
              phase: 'development',
              status: 'draft',
            },
          },
        ],
      },
      { chapterCount: 100 },
    );

    expect(parsed.hasStructuredUpdate).toBe(true);
    expect(parsed.masterOutline).toHaveLength(1);
    expect(parsed.masterOutline?.[0]).toMatchObject({ id: 'node-phase-alias', phase: 'confrontation' });
    expect(parsed.commandWarnings).toEqual([]);
  });

  it('should expand node.split command into node update/create sequence', () => {
    const parsed = parseOutlineWorkshopPayload(
      {
        commands: [
          {
            type: 'node.split',
            id: 'node-root',
            nodes: [
              {
                title: '第一段：龙门入局',
                summary: '原节点上半段。',
                chapterStart: 1,
                chapterEnd: 60,
              },
              {
                title: '第二段：帝国前线',
                summary: '原节点下半段。',
                chapterStart: 61,
                chapterEnd: 120,
              },
            ],
          },
        ],
      },
      {
        chapterCount: 200,
        baseMasterOutline: [
          {
            id: 'node-root',
            storylineId: 'line-main',
            title: '原始大节点',
            summary: '待拆分的原节点',
            chapterStart: 1,
            chapterEnd: 120,
            phase: 'confrontation',
            turningPoints: [],
            status: 'draft',
          },
        ],
      },
    );

    expect(parsed.commandWarnings).toEqual([]);
    expect(parsed.masterOutline?.map(node => node.id)).toEqual(['node-root', 'node-root-split-2']);
    expect(parsed.masterOutline?.find(node => node.id === 'node-root')).toMatchObject({
      title: '第一段：龙门入局',
      chapterStart: 1,
      chapterEnd: 60,
      storylineId: 'line-main',
      phase: 'confrontation',
    });
    expect(parsed.masterOutline?.find(node => node.id === 'node-root-split-2')).toMatchObject({
      title: '第二段：帝国前线',
      chapterStart: 61,
      chapterEnd: 120,
      storylineId: 'line-main',
      phase: 'confrontation',
      status: 'draft',
    });
    expect(parsed.hasStructuredUpdate).toBe(true);
  });

  it('should apply detail commands against base details in parseOutlineWorkshopPayload', () => {
    const parsed = parseOutlineWorkshopPayload(
      {
        detailCommands: [
          { op: 'U', chapter: 2, patch: { goal: '新目标 2', conflict: '新冲突 2' } },
          { op: 'D', chapter: 4 },
          {
            op: 'C',
            detail: {
              chapter: 5,
              title: '新增细纲 5',
              goal: '新增目标 5',
              conflict: '新增冲突 5',
            },
          },
        ],
      },
      {
        chapterCount: 20,
        baseDetailsByChapter: {
          2: makeDetail(2, { title: '旧细纲 2', goal: '旧目标 2', conflict: '旧冲突 2' }),
          4: makeDetail(4, { title: '旧细纲 4', goal: '旧目标 4', conflict: '旧冲突 4' }),
          6: makeDetail(6, { title: '旧细纲 6', goal: '旧目标 6', conflict: '旧冲突 6' }),
        },
      },
    );

    expect(parsed.detailsByChapter?.[2]).toMatchObject({ title: '旧细纲 2', goal: '新目标 2', conflict: '新冲突 2' });
    expect(parsed.detailsByChapter?.[4]).toBeUndefined();
    expect(parsed.detailsByChapter?.[5]).toMatchObject({ title: '新增细纲 5', goal: '新增目标 5', conflict: '新增冲突 5' });
    expect(parsed.detailsByChapter?.[6]).toMatchObject({ title: '旧细纲 6', goal: '旧目标 6', conflict: '旧冲突 6' });
    expect(parsed.hasStructuredUpdate).toBe(true);
    expect(parsed.commandWarnings).toEqual([]);
  });

  it('should merge legacy setup field with setup commands into foundation patch in parseOutlineWorkshopPayload', () => {
    const parsed = parseOutlineWorkshopPayload(
      {
        setup: { title: '旧标题', tone: '原基调' },
        setupCommands: [{ patch: { genre: '太空歌剧' } }, { coreConflict: '命令升级后的核心冲突' }],
        commands: [{ type: 'setup.patch', patch: { tone: '新基调', characters: ['黎曜', '艾诺'] } }],
      },
      { chapterCount: 20 },
    );

    expect(parsed.foundationPatch).toMatchObject({
      positioning: {
        title: '旧标题',
        genre: '太空歌剧',
      },
      core: {
        emotionalTone: '新基调',
        coreConflict: '命令升级后的核心冲突',
      },
      protagonist: { name: '黎曜' },
    });
    expect(parsed.foundationPatch?.keyRelations?.keyCharacters?.[0]?.name).toBe('艾诺');
    expect(parsed.storylines).toBeNull();
    expect(parsed.masterOutline).toBeNull();
    expect(parsed.detailsByChapter).toBeNull();
    expect(parsed.hasStructuredUpdate).toBe(true);
    expect(parsed.commandWarnings).toEqual([]);
  });

  it('should keep target "setup" generic commands compatible with foundation patch parsing', () => {
    const parsed = parseOutlineWorkshopPayload(
      {
        commands: [
          {
            target: 'setup',
            action: 'patch',
            setup: { genre: '太空悬疑', tone: '冷硬压抑' },
          },
        ],
      },
      { chapterCount: 20 },
    );

    expect(parsed.foundationPatch).toMatchObject({
      positioning: { genre: '太空悬疑' },
      core: { emotionalTone: '冷硬压抑' },
    });
    expect(parsed.hasStructuredUpdate).toBe(true);
    expect(parsed.commandWarnings).toEqual([]);
  });

  it('should report command conflict warnings across foundation/storyline/node/detail commands', () => {
    const parsed = parseOutlineWorkshopPayload(
      {
        commands: [
          { type: 'setup.patch', patch: { tone: '第一版基调' } },
          { type: 'setup.patch', patch: { tone: '第二版基调' } },
          { type: 'storyline.delete', id: 'line-side' },
          { type: 'storyline.update', id: 'line-side', patch: { title: '删除后更新' } },
          { type: 'node.delete', id: 'node-side-1' },
          { type: 'node.update', id: 'node-side-1', patch: { summary: '删除后更新节点' } },
          { type: 'node.update', id: 'node-upd-del', patch: { summary: '先更新后删除' } },
          { type: 'node.delete', id: 'node-upd-del' },
          { type: 'detail.delete', chapter: 2 },
          { type: 'detail.update', chapter: 2, patch: { goal: '删除后更新细纲' } },
        ],
      },
      {
        chapterCount: 20,
        baseStorylines: [
          {
            id: 'line-main',
            type: 'main',
            title: '主线',
            description: '主线描述',
            status: 'draft',
            sortOrder: 0,
            color: '',
            extra: {},
          },
          {
            id: 'line-side',
            type: 'subplot',
            title: '支线',
            description: '支线描述',
            status: 'draft',
            sortOrder: 1,
            color: '',
            extra: {},
          },
        ],
        baseMasterOutline: [
          {
            id: 'node-side-1',
            storylineId: 'line-main',
            title: '支线节点',
            summary: '待删除节点',
            chapterStart: 1,
            chapterEnd: 2,
            turningPoints: [],
            status: 'draft',
          },
          {
            id: 'node-upd-del',
            storylineId: 'line-main',
            title: '更新后删除节点',
            summary: '初始摘要',
            chapterStart: 3,
            chapterEnd: 4,
            turningPoints: [],
            status: 'draft',
          },
        ],
        baseDetailsByChapter: {
          2: makeDetail(2, { title: '旧细纲 2', goal: '旧目标 2', conflict: '旧冲突 2' }),
        },
      },
    );

    expect(parsed.foundationPatch).toMatchObject({ core: { emotionalTone: '第二版基调' } });
    expect(parsed.storylines?.some(storyline => storyline.id === 'line-side')).toBe(false);
    expect(parsed.masterOutline?.some(node => node.id === 'node-side-1')).toBe(false);
    expect(parsed.masterOutline?.some(node => node.id === 'node-upd-del')).toBe(false);
    expect(parsed.detailsByChapter?.[2]).toBeUndefined();
    expect(parsed.hasStructuredUpdate).toBe(true);

    expect(parsed.commandWarnings.some(item => item.includes('foundation 命令冲突：字段 core.emotionalTone 被重复 patch'))).toBe(true);
    expect(parsed.commandWarnings.some(item => item.includes('storyline 命令冲突：id=line-side 先删除后更新'))).toBe(true);
    expect(parsed.commandWarnings.some(item => item.includes('node 命令冲突：id=node-side-1 先删除后更新'))).toBe(true);
    expect(parsed.commandWarnings.some(item => item.includes('node 命令冲突：id=node-upd-del 先更新后删除'))).toBe(true);
    expect(parsed.commandWarnings.some(item => item.includes('detail 命令冲突：chapter=2 先删除后更新'))).toBe(true);
  });

  it('should derive chapter details and auto map parent node by chapter range', async () => {
    const masterOutline: MasterOutlineNode[] = [
      {
        id: 'arc-1',
        title: '第一幕',
        summary: '起始冲突',
        chapterStart: 1,
        chapterEnd: 5,
        turningPoints: [],
        status: 'draft',
      },
    ];

    generateRawMock.mockResolvedValue(
      JSON.stringify({
        details: [
          {
            chapter: 2,
            parentNodeId: '',
            title: '潜入废港',
            goal: '获取补给',
            conflict: '遭遇拦截',
            beats: ['潜入', '暴露', '撤离'],
            mustInclude: ['旧日日志'],
            mustAvoid: ['无意义打斗'],
            status: 'draft',
          },
        ],
      }),
    );

    const details = await deriveChapterDetailsByAI({
      foundation,
      masterOutline,
      chapterCount: 20,
      aiConfig,
    });

    expect(details).toHaveLength(1);
    expect(details[0]?.chapter).toBe(2);
    expect(details[0]?.parentNodeId).toBe('arc-1');
    expect(details[0]?.beats).toEqual(['潜入', '暴露', '撤离']);

    const prompt = generateRawMock.mock.calls[0]?.[0]?.user_input ?? '';
    expect(prompt).toContain('可按需输出关键章节');
    expect(prompt).not.toContain('每章必须有一条细纲');
  });

  it('should rewrite a target chapter detail', async () => {
    generateRawMock.mockResolvedValue(
      JSON.stringify({
        detail: {
          chapter: 99,
          parentNodeId: 'arc-2',
          title: '重写章节',
          goal: '制造反转',
          conflict: '同伴背叛',
          beats: ['铺垫', '背叛', '反击'],
          mustInclude: ['旧誓言'],
          mustAvoid: ['突然降智'],
          status: 'approved',
        },
      }),
    );

    const rewritten = await rewriteChapterDetailByAI({
      foundation,
      masterOutline: [],
      chapter: 8,
      currentDetail: null,
      aiConfig,
    });

    expect(rewritten.chapter).toBe(8);
    expect(rewritten.title).toBe('重写章节');
    expect(rewritten.status).toBe('approved');
  });

  it('should throw when ai output cannot be parsed', async () => {
    generateRawMock.mockResolvedValue('这是一段无法解析的自然语言');

    await expect(
      generateMasterOutlineByAI({
        foundation,
        chapterCount: 12,
        aiConfig,
      }),
    ).rejects.toThrow('AI 总纲解析失败');
  });
});
