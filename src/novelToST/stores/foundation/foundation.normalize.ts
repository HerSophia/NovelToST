import type {
  FoundationAntagonist,
  FoundationConflictFramework,
  FoundationCore,
  FoundationEndgame,
  FoundationExtensionModule,
  FoundationKeyCharacter,
  FoundationKeyRelations,
  FoundationMessage,
  FoundationModuleId,
  FoundationModuleStatus,
  FoundationNarrativeRules,
  FoundationPersistedState,
  FoundationPositioning,
  FoundationProtagonist,
  FoundationWorldBrief,
  StoryFoundation,
} from '../../types/foundation';
import { FOUNDATION_MODULE_IDS, REQUIRED_FIELDS } from '../../types/foundation';
import {
  getValueAtPath,
  hasMeaningfulFoundationValue,
} from '../../core/foundation-tier';
import {
  FoundationAntagonistSchema,
  FoundationConflictFrameworkSchema,
  FoundationCoreSchema,
  FoundationEndgameSchema,
  FoundationExtensionModuleSchema,
  FoundationKeyCharacterSchema,
  FoundationKeyRelationsSchema,
  FoundationMessageSchema,
  FoundationNarrativeRulesSchema,
  FoundationPersistedStateSchema,
  FoundationPositioningSchema,
  FoundationProtagonistSchema,
  FoundationWorldBriefSchema,
  StoryFoundationSchema,
} from './foundation.schemas';

let foundationMessageCounter = 0;
let foundationKeyCharacterCounter = 0;
let foundationExtensionCounter = 0;

function nextTimestamp(): string {
  return new Date().toISOString();
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string') {
    return nextTimestamp();
  }

  const normalized = value.trim();
  return normalized || nextTimestamp();
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUnknownRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, fieldValue]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return;
    }
    result[normalizedKey] = fieldValue;
  });

  return result;
}

function normalizeStringList(value: unknown, maxCount?: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<string>();
  value.forEach(item => {
    if (typeof item !== 'string') {
      return;
    }

    const normalized = item.trim();
    if (!normalized) {
      return;
    }

    deduped.add(normalized);
  });

  const result = [...deduped];
  return typeof maxCount === 'number' ? result.slice(0, Math.max(0, maxCount)) : result;
}

function createFoundationMessageId(): string {
  foundationMessageCounter += 1;
  return `foundation-message-${Date.now()}-${foundationMessageCounter}`;
}

function createFoundationKeyCharacterId(): string {
  foundationKeyCharacterCounter += 1;
  return `foundation-keychar-${Date.now()}-${foundationKeyCharacterCounter}`;
}

function createFoundationExtensionId(): string {
  foundationExtensionCounter += 1;
  return `foundation-ext-${Date.now()}-${foundationExtensionCounter}`;
}

export function normalizeFoundationPositioning(raw: unknown): FoundationPositioning {
  const parsed = FoundationPositioningSchema.parse(raw);

  return {
    title: normalizeString(parsed.title),
    genre: normalizeString(parsed.genre),
    mainType: normalizeString(parsed.mainType),
    subType: normalizeString(parsed.subType),
    targetExperience: normalizeStringList(parsed.targetExperience, 3),
    length: normalizeString(parsed.length),
    audience: normalizeString(parsed.audience),
    contentIntensity: normalizeStringList(parsed.contentIntensity, 3),
  };
}

export function normalizeFoundationCore(raw: unknown): FoundationCore {
  const parsed = FoundationCoreSchema.parse(raw);

  return {
    logline: normalizeString(parsed.logline),
    coreConflict: normalizeString(parsed.coreConflict),
    coreSuspense: normalizeString(parsed.coreSuspense),
    coreSellPoint: normalizeString(parsed.coreSellPoint),
    themeKeywords: normalizeStringList(parsed.themeKeywords, 3),
    emotionalTone: normalizeString(parsed.emotionalTone),
  };
}

export function normalizeFoundationProtagonist(raw: unknown): FoundationProtagonist {
  const parsed = FoundationProtagonistSchema.parse(raw);

  return {
    name: normalizeString(parsed.name),
    identity: normalizeString(parsed.identity),
    visibleGoal: normalizeString(parsed.visibleGoal),
    deepNeed: normalizeString(parsed.deepNeed),
    coreDesire: normalizeString(parsed.coreDesire),
    coreFear: normalizeString(parsed.coreFear),
    coreFlaw: normalizeString(parsed.coreFlaw),
    behaviorStyle: normalizeString(parsed.behaviorStyle),
    moralLeaning: normalizeString(parsed.moralLeaning),
    mostCaredAbout: normalizeString(parsed.mostCaredAbout),
    bottomLine: normalizeString(parsed.bottomLine),
    temptation: normalizeString(parsed.temptation),
    arcDirection: normalizeString(parsed.arcDirection),
  };
}

export function normalizeFoundationAntagonist(raw: unknown): FoundationAntagonist {
  const parsed = FoundationAntagonistSchema.parse(raw);

  return {
    name: normalizeString(parsed.name),
    goal: normalizeString(parsed.goal),
    conflict: normalizeString(parsed.conflict),
  };
}

export function normalizeFoundationKeyCharacter(raw: unknown): FoundationKeyCharacter {
  const parsed = FoundationKeyCharacterSchema.parse(raw);

  return {
    id: normalizeString(parsed.id) || createFoundationKeyCharacterId(),
    name: normalizeString(parsed.name),
    role: normalizeString(parsed.role),
    relationArc: normalizeString(parsed.relationArc),
  };
}

export function normalizeFoundationKeyRelations(raw: unknown): FoundationKeyRelations {
  const parsed = FoundationKeyRelationsSchema.parse(raw);

  return {
    antagonist: normalizeFoundationAntagonist(parsed.antagonist),
    keyCharacters: parsed.keyCharacters
      .map(character => normalizeFoundationKeyCharacter(character))
      .filter(character => character.name.length > 0 || character.role.length > 0 || character.relationArc.length > 0),
  };
}

export function normalizeFoundationConflictFramework(raw: unknown): FoundationConflictFramework {
  const parsed = FoundationConflictFrameworkSchema.parse(raw);

  return {
    mainConflict: normalizeString(parsed.mainConflict),
    innerConflict: normalizeString(parsed.innerConflict),
    relationConflict: normalizeString(parsed.relationConflict),
    externalObstacle: normalizeString(parsed.externalObstacle),
    failureCost: normalizeString(parsed.failureCost),
    timePressure: normalizeString(parsed.timePressure),
    irreversibleEvents: normalizeStringList(parsed.irreversibleEvents),
    escalationPattern: normalizeString(parsed.escalationPattern),
  };
}

export function normalizeFoundationNarrativeRules(raw: unknown): FoundationNarrativeRules {
  const parsed = FoundationNarrativeRulesSchema.parse(raw);

  return {
    pov: normalizeString(parsed.pov),
    tenseAndStyle: normalizeString(parsed.tenseAndStyle),
    languageQuality: normalizeString(parsed.languageQuality),
    infoDisclosure: normalizeString(parsed.infoDisclosure),
    allowExposition: Boolean(parsed.allowExposition),
    plotDriver: normalizeString(parsed.plotDriver),
    romanceWeight: normalizeString(parsed.romanceWeight),
    ensembleWeight: normalizeString(parsed.ensembleWeight),
    emphasisTags: normalizeStringList(parsed.emphasisTags),
    forbiddenPatterns: normalizeStringList(parsed.forbiddenPatterns),
  };
}

export function normalizeFoundationWorldBrief(raw: unknown): FoundationWorldBrief {
  const parsed = FoundationWorldBriefSchema.parse(raw);

  return {
    worldType: normalizeString(parsed.worldType),
    requiredRules: normalizeStringList(parsed.requiredRules),
    keyScenes: normalizeStringList(parsed.keyScenes),
    settingPivots: normalizeStringList(parsed.settingPivots),
    conflictGeneratingRules: normalizeStringList(parsed.conflictGeneratingRules),
    forbiddenSettings: normalizeStringList(parsed.forbiddenSettings),
  };
}

export function normalizeFoundationEndgame(raw: unknown): FoundationEndgame {
  const parsed = FoundationEndgameSchema.parse(raw);

  return {
    overallDirection: normalizeString(parsed.overallDirection),
    endingType: normalizeString(parsed.endingType),
    protagonistChanges: Boolean(parsed.protagonistChanges),
    rootProblem: normalizeString(parsed.rootProblem),
    readerFeeling: normalizeString(parsed.readerFeeling),
    mustResolve: normalizeStringList(parsed.mustResolve),
  };
}

export function normalizeFoundationExtensionModule(raw: unknown): FoundationExtensionModule {
  const parsed = FoundationExtensionModuleSchema.parse(raw);

  return {
    id: normalizeString(parsed.id) || createFoundationExtensionId(),
    title: normalizeString(parsed.title),
    fields: normalizeUnknownRecord(parsed.fields),
  };
}

export function normalizeStoryFoundation(raw: unknown): StoryFoundation {
  const parsed = StoryFoundationSchema.parse(raw);

  return {
    positioning: normalizeFoundationPositioning(parsed.positioning),
    core: normalizeFoundationCore(parsed.core),
    protagonist: normalizeFoundationProtagonist(parsed.protagonist),
    keyRelations: normalizeFoundationKeyRelations(parsed.keyRelations),
    conflictFramework: normalizeFoundationConflictFramework(parsed.conflictFramework),
    narrativeRules: normalizeFoundationNarrativeRules(parsed.narrativeRules),
    worldBrief: normalizeFoundationWorldBrief(parsed.worldBrief),
    endgame: normalizeFoundationEndgame(parsed.endgame),
    extensions: parsed.extensions.map(extension => normalizeFoundationExtensionModule(extension)),
  };
}

export function normalizeFoundationMessage(raw: unknown): FoundationMessage {
  const rawRecord = isRecord(raw) ? raw : null;
  const parsed = FoundationMessageSchema.parse(raw);

  const rawResponse =
    rawRecord && typeof rawRecord.rawResponse === 'string' && rawRecord.rawResponse.trim().length > 0
      ? rawRecord.rawResponse
      : undefined;
  const parseErrorRaw = rawRecord?.parseError;
  const parseError =
    typeof parseErrorRaw === 'string' ? (parseErrorRaw.trim() || null) : parseErrorRaw === null ? null : undefined;

  const normalized: FoundationMessage = {
    id: normalizeString(parsed.id) || createFoundationMessageId(),
    role: parsed.role,
    text: normalizeString(parsed.text),
    createdAt: normalizeTimestamp(parsed.createdAt),
  };

  if (parseError !== undefined) {
    normalized.parseError = parseError;
  }

  if (rawResponse !== undefined) {
    normalized.rawResponse = rawResponse;
  }

  return normalized;
}

export function createEmptyFoundationPersistedState(): FoundationPersistedState {
  const parsed = FoundationPersistedStateSchema.parse({});

  return {
    foundation: normalizeStoryFoundation(parsed.foundation),
    messages: parsed.messages.map(message => normalizeFoundationMessage(message)),
    updatedAt: normalizeTimestamp(parsed.updatedAt),
  };
}

export function normalizeFoundationPersistedState(raw: unknown): FoundationPersistedState {
  const parsed = FoundationPersistedStateSchema.safeParse(raw);

  if (!parsed.success) {
    console.warn('[novelToST][foundation] 故事基底状态解析失败，回退默认结构', parsed.error);
    return createEmptyFoundationPersistedState();
  }

  return {
    foundation: normalizeStoryFoundation(parsed.data.foundation),
    messages: parsed.data.messages.map(message => normalizeFoundationMessage(message)),
    updatedAt: normalizeTimestamp(parsed.data.updatedAt),
  };
}

export function computeModuleStatuses(
  foundation: StoryFoundation,
): Record<FoundationModuleId, FoundationModuleStatus> {
  const result = {} as Record<FoundationModuleId, FoundationModuleStatus>;

  FOUNDATION_MODULE_IDS.forEach(moduleId => {
    const requiredFields = REQUIRED_FIELDS[moduleId];
    const moduleValue = foundation[moduleId];

    if (requiredFields.length === 0) {
      result[moduleId] = hasMeaningfulFoundationValue(moduleValue) ? 'complete' : 'empty';
      return;
    }

    const filledCount = requiredFields.filter(fieldPath => hasMeaningfulFoundationValue(getValueAtPath(moduleValue, fieldPath))).length;

    if (filledCount === 0) {
      result[moduleId] = 'empty';
      return;
    }

    if (filledCount === requiredFields.length) {
      result[moduleId] = 'complete';
      return;
    }

    result[moduleId] = 'partial';
  });

  return result;
}
