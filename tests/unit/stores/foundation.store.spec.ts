import { useFoundationStore } from '@/novelToST/stores/foundation.store';

describe('foundation.store', () => {
  it('should initialize with empty foundation state', () => {
    const store = useFoundationStore();

    expect(store.foundation.positioning.genre).toBe('');
    expect(store.foundation.core.logline).toBe('');
    expect(store.foundation.protagonist.visibleGoal).toBe('');
    expect(store.foundation.keyRelations.antagonist.name).toBe('');
    expect(store.foundation.conflictFramework.mainConflict).toBe('');
    expect(store.foundation.narrativeRules.languageQuality).toBe('');
    expect(store.foundation.worldBrief.worldType).toBe('');
    expect(store.foundation.endgame.endingType).toBe('');
    expect(store.foundation.extensions).toEqual([]);
    expect(store.messages).toEqual([]);

    expect(store.moduleStatuses.positioning).toBe('empty');
    expect(store.moduleStatuses.core).toBe('empty');
    expect(store.moduleStatuses.protagonist).toBe('empty');
    expect(store.moduleStatuses.keyRelations).toBe('empty');
    expect(store.moduleStatuses.conflictFramework).toBe('empty');
    expect(store.moduleStatuses.narrativeRules).toBe('empty');
    expect(store.moduleStatuses.worldBrief).toBe('empty');
    expect(store.moduleStatuses.endgame).toBe('empty');
    expect(store.completedCount).toBe(0);
    expect(store.totalModuleCount).toBe(8);
  });

  it('should patch module fields and replace arrays', () => {
    const store = useFoundationStore();
    const previousUpdatedAt = store.updatedAt;

    store.patchModule('positioning', {
      genre: '  古风权谋  ',
      mainType: '  权谋  ',
      targetExperience: ['高压', '持续上头', '反转多'],
    });

    expect(store.foundation.positioning.genre).toBe('古风权谋');
    expect(store.foundation.positioning.mainType).toBe('权谋');
    expect(store.foundation.positioning.targetExperience).toEqual(['高压', '持续上头', '反转多']);
    expect(store.moduleStatuses.positioning).toBe('complete');
    expect(store.updatedAt).not.toBe(previousUpdatedAt);

    store.patchModule('positioning', {
      targetExperience: ['新的体验'],
    });

    expect(store.foundation.positioning.targetExperience).toEqual(['新的体验']);
    expect(store.foundation.core.logline).toBe('');

    store.patchModule('positioning', {
      genre: '题材A',
      unknownField: 'ignored',
    } as any);

    expect((store.foundation.positioning as any).unknownField).toBeUndefined();
  });

  it('should apply foundation patch with partial merge semantics', () => {
    const store = useFoundationStore();

    store.patchModule('keyRelations', {
      antagonist: {
        name: '对手甲',
        goal: '夺位',
        conflict: '与主角争权',
      },
    });

    const previousUpdatedAt = store.updatedAt;

    store.applyFoundationPatch({
      core: {
        logline: '  一句故事  ',
        coreConflict: '  核心矛盾  ',
        coreSellPoint: '  卖点  ',
        emotionalTone: '  冷感  ',
      },
      keyRelations: {
        antagonist: {
          goal: '  改成夺嫡  ',
        },
      },
    });

    expect(store.foundation.core.logline).toBe('一句故事');
    expect(store.foundation.core.coreConflict).toBe('核心矛盾');
    expect(store.foundation.keyRelations.antagonist.name).toBe('对手甲');
    expect(store.foundation.keyRelations.antagonist.goal).toBe('改成夺嫡');
    expect(store.foundation.keyRelations.antagonist.conflict).toBe('与主角争权');
    expect(store.updatedAt).not.toBe(previousUpdatedAt);

    const updatedAtAfterPatch = store.updatedAt;
    store.applyFoundationPatch({});
    expect(store.updatedAt).toBe(updatedAtAfterPatch);
  });

  it('should compute module statuses from required fields', () => {
    const store = useFoundationStore();

    store.patchModule('protagonist', {
      visibleGoal: '活下去',
    });
    expect(store.moduleStatuses.protagonist).toBe('partial');

    store.patchModule('protagonist', {
      deepNeed: '学会信任',
      coreFlaw: '过度防御',
    });
    expect(store.moduleStatuses.protagonist).toBe('complete');

    store.patchModule('keyRelations', {
      antagonist: {
        name: '对手乙',
      },
    });
    expect(store.moduleStatuses.keyRelations).toBe('partial');

    store.patchModule('keyRelations', {
      antagonist: {
        goal: '击败主角',
        conflict: '理念对立',
      },
    });
    expect(store.moduleStatuses.keyRelations).toBe('complete');

    expect(store.moduleStatuses.worldBrief).toBe('empty');
    store.patchModule('worldBrief', {
      worldType: '高压等级社会',
    });
    expect(store.moduleStatuses.worldBrief).toBe('complete');
  });

  it('should expose generation readiness and tier summary without changing legacy module status semantics', () => {
    const store = useFoundationStore();

    expect(store.generationReadiness.canGenerate).toBe(false);
    expect(store.generationReadiness.blockingItems.map(item => item.key)).toEqual([
      'positioning.genre',
      'core.logline',
      'protagonist.identity-or-name-or-visibleGoal',
    ]);
    expect(store.tierSummary.basic).toEqual({
      filled: 0,
      total: 3,
      ready: false,
    });
    expect(store.hasAdvancedContent).toBe(false);

    store.patchModule('positioning', {
      genre: '赛博成长',
    });
    expect(store.moduleStatuses.positioning).toBe('partial');

    store.patchModule('core', {
      logline: '失忆维修工发现自己正被过去的自己追杀。',
    });
    store.patchModule('protagonist', {
      name: '林澈',
    });

    expect(store.generationReadiness.canGenerate).toBe(true);
    expect(store.generationReadiness.shouldRemind).toBe(true);
    expect(store.generationReadiness.minimumSatisfiedCount).toBe(3);
    expect(store.tierSummary.basic).toEqual({ filled: 3, total: 3, ready: true });

    store.patchModule('narrativeRules', { languageQuality: '冷峻克制' });
    expect(store.hasAdvancedContent).toBe(true);
    expect(store.tierSummary.advanced).toEqual({ filled: 1, total: 3, hasContent: true });
  });

  it('should hydrate valid state and normalize fields', () => {
    const store = useFoundationStore();

    store.hydrate({
      foundation: {
        positioning: {
          title: '  暂定书名  ',
          genre: '  都市悬疑  ',
          mainType: '  悬疑  ',
          subType: '  成长  ',
          targetExperience: ['  高压  ', '  持续上头  ', '  反转  ', '  超出限制  '],
          length: '  长篇  ',
          audience: '  泛读者  ',
          contentIntensity: ['  高反转  ', '  高情绪  ', '  高设定  ', '  多余项  '],
        },
        core: {
          logline: '  一句话故事  ',
          coreConflict: '  核心矛盾  ',
          coreSuspense: '  悬念  ',
          coreSellPoint: '  卖点  ',
          themeKeywords: ['  身份  ', '  背叛  ', '  救赎  ', '  多余项  '],
          emotionalTone: '  压抑  ',
        },
        protagonist: {
          visibleGoal: '  找到真相  ',
          deepNeed: '  完成和解  ',
          coreFlaw: '  不信任任何人  ',
        },
        keyRelations: {
          antagonist: {
            name: '  反派  ',
            goal: '  掌控城市  ',
            conflict: '  价值观对立  ',
          },
          keyCharacters: [
            {
              id: '',
              name: '  盟友  ',
              role: '  提供信息  ',
              relationArc: '  怀疑到信任  ',
            },
          ],
        },
        conflictFramework: {
          mainConflict: '  主线冲突  ',
          failureCost: '  城市失控  ',
        },
        narrativeRules: {
          languageQuality: '  克制  ',
          allowExposition: true,
        },
        worldBrief: {
          worldType: '  资源稀缺社会  ',
        },
        endgame: {
          endingType: '  苦涩圆满  ',
        },
        extensions: [
          {
            id: '',
            title: '  额外模块  ',
            fields: {
              focus: 'memory',
            },
          },
        ],
      },
      messages: [
        {
          id: '',
          role: 'assistant',
          text: '  已补全主角档案  ',
          createdAt: '2026-03-01T00:00:00.000Z',
          parseError: '  ',
          rawResponse: ' 原始响应 ',
        },
      ],
      updatedAt: '2026-03-01T00:10:00.000Z',
    });

    expect(store.foundation.positioning.title).toBe('暂定书名');
    expect(store.foundation.positioning.targetExperience).toEqual(['高压', '持续上头', '反转']);
    expect(store.foundation.positioning.contentIntensity).toEqual(['高反转', '高情绪', '高设定']);
    expect(store.foundation.core.themeKeywords).toEqual(['身份', '背叛', '救赎']);
    expect(store.foundation.keyRelations.antagonist.name).toBe('反派');
    expect(store.foundation.keyRelations.keyCharacters[0]?.id.length).toBeGreaterThan(0);
    expect(store.foundation.keyRelations.keyCharacters[0]?.name).toBe('盟友');
    expect(store.foundation.extensions[0]?.id.length).toBeGreaterThan(0);
    expect(store.foundation.extensions[0]?.title).toBe('额外模块');
    expect(store.messages[0]?.id.length).toBeGreaterThan(0);
    expect(store.messages[0]?.text).toBe('已补全主角档案');
    expect(store.messages[0]?.parseError).toBeNull();
    expect(store.updatedAt).toBe('2026-03-01T00:10:00.000Z');
    expect(store.completedCount).toBeGreaterThan(0);
  });

  it('should fallback to empty state on invalid hydrate input', () => {
    const store = useFoundationStore();

    store.patchModule('positioning', {
      genre: '赛博成长',
      mainType: '成长',
    });

    store.hydrate(null);

    expect(store.foundation.positioning.genre).toBe('');
    expect(store.foundation.positioning.mainType).toBe('');
    expect(store.messages).toEqual([]);
    expect(store.completedCount).toBe(0);
  });

  it('should return deep-cloned snapshot and support reset roundtrip', () => {
    const store = useFoundationStore();

    store.patchModule('positioning', {
      genre: '古风权谋',
      mainType: '权谋',
    });
    store.addMessage({ role: 'user', text: '请补全故事核心句' });

    const snapshot = store.toStateSnapshot();
    snapshot.foundation.positioning.genre = '已修改快照';
    snapshot.messages[0]!.text = '已修改消息';

    expect(store.foundation.positioning.genre).toBe('古风权谋');
    expect(store.messages[0]?.text).toBe('请补全故事核心句');

    const stableSnapshot = store.snapshot();
    store.reset();
    store.hydrate(stableSnapshot);

    expect(store.foundation.positioning.genre).toBe('古风权谋');
    expect(store.messages[0]?.text).toBe('请补全故事核心句');
  });

  it('should support keyCharacters CRUD', () => {
    const store = useFoundationStore();

    const id = store.addKeyCharacter({
      name: '  关键角色  ',
      role: '  推动主线  ',
      relationArc: '  敌对到合作  ',
    });

    expect(id).not.toBe('');
    expect(store.foundation.keyRelations.keyCharacters).toHaveLength(1);
    expect(store.foundation.keyRelations.keyCharacters[0]?.name).toBe('关键角色');

    store.updateKeyCharacter(id, {
      role: '  提供信息  ',
    });
    expect(store.foundation.keyRelations.keyCharacters[0]?.role).toBe('提供信息');

    store.removeKeyCharacter(id);
    expect(store.foundation.keyRelations.keyCharacters).toEqual([]);

    store.updateKeyCharacter('missing-id', { name: '不会报错' });
    store.removeKeyCharacter('missing-id');
    expect(store.foundation.keyRelations.keyCharacters).toEqual([]);
  });

  it('should support extensions CRUD', () => {
    const store = useFoundationStore();

    const id = store.addExtension({
      title: '  自定义模块  ',
      fields: {
        mood: 'dark',
      },
    });

    expect(id).not.toBe('');
    expect(store.foundation.extensions).toHaveLength(1);
    expect(store.foundation.extensions[0]?.title).toBe('自定义模块');

    store.updateExtension(id, {
      title: '  自定义模块-改  ',
      fields: { mood: 'warm' },
    });
    expect(store.foundation.extensions[0]?.title).toBe('自定义模块-改');
    expect(store.foundation.extensions[0]?.fields).toEqual({ mood: 'warm' });

    store.removeExtension(id);
    expect(store.foundation.extensions).toEqual([]);

    store.updateExtension('missing-id', { title: '不会报错' });
    store.removeExtension('missing-id');
    expect(store.foundation.extensions).toEqual([]);
  });

  it('should support message operations', () => {
    const store = useFoundationStore();

    const message = store.addMessage({
      role: 'assistant',
      text: '  我已补全主角显性目标  ',
      parseError: null,
      rawResponse: 'raw text',
    });

    expect(message.id).not.toBe('');
    expect(message.text).toBe('我已补全主角显性目标');
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0]?.rawResponse).toBe('raw text');

    store.clearMessages();
    expect(store.messages).toEqual([]);
  });
});
