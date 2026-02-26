import type { NovelWorldbookSettings } from '../../types';

export type WorldbookCategoryDefinition = {
  name: string;
  enabled: boolean;
  isBuiltin: boolean;
  entryExample: string;
  keywordsExample: string[];
  contentGuide: string;
  defaultPosition: number;
  defaultDepth: number;
  defaultOrder: number;
  autoIncrementOrder: boolean;
};

export type EnabledCategoryNameOptions = {
  includePlotOutline?: boolean;
  includeLiteraryStyle?: boolean;
  includeKnowledgeBook?: boolean;
  includeEnvironmentMap?: boolean;
  includePlotNodes?: boolean;
  extraCategories?: string[];
};

export const DEFAULT_WORLDBOOK_CATEGORIES: WorldbookCategoryDefinition[] = [
  {
    name: '角色',
    enabled: true,
    isBuiltin: true,
    entryExample: '角色真实姓名',
    keywordsExample: ['真实姓名', '称呼1', '称呼2', '绰号'],
    contentGuide:
      '基于原文的角色描述，包含但不限于**名称**:（必须要）、**性别**:、**MBTI(必须要，如变化请说明背景)**:、**貌龄**:、**年龄**:、**身份**:、**背景**:、**性格**:、**外貌**:、**技能**:、**重要事件**:、**话语示例**:、**弱点**:、**背景故事**:等（实际嵌套或者排列方式按合理的逻辑）',
    defaultPosition: 0,
    defaultDepth: 4,
    defaultOrder: 100,
    autoIncrementOrder: false,
  },
  {
    name: '地点',
    enabled: true,
    isBuiltin: true,
    entryExample: '地点真实名称',
    keywordsExample: ['地点名', '别称', '俗称'],
    contentGuide: '基于原文的地点描述，包含但不限于**名称**:（必须要）、**位置**:、**特征**:、**重要事件**:等（实际嵌套或者排列方式按合理的逻辑）',
    defaultPosition: 0,
    defaultDepth: 4,
    defaultOrder: 100,
    autoIncrementOrder: false,
  },
  {
    name: '组织',
    enabled: true,
    isBuiltin: true,
    entryExample: '组织真实名称',
    keywordsExample: ['组织名', '简称', '代号'],
    contentGuide: '基于原文的组织描述，包含但不限于**名称**:（必须要）、**性质**:、**成员**:、**目标**:等（实际嵌套或者排列方式按合理的逻辑）',
    defaultPosition: 0,
    defaultDepth: 4,
    defaultOrder: 100,
    autoIncrementOrder: false,
  },
  {
    name: '道具',
    enabled: false,
    isBuiltin: false,
    entryExample: '道具名称',
    keywordsExample: ['道具名', '别名'],
    contentGuide: '基于原文的道具描述，包含但不限于**名称**:、**类型**:、**功能**:、**来源**:、**持有者**:等',
    defaultPosition: 0,
    defaultDepth: 4,
    defaultOrder: 100,
    autoIncrementOrder: false,
  },
  {
    name: '玩法',
    enabled: false,
    isBuiltin: false,
    entryExample: '玩法名称',
    keywordsExample: ['玩法名', '规则名'],
    contentGuide: '基于原文的玩法/规则描述，包含但不限于**名称**:、**规则说明**:、**参与条件**:、**奖惩机制**:等',
    defaultPosition: 0,
    defaultDepth: 4,
    defaultOrder: 100,
    autoIncrementOrder: false,
  },
  {
    name: '章节剧情',
    enabled: false,
    isBuiltin: false,
    entryExample: '第X章',
    keywordsExample: ['章节名', '章节号'],
    contentGuide: '该章节的剧情概要，包含但不限于**章节标题**:、**主要事件**:、**出场角色**:、**关键转折**:、**伏笔线索**:等',
    defaultPosition: 0,
    defaultDepth: 4,
    defaultOrder: 100,
    autoIncrementOrder: false,
  },
  {
    name: '角色内心',
    enabled: false,
    isBuiltin: false,
    entryExample: '角色名-内心世界',
    keywordsExample: ['角色名', '内心', '心理'],
    contentGuide: '角色的内心想法和心理活动，包含但不限于**原文内容**:、**内心独白**:、**情感变化**:、**动机分析**:、**心理矛盾**:等',
    defaultPosition: 0,
    defaultDepth: 4,
    defaultOrder: 100,
    autoIncrementOrder: false,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.trunc(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[;,，；\n\r]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function cloneWorldbookCategories(categories: ReadonlyArray<WorldbookCategoryDefinition> = DEFAULT_WORLDBOOK_CATEGORIES): WorldbookCategoryDefinition[] {
  return categories.map((category) => ({
    ...category,
    keywordsExample: [...category.keywordsExample],
  }));
}

function normalizeOneCategory(raw: unknown): WorldbookCategoryDefinition | null {
  if (!isRecord(raw)) {
    return null;
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    return null;
  }

  const keywordsExample = normalizeStringArray(raw.keywordsExample);

  return {
    name,
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : true,
    isBuiltin: raw.isBuiltin !== undefined ? Boolean(raw.isBuiltin) : false,
    entryExample: typeof raw.entryExample === 'string' ? raw.entryExample : `${name}条目`,
    keywordsExample: keywordsExample.length > 0 ? keywordsExample : [name],
    contentGuide: typeof raw.contentGuide === 'string' ? raw.contentGuide : '',
    defaultPosition: toInteger(raw.defaultPosition, 0),
    defaultDepth: Math.max(0, toInteger(raw.defaultDepth, 4)),
    defaultOrder: toInteger(raw.defaultOrder, 100),
    autoIncrementOrder: Boolean(raw.autoIncrementOrder),
  };
}

export function normalizeWorldbookCategories(raw: unknown, fallback: ReadonlyArray<WorldbookCategoryDefinition> = DEFAULT_WORLDBOOK_CATEGORIES): WorldbookCategoryDefinition[] {
  if (!Array.isArray(raw)) {
    return cloneWorldbookCategories(fallback);
  }

  const result: WorldbookCategoryDefinition[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const normalized = normalizeOneCategory(item);
    if (!normalized || seen.has(normalized.name)) {
      continue;
    }
    seen.add(normalized.name);
    result.push(normalized);
  }

  if (result.length === 0) {
    return cloneWorldbookCategories(fallback);
  }

  return result;
}

export function getEnabledCategories(categories: ReadonlyArray<WorldbookCategoryDefinition>): WorldbookCategoryDefinition[] {
  return categories.filter((category) => category.enabled);
}

export function getEnabledCategoryNames(
  categories: ReadonlyArray<WorldbookCategoryDefinition>,
  options: EnabledCategoryNameOptions = {},
): string[] {
  const names = getEnabledCategories(categories).map((category) => category.name);

  if (options.includePlotOutline) {
    names.push('剧情大纲');
  }
  if (options.includeLiteraryStyle) {
    names.push('文风配置');
  }
  if (options.includeKnowledgeBook) {
    names.push('知识书');
  }
  if (options.includeEnvironmentMap) {
    names.push('地图环境');
  }
  if (options.includePlotNodes) {
    names.push('剧情节点');
  }

  for (const extra of options.extraCategories ?? []) {
    const normalized = extra.trim();
    if (normalized) {
      names.push(normalized);
    }
  }

  return Array.from(new Set(names));
}

export function getEnabledCategoryNamesFromSettings(
  categories: ReadonlyArray<WorldbookCategoryDefinition>,
  settings: Pick<NovelWorldbookSettings, 'enablePlotOutline' | 'enableLiteraryStyle'>,
): string[] {
  return getEnabledCategoryNames(categories, {
    includePlotOutline: settings.enablePlotOutline,
    includeLiteraryStyle: settings.enableLiteraryStyle,
  });
}

export function generateDynamicJsonTemplate(categories: ReadonlyArray<WorldbookCategoryDefinition>): string {
  const enabledCategories = getEnabledCategories(categories);
  if (enabledCategories.length === 0) {
    return '{}';
  }

  const blocks = enabledCategories.map((category) => {
    const categoryBlock = {
      [category.name]: {
        [category.entryExample]: {
          关键词: category.keywordsExample,
          内容: category.contentGuide,
        },
      },
    };

    return JSON.stringify(categoryBlock, null, 2).slice(2, -2);
  });

  return `{
${blocks.join(',\n')}
}`;
}

export function normalizeCategoryLightSettings(raw: Record<string, boolean> | null | undefined): Record<string, boolean> {
  if (!raw) {
    return {};
  }

  const result: Record<string, boolean> = {};
  for (const [category, state] of Object.entries(raw)) {
    if (!category.trim()) {
      continue;
    }
    result[category] = Boolean(state);
  }

  return result;
}

export function getCategoryLightState(category: string, lightSettings: Record<string, boolean> | null | undefined): boolean {
  const normalizedCategory = category.trim();
  if (!normalizedCategory || !lightSettings) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(lightSettings, normalizedCategory)) {
    return Boolean(lightSettings[normalizedCategory]);
  }

  return false;
}

export function setCategoryLightState(
  category: string,
  isGreen: boolean,
  lightSettings: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  const normalizedCategory = category.trim();
  if (!normalizedCategory) {
    return normalizeCategoryLightSettings(lightSettings ?? undefined);
  }

  return {
    ...normalizeCategoryLightSettings(lightSettings ?? undefined),
    [normalizedCategory]: Boolean(isGreen),
  };
}
