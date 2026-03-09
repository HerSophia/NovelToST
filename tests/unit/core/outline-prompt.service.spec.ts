import { resolveChapterPrompt } from '@/novelToST/core/outline-prompt.service';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import type { NovelSettings } from '@/novelToST/types';
import type { StoryFoundation } from '@/novelToST/types/foundation';
import type { OutlineState } from '@/novelToST/types/outline';

function makeSettings(overrides: Partial<NovelSettings> = {}): NovelSettings {
  const settingsStore = useNovelSettingsStore();
  settingsStore.patch({
    prompt: '继续推进剧情，保持人物一致性',
    ...overrides,
  });

  return {
    ...settingsStore.settings,
    worldbook: {
      ...settingsStore.settings.worldbook,
    },
  };
}

function createFoundation(
  patch?: (store: ReturnType<typeof useFoundationStore>) => void,
): StoryFoundation {
  const foundationStore = useFoundationStore();
  foundationStore.reset();
  patch?.(foundationStore);
  return JSON.parse(JSON.stringify(foundationStore.foundation)) as StoryFoundation;
}

function createOutlineState(overrides: Partial<OutlineState> = {}): OutlineState {
  const base: OutlineState = {
    enabled: false,
    missingDetailPolicy: 'warn_fallback',
    masterOutline: [],
    detailsByChapter: {},
    ai: {
      enabled: true,
      provider: 'tavern',
      model: '',
      temperature: 0.8,
    },
    updatedAt: '2026-01-01T00:00:00.000Z',
    storylines: [],
    sessions: [],
    activeSessionId: null,
  };

  return {
    ...base,
    ...overrides,
    masterOutline: overrides.masterOutline ?? base.masterOutline,
    detailsByChapter: overrides.detailsByChapter ?? base.detailsByChapter,
    ai: overrides.ai ?? base.ai,
    storylines: overrides.storylines ?? base.storylines,
    sessions: overrides.sessions ?? base.sessions,
    activeSessionId: overrides.activeSessionId ?? base.activeSessionId,
    mentionConfig: overrides.mentionConfig ?? base.mentionConfig,
  };
}

describe('outline-prompt.service', () => {
  it('should keep legacy prompt when outline is disabled', () => {
    const settings = makeSettings({ prompt: '旧版 prompt' });
    const outlineState = createOutlineState({ enabled: false });
    const foundation = createFoundation();

    const result = resolveChapterPrompt(3, settings, outlineState, foundation);

    expect(result.prompt).toBe('旧版 prompt');
    expect(result.warning).toBeNull();
    expect(result.usedOutline).toBe(false);
  });

  it('should compose chapter prompt from foundation + master node + detail when detail exists', () => {
    const settings = makeSettings({ prompt: '原始续写要求：维持悬疑节奏' });
    const foundation = createFoundation(store => {
      store.patchModule('positioning', {
        title: '迷雾城',
        genre: '悬疑',
      });
      store.patchModule('core', {
        logline: '失踪案背后藏有组织阴谋',
        emotionalTone: '压迫紧张',
        coreConflict: '真相与人性对立',
      });
      store.patchModule('protagonist', {
        name: '沈越',
        identity: '调查员',
      });
      store.patchModule('keyRelations', {
        keyCharacters: [{ id: 'key-1', name: '林舟', role: '同伴', relationArc: '' }],
      });
      store.patchModule('worldBrief', {
        requiredRules: ['凌晨后全城断电'],
        forbiddenSettings: ['避免超自然解释'],
      });
    });
    const outlineState = createOutlineState({
      enabled: true,
      storylines: [
        {
          id: 'line-main',
          type: 'main',
          title: '主调查线',
          description: '围绕失踪案展开',
          color: '',
          sortOrder: 0,
          status: 'approved',
          extra: {},
        },
      ],
      masterOutline: [
        {
          id: 'node-2',
          storylineId: 'line-main',
          title: '真相逼近',
          summary: '主角接近幕后真相',
          chapterStart: 3,
          chapterEnd: 5,
          turningPoints: ['关键证人反转'],
          status: 'approved',
        },
      ],
      detailsByChapter: {
        3: {
          chapter: 3,
          parentNodeId: 'node-2',
          title: '雨夜对峙',
          goal: '拿到黑匣子',
          conflict: '身份暴露导致谈判破裂',
          beats: ['潜入旧仓库', '与线人对峙'],
          mustInclude: ['黑匣子'],
          mustAvoid: ['长篇回忆'],
          status: 'approved',
        },
      },
    });

    const result = resolveChapterPrompt(3, settings, outlineState, foundation);

    expect(result.warning).toBeNull();
    expect(result.usedOutline).toBe(true);
    expect(result.prompt).toContain('### 一、故事基底');
    expect(result.prompt).toContain('#### 作品定位');
    expect(result.prompt).toContain('迷雾城');
    expect(result.prompt).toContain('### 二、叙事线');
    expect(result.prompt).toContain('### 三、关联总纲节点（第 3-5 章）');
    expect(result.prompt).toContain('### 四、第 3 章细纲');
    expect(result.prompt).toContain('雨夜对峙');
    expect(result.prompt).toContain('黑匣子');
    expect(result.prompt).toContain('### 创作要求');
    expect(result.prompt).toContain('维持悬疑节奏');
  });

  it('should fallback to outline context with warning when detail is missing under warn_fallback policy', () => {
    const settings = makeSettings({ prompt: '旧 prompt' });
    const foundation = createFoundation(store => {
      store.patchModule('positioning', {
        title: '灰烬档案',
        genre: '悬疑',
      });
      store.patchModule('core', {
        logline: '调查旧城失踪案',
        emotionalTone: '克制冷峻',
        coreConflict: '真相与秩序冲突',
      });
      store.patchModule('protagonist', {
        name: '陈渡',
      });
      store.patchModule('worldBrief', {
        requiredRules: ['夜晚实行宵禁'],
      });
      store.patchModule('narrativeRules', {
        forbiddenPatterns: ['避免大段旁白'],
      });
    });
    const outlineState = createOutlineState({
      enabled: true,
      missingDetailPolicy: 'warn_fallback',
      storylines: [
        {
          id: 'storyline-main',
          type: 'main',
          title: '主调查线',
          description: '',
          color: '',
          sortOrder: 0,
          status: 'draft',
          extra: {},
        },
      ],
      masterOutline: [
        {
          id: 'node-1',
          storylineId: 'storyline-main',
          title: '夜访档案室',
          summary: '主角在档案室发现关键线索',
          chapterStart: 1,
          chapterEnd: 3,
          turningPoints: ['线索被人提前篡改'],
          status: 'draft',
        },
      ],
      detailsByChapter: {},
    });

    const result = resolveChapterPrompt(2, settings, outlineState, foundation);

    expect(result.usedOutline).toBe(true);
    expect(result.warning).toEqual({
      code: 'outline_missing_detail_fallback',
      chapter: 2,
      message: '第 2 章缺少细纲，已回退到总纲上下文模式继续生成',
    });
    expect(result.prompt).toContain('无细纲模式');
    expect(result.prompt).toContain('### 一、故事基底');
    expect(result.prompt).toContain('### 二、叙事线');
    expect(result.prompt).toContain('夜访档案室');
    expect(result.prompt).toContain('旧 prompt');
  });

  it('should treat empty placeholder detail as missing and still fallback to outline context', () => {
    const settings = makeSettings({ prompt: '旧 prompt' });
    const outlineState = createOutlineState({
      enabled: true,
      missingDetailPolicy: 'warn_fallback',
      masterOutline: [
        {
          id: 'node-2',
          title: '调查受阻',
          summary: '',
          chapterStart: 2,
          chapterEnd: 2,
          turningPoints: ['关键证词失效'],
          status: 'draft',
        },
      ],
      detailsByChapter: {
        2: {
          chapter: 2,
          parentNodeId: '',
          title: '',
          goal: '',
          conflict: '',
          beats: [],
          mustInclude: [],
          mustAvoid: [],
          status: 'draft',
        },
      },
    });
    const foundation = createFoundation();

    const result = resolveChapterPrompt(2, settings, outlineState, foundation);

    expect(result.prompt).toContain('调查受阻');
    expect(result.warning?.chapter).toBe(2);
    expect(result.warning?.code).toBe('outline_missing_detail_fallback');
    expect(result.usedOutline).toBe(true);
  });

  it('should fallback to legacy prompt when detail is missing and no outline node is available', () => {
    const settings = makeSettings({ prompt: '旧 prompt' });
    const outlineState = createOutlineState({
      enabled: true,
      missingDetailPolicy: 'warn_fallback',
      masterOutline: [],
      detailsByChapter: {},
    });
    const foundation = createFoundation();

    const result = resolveChapterPrompt(2, settings, outlineState, foundation);

    expect(result.prompt).toBe('旧 prompt');
    expect(result.warning).toEqual({
      code: 'outline_missing_detail_fallback',
      chapter: 2,
      message: '第 2 章缺少细纲，且未匹配到可用总纲节点，已回退到通用 prompt',
    });
    expect(result.usedOutline).toBe(false);
  });

  it('should throw when detail is missing under strict_block policy', () => {
    const settings = makeSettings();
    const outlineState = createOutlineState({
      enabled: true,
      missingDetailPolicy: 'strict_block',
      detailsByChapter: {},
    });
    const foundation = createFoundation();

    expect(() => resolveChapterPrompt(4, settings, outlineState, foundation)).toThrow(
      '第 4 章缺少细纲，已按 strict_block 阻断生成',
    );
  });
});
