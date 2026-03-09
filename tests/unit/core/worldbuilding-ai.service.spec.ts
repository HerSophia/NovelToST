import {
  checkDraftConsistencyByAI,
  expandDraftByAI,
  generateCandidatesByAI,
  refineDraftByAI,
  type WorldbuildingAIRequestInput,
} from '@/novelToST/core/worldbuilding-ai.service';

function createInput(overrides: Partial<WorldbuildingAIRequestInput> = {}): WorldbuildingAIRequestInput {
  const base: WorldbuildingAIRequestInput = {
    type: 'character',
    sessionTitle: '主角设定',
    seed: '边境出身，卷入王都阴谋。',
    userInstruction: '补充角色成长线',
    draft: {
      name: '林川',
      aliases: ['边境猎犬'],
      summary: '边境侦察兵',
      facts: ['擅长追踪'],
      constraints: ['不主动泄密'],
      relations: [{ target: '夏珀', relation: '搭档' }],
      extra: { age: 24 },
    },
    lockedFields: ['summary'],
    recentMessages: [
      {
        id: 'm-1',
        role: 'user',
        text: '请补全他的成长背景',
        createdAt: '2026-03-02T00:00:00.000Z',
      },
    ],
    environment: {
      loadedPresetName: '写实奇幻',
      currentCharacterName: '阿尔娜',
      activePromptCount: 12,
    },
  };

  const merged: WorldbuildingAIRequestInput = {
    ...base,
    ...overrides,
    draft: {
      ...base.draft,
      ...overrides.draft,
      aliases: overrides.draft?.aliases ? [...overrides.draft.aliases] : [...base.draft.aliases],
      facts: overrides.draft?.facts ? [...overrides.draft.facts] : [...base.draft.facts],
      constraints: overrides.draft?.constraints ? [...overrides.draft.constraints] : [...base.draft.constraints],
      relations: overrides.draft?.relations
        ? overrides.draft.relations.map(item => ({ ...item }))
        : base.draft.relations.map(item => ({ ...item })),
      extra: {
        ...base.draft.extra,
        ...(overrides.draft?.extra ?? {}),
      },
    },
    lockedFields: overrides.lockedFields ? [...overrides.lockedFields] : [...base.lockedFields],
    recentMessages: overrides.recentMessages
      ? overrides.recentMessages.map(item => ({ ...item }))
      : base.recentMessages.map(item => ({ ...item })),
    environment: {
      ...(base.environment ?? {}),
      ...(overrides.environment ?? {}),
    },
  };

  return merged;
}

describe('worldbuilding-ai.service', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();

  beforeEach(() => {
    generateRawMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should parse draft from fenced json response for expand action', async () => {
    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "我已扩写角色经历并保留锁定字段。",
  "draft": {
    "name": "林川",
    "aliases": ["边境猎犬", "雾行者"],
    "summary": "边境侦察兵",
    "facts": ["擅长追踪", "熟悉黑市路径"],
    "constraints": ["不主动泄密"],
    "relations": [{ "target": "夏珀", "relation": "旧搭档" }],
    "extra": { "age": 24, "rank": "中士" }
  }
}\n\`\`\``);

    const result = await expandDraftByAI(createInput());

    expect(result.parseError).toBeNull();
    expect(result.assistantText).toContain('扩写角色经历');
    expect(result.draft?.aliases).toEqual(['边境猎犬', '雾行者']);
    expect(result.draft?.facts).toContain('熟悉黑市路径');
    expect(result.draft?.extra).toMatchObject({ age: 24, rank: '中士' });
  });

  it('should normalize string list and relations for refine action', async () => {
    generateRawMock.mockResolvedValue(`已完成精修。\n{
  "assistantReply": "我压缩了冗余描述，并整理了关系字段。",
  "draft": {
    "name": "林川",
    "aliases": "边境猎犬, 雾行者",
    "summary": "边境侦察兵，行事克制。",
    "facts": "擅长追踪\n熟悉黑市路径",
    "constraints": "不主动泄密；不滥杀",
    "relations": {
      "夏珀": "互信搭档"
    },
    "extra": {
      "age": 24
    }
  }
}`);

    const result = await refineDraftByAI(createInput());

    expect(result.parseError).toBeNull();
    expect(result.draft?.aliases).toEqual(['边境猎犬', '雾行者']);
    expect(result.draft?.facts).toEqual(['擅长追踪', '熟悉黑市路径']);
    expect(result.draft?.constraints).toEqual(['不主动泄密', '不滥杀']);
    expect(result.draft?.relations).toEqual([{ target: '夏珀', relation: '互信搭档' }]);
  });

  it('should parse candidate list for generateCandidates action', async () => {
    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "已拆解为 2 条候选。",
  "candidates": [
    {
      "category": "角色",
      "name": "林川",
      "keywords": "林川,边境猎犬",
      "content": "边境出身的侦察兵，擅长潜行与追踪。",
      "strategy": "selective"
    },
    {
      "category": "地点",
      "name": "灰港",
      "keywords": ["灰港", "黑市"],
      "content": "边境灰港是非法贸易与情报交换中心。",
      "strategy": "constant"
    }
  ]
}\n\`\`\``);

    const result = await generateCandidatesByAI(createInput({ userInstruction: '转成候选条目' }));

    expect(result.parseError).toBeNull();
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      category: '角色',
      name: '林川',
      keywords: ['林川', '边境猎犬'],
      strategy: 'selective',
      checked: true,
    });
    expect(result.candidates[1]?.strategy).toBe('constant');
  });

  it('should keep natural language and report parse error when json missing', async () => {
    generateRawMock.mockResolvedValue('我检查了当前草案，建议重点补充与王都势力的关系线。');

    const result = await checkDraftConsistencyByAI(createInput({ userInstruction: '做一致性检查' }));

    expect(result.draft).toBeNull();
    expect(result.parseError).toContain('结构化解析失败');
    expect(result.assistantText).toContain('建议重点补充');
  });
});
