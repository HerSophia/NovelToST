import type {
  FoundationConflictFramework,
  FoundationCore,
  FoundationEndgame,
  FoundationExtensionModule,
  FoundationKeyCharacter,
  FoundationKeyRelations,
  FoundationNarrativeRules,
  FoundationPositioning,
  FoundationProtagonist,
  FoundationWorldBrief,
  StoryFoundation,
} from '../types/foundation';

type FoundationSectionOptions = {
  maxLength?: number;
};

const TRUNCATION_SUFFIX = '…（已截断）';

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringList(values: readonly string[] | undefined | null, maxCount?: number): string[] {
  const deduped = [...new Set((values ?? []).map(item => item.trim()).filter(Boolean))];
  return typeof maxCount === 'number' ? deduped.slice(0, Math.max(0, maxCount)) : deduped;
}

function compactLines(lines: Array<string | null | undefined>): string[] {
  return lines.filter((line): line is string => Boolean(line && line.trim()));
}

function optionalLine(label: string, value: unknown): string | null {
  const normalized = trimOrEmpty(value);
  return normalized ? `- ${label}：${normalized}` : null;
}

function optionalListLine(label: string, values: readonly string[] | undefined | null, maxCount?: number): string | null {
  const normalized = normalizeStringList(values, maxCount);
  return normalized.length > 0 ? `- ${label}：${normalized.join('；')}` : null;
}

function truncateText(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return '';
  }

  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= TRUNCATION_SUFFIX.length) {
    return TRUNCATION_SUFFIX.slice(0, maxLength);
  }

  return `${value.slice(0, Math.max(0, maxLength - TRUNCATION_SUFFIX.length)).trimEnd()}${TRUNCATION_SUFFIX}`;
}

function finalizeSection(lines: string[], maxLength: number): string {
  const normalized = lines.filter(line => line.trim().length > 0);
  if (normalized.length === 0) {
    return '（当前故事基底为空）';
  }

  const joined = normalized.join('\n');
  return truncateText(joined, maxLength);
}

function buildPositioningLines(positioning: FoundationPositioning): string[] {
  return compactLines([
    optionalLine('标题', positioning.title),
    optionalLine('题材', positioning.genre),
    optionalLine('主类型', positioning.mainType),
    optionalLine('子类型', positioning.subType),
    optionalListLine('目标体验', positioning.targetExperience, 3),
    optionalLine('篇幅定位', positioning.length),
    optionalLine('目标读者', positioning.audience),
    optionalListLine('内容强度', positioning.contentIntensity, 3),
  ]);
}

function buildCoreLines(core: FoundationCore): string[] {
  return compactLines([
    optionalLine('一句话故事', core.logline),
    optionalLine('核心冲突', core.coreConflict),
    optionalLine('核心悬念', core.coreSuspense),
    optionalLine('核心卖点', core.coreSellPoint),
    optionalListLine('主题关键词', core.themeKeywords, 3),
    optionalLine('情绪基调', core.emotionalTone),
  ]);
}

function buildProtagonistLines(protagonist: FoundationProtagonist): string[] {
  return compactLines([
    optionalLine('主角姓名', protagonist.name),
    optionalLine('主角身份', protagonist.identity),
    optionalLine('显性目标', protagonist.visibleGoal),
    optionalLine('深层需求', protagonist.deepNeed),
    optionalLine('核心欲望', protagonist.coreDesire),
    optionalLine('核心恐惧', protagonist.coreFear),
    optionalLine('核心缺陷', protagonist.coreFlaw),
    optionalLine('行为风格', protagonist.behaviorStyle),
    optionalLine('道德倾向', protagonist.moralLeaning),
    optionalLine('最在意之物', protagonist.mostCaredAbout),
    optionalLine('底线', protagonist.bottomLine),
    optionalLine('诱惑点', protagonist.temptation),
    optionalLine('人物弧方向', protagonist.arcDirection),
  ]);
}

function buildKeyCharacterSummary(character: FoundationKeyCharacter): string | null {
  const parts = [trimOrEmpty(character.name), trimOrEmpty(character.role), trimOrEmpty(character.relationArc)].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const [name, ...rest] = parts;
  return rest.length > 0 ? `- ${name}：${rest.join('；')}` : `- ${name}`;
}

function buildKeyRelationsLines(keyRelations: FoundationKeyRelations): string[] {
  const keyCharacterLines = keyRelations.keyCharacters
    .slice(0, 4)
    .map(character => buildKeyCharacterSummary(character))
    .filter((line): line is string => Boolean(line));

  return compactLines([
    optionalLine('主要对手', keyRelations.antagonist.name),
    optionalLine('对手目标', keyRelations.antagonist.goal),
    optionalLine('主角与对手冲突', keyRelations.antagonist.conflict),
    ...(keyCharacterLines.length > 0 ? ['- 关键人物：', ...keyCharacterLines.map(line => `  ${line.slice(2)}`)] : []),
  ]);
}

function buildConflictFrameworkLines(conflictFramework: FoundationConflictFramework): string[] {
  return compactLines([
    optionalLine('主冲突', conflictFramework.mainConflict),
    optionalLine('内在冲突', conflictFramework.innerConflict),
    optionalLine('关系冲突', conflictFramework.relationConflict),
    optionalLine('外部阻力', conflictFramework.externalObstacle),
    optionalLine('失败代价', conflictFramework.failureCost),
    optionalLine('时间压力', conflictFramework.timePressure),
    optionalListLine('不可逆事件', conflictFramework.irreversibleEvents, 4),
    optionalLine('升级模式', conflictFramework.escalationPattern),
  ]);
}

function buildConflictFrameworkPromptLines(conflictFramework: FoundationConflictFramework): string[] {
  return compactLines([
    optionalLine('主冲突', conflictFramework.mainConflict),
    optionalLine('失败代价', conflictFramework.failureCost),
    optionalLine('外部阻力', conflictFramework.externalObstacle),
    optionalLine('时间压力', conflictFramework.timePressure),
  ]);
}

function buildNarrativeRulesLines(narrativeRules: FoundationNarrativeRules): string[] {
  const baseLines = compactLines([
    optionalLine('视角', narrativeRules.pov),
    optionalLine('时态与文风', narrativeRules.tenseAndStyle),
    optionalLine('语言质量要求', narrativeRules.languageQuality),
    optionalLine('信息揭示策略', narrativeRules.infoDisclosure),
    optionalLine('剧情驱动', narrativeRules.plotDriver),
    optionalLine('感情线权重', narrativeRules.romanceWeight),
    optionalLine('群像权重', narrativeRules.ensembleWeight),
    optionalListLine('叙事强调标签', narrativeRules.emphasisTags, 4),
    optionalListLine('禁止套路', narrativeRules.forbiddenPatterns, 5),
  ]);

  if (baseLines.length === 0 && !narrativeRules.allowExposition) {
    return [];
  }

  return compactLines([
    ...baseLines.slice(0, 4),
    `- 是否允许说明性信息：${narrativeRules.allowExposition ? '允许' : '尽量克制'}`,
    ...baseLines.slice(4),
  ]);
}

function buildNarrativeRulesPromptLines(narrativeRules: FoundationNarrativeRules): string[] {
  const baseLines = compactLines([
    optionalLine('视角', narrativeRules.pov),
    optionalLine('时态与文风', narrativeRules.tenseAndStyle),
    optionalLine('语言质量要求', narrativeRules.languageQuality),
    optionalLine('剧情驱动', narrativeRules.plotDriver),
    optionalListLine('禁止套路', narrativeRules.forbiddenPatterns, 3),
  ]);

  if (baseLines.length === 0 && !narrativeRules.allowExposition) {
    return [];
  }

  return compactLines([
    ...baseLines.slice(0, 3),
    `- 是否允许说明性信息：${narrativeRules.allowExposition ? '允许' : '尽量克制'}`,
    ...baseLines.slice(3),
  ]);
}

function buildWorldBriefLines(worldBrief: FoundationWorldBrief): string[] {
  return compactLines([
    optionalLine('世界类型', worldBrief.worldType),
    optionalListLine('必须保留的世界规则', worldBrief.requiredRules, 5),
    optionalListLine('关键场景', worldBrief.keyScenes, 4),
    optionalListLine('设定支点', worldBrief.settingPivots, 4),
    optionalListLine('制造冲突的规则', worldBrief.conflictGeneratingRules, 4),
    optionalListLine('禁用设定', worldBrief.forbiddenSettings, 5),
  ]);
}

function buildWorldBriefPromptLines(worldBrief: FoundationWorldBrief): string[] {
  return compactLines([
    optionalLine('世界类型', worldBrief.worldType),
    optionalListLine('必须保留的世界规则', worldBrief.requiredRules, 5),
    optionalListLine('关键场景', worldBrief.keyScenes, 3),
    optionalListLine('制造冲突的规则', worldBrief.conflictGeneratingRules, 3),
    optionalListLine('禁用设定', worldBrief.forbiddenSettings, 4),
  ]);
}

function buildEndgameLines(endgame: FoundationEndgame): string[] {
  const baseLines = compactLines([
    optionalLine('整体走向', endgame.overallDirection),
    optionalLine('结局类型', endgame.endingType),
    optionalLine('终局根问题', endgame.rootProblem),
    optionalLine('希望读者感受', endgame.readerFeeling),
    optionalListLine('必须解决事项', endgame.mustResolve, 4),
  ]);

  if (baseLines.length === 0 && !endgame.protagonistChanges) {
    return [];
  }

  return compactLines([
    ...baseLines.slice(0, 2),
    `- 主角是否必须发生变化：${endgame.protagonistChanges ? '是' : '否'}`,
    ...baseLines.slice(2),
  ]);
}

function buildEndgamePromptLines(endgame: FoundationEndgame): string[] {
  const baseLines = compactLines([
    optionalLine('整体走向', endgame.overallDirection),
    optionalLine('结局类型', endgame.endingType),
    optionalLine('终局根问题', endgame.rootProblem),
    optionalLine('希望读者感受', endgame.readerFeeling),
    optionalListLine('必须解决事项', endgame.mustResolve, 4),
  ]);

  if (baseLines.length === 0 && !endgame.protagonistChanges) {
    return [];
  }

  return compactLines([
    ...baseLines.slice(0, 2),
    `- 主角是否必须发生变化：${endgame.protagonistChanges ? '是' : '否'}`,
    ...baseLines.slice(2),
  ]);
}

function buildExtensionsLines(extensions: FoundationExtensionModule[]): string[] {
  if (!Array.isArray(extensions) || extensions.length === 0) {
    return [];
  }

  return extensions.slice(0, 3).flatMap(extension => {
    const title = trimOrEmpty(extension.title) || trimOrEmpty(extension.id) || '扩展模块';
    const fields = Object.keys(extension.fields ?? {});
    const fieldSummary = fields.slice(0, 6).join('、');
    return compactLines([
      `- ${title}`,
      fieldSummary ? `  字段：${fieldSummary}` : null,
      Object.keys(extension.fields ?? {}).length > 0
        ? `  内容摘要：${truncateText(JSON.stringify(extension.fields), 220)}`
        : null,
    ]);
  });
}

function buildExtensionsPromptLines(extensions: FoundationExtensionModule[]): string[] {
  if (!Array.isArray(extensions) || extensions.length === 0) {
    return [];
  }

  return extensions.slice(0, 2).flatMap(extension => {
    const title = trimOrEmpty(extension.title) || trimOrEmpty(extension.id) || '扩展模块';
    const fields = Object.keys(extension.fields ?? {});
    const fieldSummary = fields.slice(0, 5).join('、');

    return compactLines([
      `- ${title}`,
      fieldSummary ? `  重点字段：${fieldSummary}` : null,
    ]);
  });
}

function withHeading(title: string, lines: string[]): string[] {
  if (lines.length === 0) {
    return [];
  }

  return [title, ...lines, ''];
}

export function buildFoundationPromptSection(
  foundation: StoryFoundation,
  options: FoundationSectionOptions = {},
): string {
  const maxLength = options.maxLength ?? 2200;

  return finalizeSection(
    [
      ...withHeading('【作品定位】', buildPositioningLines(foundation.positioning)),
      ...withHeading('【故事核心】', buildCoreLines(foundation.core)),
      ...withHeading('【主角档案】', buildProtagonistLines(foundation.protagonist)),
      ...withHeading('【关键关系】', buildKeyRelationsLines(foundation.keyRelations)),
      ...withHeading('【冲突结构】', buildConflictFrameworkPromptLines(foundation.conflictFramework)),
      ...withHeading('【世界需求】', buildWorldBriefPromptLines(foundation.worldBrief)),
      ...withHeading('【叙事规则】', buildNarrativeRulesPromptLines(foundation.narrativeRules)),
      ...withHeading('【终局方向】', buildEndgamePromptLines(foundation.endgame)),
      ...withHeading('【扩展模块】', buildExtensionsPromptLines(foundation.extensions)),
    ],
    maxLength,
  );
}

export function buildFoundationSection(
  foundation: StoryFoundation,
  options: FoundationSectionOptions = {},
): string {
  const maxLength = options.maxLength ?? 4200;

  return finalizeSection(
    [
      ...withHeading('#### 作品定位', buildPositioningLines(foundation.positioning)),
      ...withHeading('#### 故事核心', buildCoreLines(foundation.core)),
      ...withHeading('#### 主角档案', buildProtagonistLines(foundation.protagonist)),
      ...withHeading('#### 关键关系', buildKeyRelationsLines(foundation.keyRelations)),
      ...withHeading('#### 冲突结构', buildConflictFrameworkLines(foundation.conflictFramework)),
      ...withHeading('#### 世界需求', buildWorldBriefLines(foundation.worldBrief)),
      ...withHeading('#### 叙事规则', buildNarrativeRulesLines(foundation.narrativeRules)),
      ...withHeading('#### 终局方向', buildEndgameLines(foundation.endgame)),
      ...withHeading('#### 扩展模块', buildExtensionsLines(foundation.extensions)),
    ],
    maxLength,
  );
}

export function buildFoundationWorldBriefSection(
  foundation: StoryFoundation,
  options: FoundationSectionOptions = {},
): string {
  const maxLength = options.maxLength ?? 1800;

  return finalizeSection(
    [
      ...withHeading('【世界需求】', buildWorldBriefLines(foundation.worldBrief)),
      ...withHeading('【故事核心】', compactLines([
        optionalLine('一句话故事', foundation.core.logline),
        optionalLine('核心冲突', foundation.core.coreConflict),
        optionalLine('核心悬念', foundation.core.coreSuspense),
        optionalLine('情绪基调', foundation.core.emotionalTone),
      ])),
      ...withHeading('【主角与对手】', compactLines([
        optionalLine('主角', foundation.protagonist.name),
        optionalLine('主角身份', foundation.protagonist.identity),
        optionalLine('主角目标', foundation.protagonist.visibleGoal),
        optionalLine('对手', foundation.keyRelations.antagonist.name),
        optionalLine('对手目标', foundation.keyRelations.antagonist.goal),
        optionalLine('主角与对手冲突', foundation.keyRelations.antagonist.conflict),
      ])),
      ...withHeading('【叙事禁区】', compactLines([
        optionalListLine('禁止套路', foundation.narrativeRules.forbiddenPatterns, 5),
        optionalListLine('禁用设定', foundation.worldBrief.forbiddenSettings, 5),
      ])),
    ],
    maxLength,
  );
}
