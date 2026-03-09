import type { FoundationModuleId, StoryFoundation } from '../types/foundation';

export type FoundationModuleKey = FoundationModuleId | 'extensions';
export type FoundationTierLevel = 'basic' | 'intermediate' | 'advanced';
export type FoundationFieldRole = 'minimum' | 'recommended' | 'optional';

export type FoundationFieldMeta = {
  label: string;
  moduleId: FoundationModuleKey;
  tier: FoundationTierLevel;
  role: FoundationFieldRole;
};

export type FoundationReadinessItem = {
  key: string;
  label: string;
  moduleId: FoundationModuleKey;
  tier: 'basic' | 'intermediate';
};

export type FoundationGenerationReadiness = {
  canGenerate: boolean;
  shouldRemind: boolean;
  blockingItems: FoundationReadinessItem[];
  recommendedItems: FoundationReadinessItem[];
  minimumSatisfiedCount: number;
  minimumTotalCount: number;
};

export type FoundationTierBucketSummary = {
  filled: number;
  total: number;
};

export type FoundationTierSummary = {
  basic: FoundationTierBucketSummary & {
    ready: boolean;
  };
  intermediate: FoundationTierBucketSummary;
  advanced: FoundationTierBucketSummary & {
    hasContent: boolean;
  };
};

type FoundationRequirementRule = FoundationReadinessItem &
  (
    | {
        mode: 'all';
        paths: string[];
      }
    | {
        mode: 'any';
        paths: string[];
      }
  );

export const FOUNDATION_MODULE_LABELS: Record<FoundationModuleId, string> = {
  positioning: '作品定位',
  core: '故事核心',
  protagonist: '主角档案',
  keyRelations: '关键关系',
  conflictFramework: '冲突结构',
  narrativeRules: '叙事规则',
  worldBrief: '世界需求',
  endgame: '终局方向',
};

export const FOUNDATION_MODULE_TIERS: Record<FoundationModuleKey, FoundationTierLevel> = {
  positioning: 'basic',
  core: 'basic',
  protagonist: 'basic',
  keyRelations: 'intermediate',
  conflictFramework: 'intermediate',
  worldBrief: 'intermediate',
  narrativeRules: 'advanced',
  endgame: 'advanced',
  extensions: 'advanced',
};

export const FOUNDATION_MODULE_KEYS_BY_TIER: Record<FoundationTierLevel, FoundationModuleKey[]> = {
  basic: ['positioning', 'core', 'protagonist'],
  intermediate: ['keyRelations', 'conflictFramework', 'worldBrief'],
  advanced: ['narrativeRules', 'endgame', 'extensions'],
};

export const FOUNDATION_FIELD_META: Record<string, FoundationFieldMeta> = {
  'positioning.title': { label: '暂定书名', moduleId: 'positioning', tier: 'basic', role: 'recommended' },
  'positioning.genre': { label: '题材', moduleId: 'positioning', tier: 'basic', role: 'minimum' },
  'positioning.mainType': { label: '主类型', moduleId: 'positioning', tier: 'basic', role: 'recommended' },
  'positioning.subType': { label: '副类型', moduleId: 'positioning', tier: 'basic', role: 'optional' },
  'positioning.targetExperience': { label: '目标体验', moduleId: 'positioning', tier: 'basic', role: 'optional' },
  'positioning.length': { label: '篇幅规划', moduleId: 'positioning', tier: 'basic', role: 'optional' },
  'positioning.audience': { label: '目标读者', moduleId: 'positioning', tier: 'basic', role: 'optional' },
  'positioning.contentIntensity': { label: '内容强度', moduleId: 'positioning', tier: 'basic', role: 'optional' },

  'core.logline': { label: '一句话故事', moduleId: 'core', tier: 'basic', role: 'minimum' },
  'core.coreConflict': { label: '核心冲突', moduleId: 'core', tier: 'basic', role: 'recommended' },
  'core.coreSuspense': { label: '核心悬念', moduleId: 'core', tier: 'basic', role: 'optional' },
  'core.coreSellPoint': { label: '核心卖点', moduleId: 'core', tier: 'basic', role: 'optional' },
  'core.themeKeywords': { label: '主题关键词', moduleId: 'core', tier: 'basic', role: 'optional' },
  'core.emotionalTone': { label: '情绪基调', moduleId: 'core', tier: 'basic', role: 'recommended' },

  'protagonist.name': { label: '主角姓名', moduleId: 'protagonist', tier: 'basic', role: 'minimum' },
  'protagonist.identity': { label: '身份', moduleId: 'protagonist', tier: 'basic', role: 'minimum' },
  'protagonist.visibleGoal': { label: '显性目标', moduleId: 'protagonist', tier: 'basic', role: 'minimum' },
  'protagonist.deepNeed': { label: '深层需求', moduleId: 'protagonist', tier: 'basic', role: 'recommended' },
  'protagonist.coreDesire': { label: '核心欲望', moduleId: 'protagonist', tier: 'basic', role: 'optional' },
  'protagonist.coreFear': { label: '核心恐惧', moduleId: 'protagonist', tier: 'basic', role: 'optional' },
  'protagonist.coreFlaw': { label: '核心缺陷', moduleId: 'protagonist', tier: 'basic', role: 'recommended' },
  'protagonist.behaviorStyle': { label: '行为风格', moduleId: 'protagonist', tier: 'basic', role: 'optional' },
  'protagonist.moralLeaning': { label: '道德倾向', moduleId: 'protagonist', tier: 'basic', role: 'optional' },
  'protagonist.mostCaredAbout': { label: '最在意', moduleId: 'protagonist', tier: 'basic', role: 'optional' },
  'protagonist.bottomLine': { label: '底线', moduleId: 'protagonist', tier: 'basic', role: 'optional' },
  'protagonist.temptation': { label: '诱惑点', moduleId: 'protagonist', tier: 'basic', role: 'optional' },
  'protagonist.arcDirection': { label: '角色弧方向', moduleId: 'protagonist', tier: 'basic', role: 'optional' },

  'keyRelations.antagonist.name': { label: '主要对手', moduleId: 'keyRelations', tier: 'intermediate', role: 'recommended' },
  'keyRelations.antagonist.goal': { label: '对手目标', moduleId: 'keyRelations', tier: 'intermediate', role: 'recommended' },
  'keyRelations.antagonist.conflict': { label: '对位冲突', moduleId: 'keyRelations', tier: 'intermediate', role: 'recommended' },
  'keyRelations.keyCharacters': { label: '关键角色列表', moduleId: 'keyRelations', tier: 'intermediate', role: 'optional' },

  'conflictFramework.mainConflict': { label: '主冲突', moduleId: 'conflictFramework', tier: 'intermediate', role: 'recommended' },
  'conflictFramework.innerConflict': { label: '内在冲突', moduleId: 'conflictFramework', tier: 'intermediate', role: 'optional' },
  'conflictFramework.relationConflict': { label: '关系冲突', moduleId: 'conflictFramework', tier: 'intermediate', role: 'optional' },
  'conflictFramework.externalObstacle': { label: '外部障碍', moduleId: 'conflictFramework', tier: 'intermediate', role: 'recommended' },
  'conflictFramework.failureCost': { label: '失败代价', moduleId: 'conflictFramework', tier: 'intermediate', role: 'recommended' },
  'conflictFramework.timePressure': { label: '时间压力', moduleId: 'conflictFramework', tier: 'intermediate', role: 'optional' },
  'conflictFramework.irreversibleEvents': { label: '不可逆事件', moduleId: 'conflictFramework', tier: 'intermediate', role: 'optional' },
  'conflictFramework.escalationPattern': { label: '升级规律', moduleId: 'conflictFramework', tier: 'intermediate', role: 'optional' },

  'worldBrief.worldType': { label: '世界类型', moduleId: 'worldBrief', tier: 'intermediate', role: 'recommended' },
  'worldBrief.requiredRules': { label: '世界规则', moduleId: 'worldBrief', tier: 'intermediate', role: 'recommended' },
  'worldBrief.keyScenes': { label: '关键场景', moduleId: 'worldBrief', tier: 'intermediate', role: 'optional' },
  'worldBrief.settingPivots': { label: '设定支点', moduleId: 'worldBrief', tier: 'intermediate', role: 'optional' },
  'worldBrief.conflictGeneratingRules': { label: '冲突生成规则', moduleId: 'worldBrief', tier: 'intermediate', role: 'optional' },
  'worldBrief.forbiddenSettings': { label: '禁用设定', moduleId: 'worldBrief', tier: 'intermediate', role: 'optional' },

  'narrativeRules.pov': { label: '视角', moduleId: 'narrativeRules', tier: 'advanced', role: 'optional' },
  'narrativeRules.tenseAndStyle': { label: '时态与风格', moduleId: 'narrativeRules', tier: 'advanced', role: 'optional' },
  'narrativeRules.languageQuality': { label: '语言质量', moduleId: 'narrativeRules', tier: 'advanced', role: 'recommended' },
  'narrativeRules.infoDisclosure': { label: '信息披露策略', moduleId: 'narrativeRules', tier: 'advanced', role: 'optional' },
  'narrativeRules.allowExposition': { label: '允许解释性叙述', moduleId: 'narrativeRules', tier: 'advanced', role: 'optional' },
  'narrativeRules.plotDriver': { label: '剧情驱动', moduleId: 'narrativeRules', tier: 'advanced', role: 'optional' },
  'narrativeRules.romanceWeight': { label: '感情线权重', moduleId: 'narrativeRules', tier: 'advanced', role: 'optional' },
  'narrativeRules.ensembleWeight': { label: '群像权重', moduleId: 'narrativeRules', tier: 'advanced', role: 'optional' },
  'narrativeRules.emphasisTags': { label: '强调标签', moduleId: 'narrativeRules', tier: 'advanced', role: 'optional' },
  'narrativeRules.forbiddenPatterns': { label: '禁用模式', moduleId: 'narrativeRules', tier: 'advanced', role: 'optional' },

  'endgame.overallDirection': { label: '整体走向', moduleId: 'endgame', tier: 'advanced', role: 'optional' },
  'endgame.endingType': { label: '结局类型', moduleId: 'endgame', tier: 'advanced', role: 'recommended' },
  'endgame.protagonistChanges': { label: '主角发生实质变化', moduleId: 'endgame', tier: 'advanced', role: 'optional' },
  'endgame.rootProblem': { label: '根问题', moduleId: 'endgame', tier: 'advanced', role: 'optional' },
  'endgame.readerFeeling': { label: '期望读者感受', moduleId: 'endgame', tier: 'advanced', role: 'optional' },
  'endgame.mustResolve': { label: '必须解决事项', moduleId: 'endgame', tier: 'advanced', role: 'optional' },
};

export const FOUNDATION_MINIMUM_REQUIREMENT_RULES: FoundationRequirementRule[] = [
  {
    key: 'positioning.genre',
    label: '题材',
    moduleId: 'positioning',
    tier: 'basic',
    mode: 'all',
    paths: ['positioning.genre'],
  },
  {
    key: 'core.logline',
    label: '一句话故事',
    moduleId: 'core',
    tier: 'basic',
    mode: 'all',
    paths: ['core.logline'],
  },
  {
    key: 'protagonist.identity-or-name-or-visibleGoal',
    label: '主角信息（姓名 / 身份 / 显性目标至少一项）',
    moduleId: 'protagonist',
    tier: 'basic',
    mode: 'any',
    paths: ['protagonist.name', 'protagonist.identity', 'protagonist.visibleGoal'],
  },
];

export const FOUNDATION_RECOMMENDED_REQUIREMENT_RULES: FoundationRequirementRule[] = [
  {
    key: 'positioning.title',
    label: '暂定书名',
    moduleId: 'positioning',
    tier: 'basic',
    mode: 'all',
    paths: ['positioning.title'],
  },
  {
    key: 'positioning.mainType',
    label: '主类型',
    moduleId: 'positioning',
    tier: 'basic',
    mode: 'all',
    paths: ['positioning.mainType'],
  },
  {
    key: 'core.coreConflict',
    label: '核心冲突',
    moduleId: 'core',
    tier: 'basic',
    mode: 'all',
    paths: ['core.coreConflict'],
  },
  {
    key: 'core.emotionalTone',
    label: '情绪基调',
    moduleId: 'core',
    tier: 'basic',
    mode: 'all',
    paths: ['core.emotionalTone'],
  },
  {
    key: 'protagonist.deepNeed',
    label: '深层需求',
    moduleId: 'protagonist',
    tier: 'basic',
    mode: 'all',
    paths: ['protagonist.deepNeed'],
  },
  {
    key: 'protagonist.coreFlaw',
    label: '核心缺陷',
    moduleId: 'protagonist',
    tier: 'basic',
    mode: 'all',
    paths: ['protagonist.coreFlaw'],
  },
  {
    key: 'keyRelations.antagonist-core',
    label: '关键对手',
    moduleId: 'keyRelations',
    tier: 'intermediate',
    mode: 'all',
    paths: ['keyRelations.antagonist.name', 'keyRelations.antagonist.goal', 'keyRelations.antagonist.conflict'],
  },
  {
    key: 'conflictFramework.mainConflict',
    label: '主冲突',
    moduleId: 'conflictFramework',
    tier: 'intermediate',
    mode: 'all',
    paths: ['conflictFramework.mainConflict'],
  },
  {
    key: 'conflictFramework.failureCost',
    label: '失败代价',
    moduleId: 'conflictFramework',
    tier: 'intermediate',
    mode: 'all',
    paths: ['conflictFramework.failureCost'],
  },
  {
    key: 'worldBrief.worldType',
    label: '世界类型',
    moduleId: 'worldBrief',
    tier: 'intermediate',
    mode: 'all',
    paths: ['worldBrief.worldType'],
  },
  {
    key: 'worldBrief.requiredRules',
    label: '世界规则',
    moduleId: 'worldBrief',
    tier: 'intermediate',
    mode: 'all',
    paths: ['worldBrief.requiredRules'],
  },
];

export function getValueAtPath(target: unknown, fieldPath: string): unknown {
  return fieldPath.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[key];
  }, target);
}

export function hasMeaningfulFoundationValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.some(item => hasMeaningfulFoundationValue(item));
  }

  if (isRecord(value)) {
    return Object.values(value).some(item => hasMeaningfulFoundationValue(item));
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return false;
}

export function hasMeaningfulExtensionContent(foundation: StoryFoundation): boolean {
  return foundation.extensions.some(extension => {
    return hasMeaningfulFoundationValue(extension.title) || hasMeaningfulFoundationValue(extension.fields);
  });
}

export function getFoundationModuleHasContent(
  foundation: StoryFoundation,
  moduleId: FoundationModuleKey,
): boolean {
  if (moduleId === 'extensions') {
    return hasMeaningfulExtensionContent(foundation);
  }

  return hasMeaningfulFoundationValue(foundation[moduleId]);
}

export function computeFoundationGenerationReadiness(
  foundation: StoryFoundation,
): FoundationGenerationReadiness {
  const minimumStatuses = FOUNDATION_MINIMUM_REQUIREMENT_RULES.map(rule => ({
    rule,
    satisfied: isRequirementRuleSatisfied(foundation, rule),
  }));
  const recommendedStatuses = FOUNDATION_RECOMMENDED_REQUIREMENT_RULES.map(rule => ({
    rule,
    satisfied: isRequirementRuleSatisfied(foundation, rule),
  }));

  const blockingItems = minimumStatuses
    .filter(item => !item.satisfied)
    .map(item => ({
      key: item.rule.key,
      label: item.rule.label,
      moduleId: item.rule.moduleId,
      tier: item.rule.tier,
    }));
  const recommendedItems = recommendedStatuses
    .filter(item => !item.satisfied)
    .map(item => ({
      key: item.rule.key,
      label: item.rule.label,
      moduleId: item.rule.moduleId,
      tier: item.rule.tier,
    }));
  const minimumSatisfiedCount = minimumStatuses.filter(item => item.satisfied).length;
  const canGenerate = blockingItems.length === 0;

  return {
    canGenerate,
    shouldRemind: canGenerate && recommendedItems.length > 0,
    blockingItems,
    recommendedItems,
    minimumSatisfiedCount,
    minimumTotalCount: FOUNDATION_MINIMUM_REQUIREMENT_RULES.length,
  };
}

export function getFoundationTierSummary(foundation: StoryFoundation): FoundationTierSummary {
  const basicFilled = FOUNDATION_MODULE_KEYS_BY_TIER.basic.filter(moduleId => getFoundationModuleHasContent(foundation, moduleId)).length;
  const intermediateFilled = FOUNDATION_MODULE_KEYS_BY_TIER.intermediate.filter(moduleId => getFoundationModuleHasContent(foundation, moduleId)).length;
  const advancedFilled = FOUNDATION_MODULE_KEYS_BY_TIER.advanced.filter(moduleId => getFoundationModuleHasContent(foundation, moduleId)).length;
  const readiness = computeFoundationGenerationReadiness(foundation);

  return {
    basic: {
      filled: basicFilled,
      total: FOUNDATION_MODULE_KEYS_BY_TIER.basic.length,
      ready: readiness.canGenerate,
    },
    intermediate: {
      filled: intermediateFilled,
      total: FOUNDATION_MODULE_KEYS_BY_TIER.intermediate.length,
    },
    advanced: {
      filled: advancedFilled,
      total: FOUNDATION_MODULE_KEYS_BY_TIER.advanced.length,
      hasContent: advancedFilled > 0,
    },
  };
}

export function hasAdvancedFoundationContent(foundation: StoryFoundation): boolean {
  return FOUNDATION_MODULE_KEYS_BY_TIER.advanced.some(moduleId => getFoundationModuleHasContent(foundation, moduleId));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRequirementRuleSatisfied(
  foundation: StoryFoundation,
  rule: FoundationRequirementRule,
): boolean {
  if (rule.mode === 'any') {
    return rule.paths.some(path => hasMeaningfulFoundationValue(getValueAtPath(foundation, path)));
  }

  return rule.paths.every(path => hasMeaningfulFoundationValue(getValueAtPath(foundation, path)));
}
