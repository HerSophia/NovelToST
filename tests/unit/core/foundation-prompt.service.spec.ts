import {
  buildFoundationPromptSection,
  buildFoundationSection,
  buildFoundationWorldBriefSection,
} from '@/novelToST/core/foundation-prompt.service';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import type { StoryFoundation } from '@/novelToST/types/foundation';

function createFoundation(
  patch?: (store: ReturnType<typeof useFoundationStore>) => void,
): StoryFoundation {
  const foundationStore = useFoundationStore();
  foundationStore.reset();
  patch?.(foundationStore);
  return JSON.parse(JSON.stringify(foundationStore.foundation)) as StoryFoundation;
}

describe('foundation-prompt.service', () => {
  it('should render compact foundation prompt sections with dedupe and list limits', () => {
    const foundation = createFoundation(store => {
      store.patchModule('positioning', {
        title: '星港纪事',
        genre: '科幻悬疑',
        targetExperience: ['紧张', '沉浸', '紧张', '反转', '额外体验'],
        contentIntensity: ['高压', '快节奏', '高压', '强冲突', '额外强度'],
      });
      store.patchModule('core', {
        logline: '失踪案背后藏有港区实验阴谋。',
        coreConflict: '公开真相与维护秩序之间的对立',
        themeKeywords: ['身份', '背叛', '命运', '多余主题'],
        emotionalTone: '冷峻压迫',
      });
      store.patchModule('protagonist', {
        name: '黎曜',
        identity: '港区调查员',
        visibleGoal: '查清失踪案',
      });
      store.patchModule('keyRelations', {
        antagonist: {
          name: '赫因',
          goal: '掩盖实验真相',
          conflict: '阻止主角继续调查',
        },
        keyCharacters: [
          { id: 'kc-1', name: '周岚', role: '同伴', relationArc: '从怀疑到合作' },
          { id: 'kc-2', name: '安策', role: '线人', relationArc: '互相利用' },
          { id: 'kc-3', name: '白芮', role: '记者', relationArc: '共同追查' },
          { id: 'kc-4', name: '顾晟', role: '军官', relationArc: '立场摇摆' },
          { id: 'kc-5', name: '阮青', role: '黑客', relationArc: '不应出现' },
        ],
      });
      store.patchModule('worldBrief', {
        requiredRules: ['禁飞', '潮汐城', '禁飞', '夜间封港', '身份芯片', '磁暴潮', '多余规则'],
        forbiddenSettings: ['时间倒流'],
      });
      store.patchModule('conflictFramework', {
        mainConflict: '公开真相会先引爆港区秩序',
        failureCost: '港区被永久封锁',
        externalObstacle: '调查权限被财团层层切断',
        timePressure: '七天后实验数据会被彻底清除',
      });
      store.patchModule('endgame', {
        mustResolve: ['实验真相', '主角选择', '城市命运', '同伴去留', '额外事项'],
      });
    });

    const result = buildFoundationPromptSection(foundation);

    expect(result).toContain('【作品定位】');
    expect(result).toContain('【故事核心】');
    expect(result).toContain('【主角档案】');
    expect(result).toContain('【关键关系】');
    expect(result).toContain('【冲突结构】');
    expect(result).toContain('- 失败代价：港区被永久封锁');
    expect(result).toContain('- 外部阻力：调查权限被财团层层切断');
    expect(result).toContain('- 目标体验：紧张；沉浸；反转');
    expect(result).toContain('- 内容强度：高压；快节奏；强冲突');
    expect(result).toContain('- 主题关键词：身份；背叛；命运');
    expect(result).toContain('周岚：同伴；从怀疑到合作');
    expect(result).toContain('顾晟：军官；立场摇摆');
    expect(result).not.toContain('阮青');
    expect(result).toContain('- 必须保留的世界规则：禁飞；潮汐城；夜间封港；身份芯片；磁暴潮');
    expect(result).not.toContain('多余规则');
    expect(result).toContain('- 必须解决事项：实验真相；主角选择；城市命运；同伴去留');
    expect(result).not.toContain('额外事项');
  });

  it('should render detailed section with conflict framework and extension summary', () => {
    const foundation = createFoundation(store => {
      store.patchModule('positioning', {
        title: '灰港回声',
        genre: '都市悬疑',
      });
      store.patchModule('core', {
        logline: '主角在旧港区追查一宗被掩盖的实验事故。',
        coreConflict: '揭露真相会同时摧毁现有秩序',
      });
      store.patchModule('conflictFramework', {
        mainConflict: '调查推进与官方封锁持续对撞',
        failureCost: '整座港区被永久封锁',
        irreversibleEvents: ['证人死亡', '证据外泄'],
      });
      store.patchModule('worldBrief', {
        worldType: '近未来港口都市',
      });
    });

    foundation.extensions = [
      {
        id: 'ext-politics',
        title: '政体补充',
        fields: {
          faction: '联邦议会',
          rule: '议席长期被财团垄断',
          note: '港区议案需要同时经过军方备案',
        },
      },
    ];

    const result = buildFoundationSection(foundation);

    expect(result).toContain('#### 作品定位');
    expect(result).toContain('#### 故事核心');
    expect(result).toContain('#### 冲突结构');
    expect(result).toContain('#### 世界需求');
    expect(result).toContain('- 主冲突：调查推进与官方封锁持续对撞');
    expect(result).toContain('- 失败代价：整座港区被永久封锁');
    expect(result).toContain('#### 扩展模块');
    expect(result).toContain('- 政体补充');
    expect(result).toContain('字段：faction、rule、note');
    expect(result).toContain('内容摘要：{"faction":"联邦议会"');
    expect(result).not.toContain('#### 终局方向');
  });

  it('should append truncation suffix when section exceeds maxLength', () => {
    const foundation = createFoundation(store => {
      store.patchModule('positioning', {
        title: '长篇计划',
        genre: '科幻',
      });
      store.patchModule('core', {
        logline: 'L'.repeat(120),
        coreConflict: 'C'.repeat(120),
      });
      store.patchModule('protagonist', {
        name: '主角',
        visibleGoal: 'G'.repeat(120),
      });
    });

    const result = buildFoundationSection(foundation, { maxLength: 80 });

    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.endsWith('…（已截断）')).toBe(true);
  });

  it('should render worldbuilding brief section with focused foundation context only', () => {
    const foundation = createFoundation(store => {
      store.patchModule('positioning', {
        title: '不应进入世界观摘要的标题',
        genre: '奇幻',
      });
      store.patchModule('core', {
        logline: '边境都市正在被失控仪式侵蚀。',
        coreConflict: '维持秩序与打破旧规则之间的冲突',
        emotionalTone: '压迫不安',
      });
      store.patchModule('protagonist', {
        name: '沈砚',
        identity: '边境记录官',
        visibleGoal: '阻止仪式扩散',
      });
      store.patchModule('keyRelations', {
        antagonist: {
          name: '闻烬',
          goal: '完成仪式重塑城市',
          conflict: '主角必须阻止他',
        },
      });
      store.patchModule('worldBrief', {
        worldType: '边境仪式都市',
        requiredRules: ['午夜后禁止点火', '城门每日黎明重置'],
        forbiddenSettings: ['禁止时间回溯'],
      });
      store.patchModule('narrativeRules', {
        forbiddenPatterns: ['避免万能解释'],
      });
      store.patchModule('endgame', {
        endingType: '悲喜交织',
      });
    });

    const result = buildFoundationWorldBriefSection(foundation);

    expect(result).toContain('【世界需求】');
    expect(result).toContain('【故事核心】');
    expect(result).toContain('【主角与对手】');
    expect(result).toContain('【叙事禁区】');
    expect(result).toContain('- 必须保留的世界规则：午夜后禁止点火；城门每日黎明重置');
    expect(result).toContain('- 主角：沈砚');
    expect(result).toContain('- 对手：闻烬');
    expect(result).toContain('- 禁止套路：避免万能解释');
    expect(result).toContain('- 禁用设定：禁止时间回溯');
    expect(result).not.toContain('不应进入世界观摘要的标题');
    expect(result).not.toContain('【终局方向】');
  });
});
