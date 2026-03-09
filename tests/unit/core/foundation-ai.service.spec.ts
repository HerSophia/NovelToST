import {
  buildFoundationPrompt,
  runFoundationCollaborationByAI,
  type FoundationAIRequestInput,
} from '@/novelToST/core/foundation-ai.service';
import type { StoryFoundation } from '@/novelToST/types/foundation';

function cloneFoundation(foundation: StoryFoundation): StoryFoundation {
  return JSON.parse(JSON.stringify(foundation)) as StoryFoundation;
}

function createFoundation(): StoryFoundation {
  return {
    positioning: {
      title: '',
      genre: '古风权谋',
      mainType: '权谋',
      subType: '',
      targetExperience: ['高压'],
      length: '',
      audience: '',
      contentIntensity: ['高反转'],
    },
    core: {
      logline: '一个失势世子在乱局中自救。',
      coreConflict: '自保与复仇之间的冲突',
      coreSuspense: '',
      coreSellPoint: '高压博弈',
      themeKeywords: ['身份', '背叛'],
      emotionalTone: '压抑',
    },
    protagonist: {
      name: '沈砚',
      identity: '失势世子',
      visibleGoal: '活下去',
      deepNeed: '重建信任',
      coreDesire: '',
      coreFear: '',
      coreFlaw: '过度防御',
      behaviorStyle: '',
      moralLeaning: '',
      mostCaredAbout: '',
      bottomLine: '',
      temptation: '',
      arcDirection: '',
    },
    keyRelations: {
      antagonist: {
        name: '赵珩',
        goal: '夺取政权',
        conflict: '路线对立',
      },
      keyCharacters: [],
    },
    conflictFramework: {
      mainConflict: '朝堂与边军权力争夺',
      innerConflict: '',
      relationConflict: '',
      externalObstacle: '',
      failureCost: '家族覆灭',
      timePressure: '',
      irreversibleEvents: [],
      escalationPattern: '',
    },
    narrativeRules: {
      pov: '第三人称',
      tenseAndStyle: '',
      languageQuality: '克制',
      infoDisclosure: '',
      allowExposition: false,
      plotDriver: '',
      romanceWeight: '',
      ensembleWeight: '',
      emphasisTags: [],
      forbiddenPatterns: [],
    },
    worldBrief: {
      worldType: '',
      requiredRules: [],
      keyScenes: [],
      settingPivots: [],
      conflictGeneratingRules: [],
      forbiddenSettings: [],
    },
    endgame: {
      overallDirection: '',
      endingType: '阶段性胜利',
      protagonistChanges: false,
      rootProblem: '',
      readerFeeling: '',
      mustResolve: [],
    },
    extensions: [],
  };
}

function createInput(overrides: Partial<FoundationAIRequestInput> = {}): FoundationAIRequestInput {
  const base: FoundationAIRequestInput = {
    foundation: createFoundation(),
    recentMessages: [
      {
        id: 'm-1',
        role: 'user',
        text: '请补全主角模块',
        createdAt: '2026-03-02T00:00:00.000Z',
      },
    ],
    userInstruction: '请补全主角模块',
    targetModule: null,
  };

  return {
    ...base,
    ...overrides,
    foundation: overrides.foundation ? cloneFoundation(overrides.foundation) : cloneFoundation(base.foundation),
    recentMessages: overrides.recentMessages
      ? overrides.recentMessages.map(message => ({ ...message }))
      : base.recentMessages.map(message => ({ ...message })),
    targetModule: overrides.targetModule ?? base.targetModule,
  };
}

describe('foundation-ai.service', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();

  beforeEach(() => {
    generateRawMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should build high-constraint prompt with new module labels and readiness guidance', () => {
    const foundation = createFoundation();
    foundation.positioning.genre = '';
    foundation.core.logline = '';
    foundation.protagonist.name = '';
    foundation.protagonist.identity = '';
    foundation.protagonist.visibleGoal = '';

    const prompt = buildFoundationPrompt(
      createInput({
        foundation,
        userInstruction: '请先帮我起步',
      }),
    );

    expect(prompt.systemPrompt).toContain('故事基底包含八个模块：作品定位、故事核心、主角档案、关键关系、冲突结构、世界需求、叙事规则、终局方向。');
    expect(prompt.systemPrompt).toContain('起步必填 → 建议补充 → 精细控制');
    expect(prompt.systemPrompt).toContain('默认一轮只改当前最需要的少数字段');
    expect(prompt.systemPrompt).not.toContain('故事核心句');
    expect(prompt.userPrompt).toContain('起步必填缺口：');
    expect(prompt.userPrompt).toContain('- 题材（作品定位）');
    expect(prompt.userPrompt).toContain('- 一句话故事（故事核心）');
    expect(prompt.userPrompt).toContain('- 主角信息（姓名 / 身份 / 显性目标至少一项）（主角档案）');
  });

  it('should lock prompt to target module when module assist is enabled', () => {
    const prompt = buildFoundationPrompt(createInput({ targetModule: 'protagonist', userInstruction: '只补主角档案' }));

    expect(prompt.systemPrompt).toContain('本轮只处理「主角档案」（protagonist）。可以参考其他模块，但不得修改其他模块。');
    expect(prompt.systemPrompt).toContain('foundationPatch 顶层只允许包含 "protagonist"');
  });

  it('should parse fenced json and extract foundationPatch', async () => {
    generateRawMock.mockResolvedValue(`本轮我补全了主角行为风格。\n\n\`\`\`json
{
  "assistantReply": "我已补全主角行为风格与弧光方向。",
  "foundationPatch": {
    "protagonist": {
      "behaviorStyle": "  谨慎型，先侦察后行动  ",
      "arcDirection": "  从过度防御到承担风险  "
    }
  }
}
\`\`\``);

    const result = await runFoundationCollaborationByAI(createInput());

    expect(result.parseError).toBeNull();
    expect(result.assistantText).toContain('补全主角行为风格');
    expect(result.foundationPatch).toMatchObject({
      protagonist: {
        behaviorStyle: '谨慎型，先侦察后行动',
        arcDirection: '从过度防御到承担风险',
      },
    });
  });

  it('should keep natural language and report parse error when json missing', async () => {
    generateRawMock.mockResolvedValue('我建议先明确主角在前三章的主动目标，再补全对手动机。');

    const result = await runFoundationCollaborationByAI(createInput({ userInstruction: '给我建议' }));

    expect(result.foundationPatch).toBeNull();
    expect(result.parseError).toContain('未提取到 JSON');
    expect(result.assistantText).toContain('建议先明确主角');
  });

  it('should normalize list fields and enforce max 3 items', async () => {
    generateRawMock.mockResolvedValue(JSON.stringify({
      assistantReply: '我整理了定位与主题关键词。',
      foundationPatch: {
        positioning: {
          targetExperience: ['  高压  ', '反转', '高压', '节奏快', '额外项'],
          contentIntensity: '高反转, 高情绪, 高设定, 多余项',
        },
        core: {
          themeKeywords: ['身份', '  背叛 ', '救赎', '命运'],
        },
      },
    }));

    const result = await runFoundationCollaborationByAI(createInput());

    expect(result.parseError).toBeNull();
    expect(result.foundationPatch?.positioning?.targetExperience).toEqual(['高压', '反转', '节奏快']);
    expect(result.foundationPatch?.positioning?.contentIntensity).toEqual(['高反转', '高情绪', '高设定']);
    expect(result.foundationPatch?.core?.themeKeywords).toEqual(['身份', '背叛', '救赎']);
    expect(result.parseWarnings.some(warning => warning.includes('最多允许 3 项'))).toBe(true);
  });

  it('should clip patch to targetModule when module assist is enabled', async () => {
    generateRawMock.mockResolvedValue(JSON.stringify({
      assistantReply: '我只补全主角模块。',
      foundationPatch: {
        protagonist: {
          visibleGoal: '夺回家族控制权',
        },
        core: {
          logline: '不应被接受的跨模块补丁',
        },
      },
    }));

    const result = await runFoundationCollaborationByAI(
      createInput({
        userInstruction: '仅补全主角模块',
        targetModule: 'protagonist',
      }),
    );

    expect(result.parseError).toBeNull();
    expect(result.foundationPatch).toEqual({
      protagonist: {
        visibleGoal: '夺回家族控制权',
      },
    });
    expect(result.parseWarnings.some(warning => warning.includes('目标模块外字段'))).toBe(true);
  });

  it('should fallback to natural language when assistantReply is missing', async () => {
    generateRawMock.mockResolvedValue(`这是自然语言说明。\n\n\`\`\`json
{
  "foundationPatch": {
    "core": {
      "logline": "主角在夹缝中求生并反制对手"
    }
  }
}
\`\`\``);

    const result = await runFoundationCollaborationByAI(createInput());

    expect(result.parseError).toBeNull();
    expect(result.assistantText).toContain('这是自然语言说明');
    expect(result.foundationPatch?.core?.logline).toBe('主角在夹缝中求生并反制对手');
  });
});
