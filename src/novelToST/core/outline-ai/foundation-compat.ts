import { z } from 'zod';
import type { StoryFoundation } from '../../types/foundation';
import {
  migrateLegacyStorySetupToFoundation,
  type FoundationPatch,
} from '../foundation-legacy.service';
import {
  type ExtractedItems,
  isRecord,
  normalizeExtraRecord,
  normalizeString,
  normalizeStringList,
} from './shared';

const LegacyStorySetupPatchOutputSchema = z
  .object({
    title: z.string().optional(),
    genre: z.string().optional(),
    premise: z.string().optional(),
    tone: z.string().optional(),
    coreConflict: z.string().optional(),
    characters: z.unknown().optional(),
    worldRules: z.unknown().optional(),
    constraints: z.unknown().optional(),
    calendar: z.unknown().optional(),
    totalChapters: z.number().int().min(1).optional(),
  })
  .prefault({});

function extractLegacySetupPatch(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (!isRecord(payload.setup)) {
    return null;
  }

  return payload.setup;
}

type LegacyFoundationCommandOp = 'patch';

function extractLegacySetupCommandItemsFromRecord(payload: Record<string, unknown>): ExtractedItems {
  if (Array.isArray(payload.setupCommands)) {
    return {
      hasField: true,
      items: normalizeLegacyFoundationCommandItems(payload.setupCommands),
    };
  }

  if (Array.isArray(payload.setupOps)) {
    return {
      hasField: true,
      items: normalizeLegacyFoundationCommandItems(payload.setupOps),
    };
  }

  const outlineSection = payload.outline;
  if (isRecord(outlineSection)) {
    if (Array.isArray(outlineSection.setupCommands)) {
      return {
        hasField: true,
        items: normalizeLegacyFoundationCommandItems(outlineSection.setupCommands),
      };
    }

    if (Array.isArray(outlineSection.setupOps)) {
      return {
        hasField: true,
        items: normalizeLegacyFoundationCommandItems(outlineSection.setupOps),
      };
    }
  }

  return {
    hasField: false,
    items: [],
  };
}

function normalizeLegacyFoundationCommandOperationFromType(raw: unknown): LegacyFoundationCommandOp | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'setup.patch' ||
    normalized === 'setup.update' ||
    normalized === 'setup.set' ||
    normalized === 'outline.setup.patch' ||
    normalized === 'outline.setup.update' ||
    normalized === 'outline.setup.set'
  ) {
    return 'patch';
  }

  return null;
}

function normalizeLegacyFoundationCommandOperation(raw: unknown): LegacyFoundationCommandOp | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'patch' ||
    normalized === 'p' ||
    normalized === 'update' ||
    normalized === 'u' ||
    normalized === 'set' ||
    normalized === 'merge' ||
    normalized === 'edit' ||
    normalized === 'modify' ||
    normalized === 'create' ||
    normalized === 'c'
  ) {
    return 'patch';
  }

  return null;
}

function isLegacyFoundationCommandTarget(raw: unknown): boolean {
  if (typeof raw !== 'string') {
    return false;
  }

  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, '_');

  return normalized === 'setup' || normalized === 'story_setup' || normalized === 'storysetup';
}

function resolveLegacyFoundationCommandMetadata(command: Record<string, unknown>): {
  operation: LegacyFoundationCommandOp | null;
  hasLegacyTarget: boolean;
} {
  const operationByType = normalizeLegacyFoundationCommandOperationFromType(command.type ?? command.kind);
  const hasLegacyTarget = [command.target, command.entity, command.resource].some(value =>
    isLegacyFoundationCommandTarget(value),
  );
  const operationByOp = hasLegacyTarget ? normalizeLegacyFoundationCommandOperation(command.op ?? command.action) : null;

  return {
    operation: operationByType ?? operationByOp,
    hasLegacyTarget,
  };
}

function normalizeLegacyFoundationCommandItem(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) {
    return null;
  }

  const normalizedCommand: Record<string, unknown> = { ...item };
  const { operation, hasLegacyTarget } = resolveLegacyFoundationCommandMetadata(normalizedCommand);

  if (operation) {
    normalizedCommand.op = operation;
    normalizedCommand.action = operation;
  }

  if (
    !isRecord(normalizedCommand.patch) &&
    !isRecord(normalizedCommand.foundation) &&
    !isRecord(normalizedCommand.payload) &&
    !isRecord(normalizedCommand.data) &&
    isRecord(normalizedCommand.setup)
  ) {
    normalizedCommand.patch = normalizedCommand.setup;
  }

  if (hasLegacyTarget && typeof normalizedCommand.target === 'string') {
    normalizedCommand.target = 'foundation';
  }

  if (hasLegacyTarget && typeof normalizedCommand.entity === 'string') {
    normalizedCommand.entity = 'foundation';
  }

  if (hasLegacyTarget && typeof normalizedCommand.resource === 'string') {
    normalizedCommand.resource = 'foundation';
  }

  return normalizedCommand;
}

function normalizeLegacyFoundationCommandItems(items: unknown[]): unknown[] {
  return items.map(item => normalizeLegacyFoundationCommandItem(item) ?? item);
}

function assignStringFields<T extends Record<string, unknown>>(
  target: Partial<T>,
  source: Record<string, unknown>,
  keys: readonly (keyof T & string)[],
): void {
  keys.forEach(key => {
    if (!(key in source)) {
      return;
    }

    target[key] = normalizeString(source[key]) as T[keyof T & string];
  });
}

function assignStringListFields<T extends Record<string, unknown>>(
  target: Partial<T>,
  source: Record<string, unknown>,
  keys: readonly (keyof T & string)[],
  maxCountByKey: Partial<Record<keyof T & string, number>> = {},
): void {
  keys.forEach(key => {
    if (!(key in source)) {
      return;
    }

    const maxCount = maxCountByKey[key];
    const normalized = normalizeStringList(source[key]);
    target[key] = (
      typeof maxCount === 'number' ? normalized.slice(0, Math.max(0, maxCount)) : normalized
    ) as T[keyof T & string];
  });
}

function assignBooleanFields<T extends Record<string, unknown>>(
  target: Partial<T>,
  source: Record<string, unknown>,
  keys: readonly (keyof T & string)[],
): void {
  keys.forEach(key => {
    if (!(key in source)) {
      return;
    }

    target[key] = Boolean(source[key]) as T[keyof T & string];
  });
}

function hasPatchFields(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function normalizeFoundationPositioningPatch(raw: Record<string, unknown>): Partial<StoryFoundation['positioning']> {
  const patch: FoundationPatch['positioning'] = {};
  assignStringFields(patch, raw, ['title', 'genre', 'mainType', 'subType', 'length', 'audience']);
  assignStringListFields(patch, raw, ['targetExperience', 'contentIntensity'], {
    targetExperience: 3,
    contentIntensity: 3,
  });
  return patch;
}

function normalizeFoundationCorePatch(raw: Record<string, unknown>): Partial<StoryFoundation['core']> {
  const patch: FoundationPatch['core'] = {};
  assignStringFields(patch, raw, ['logline', 'coreConflict', 'coreSuspense', 'coreSellPoint', 'emotionalTone']);
  assignStringListFields(patch, raw, ['themeKeywords'], { themeKeywords: 3 });
  return patch;
}

function normalizeFoundationProtagonistPatch(raw: Record<string, unknown>): Partial<StoryFoundation['protagonist']> {
  const patch: FoundationPatch['protagonist'] = {};
  assignStringFields(patch, raw, [
    'name',
    'identity',
    'visibleGoal',
    'deepNeed',
    'coreDesire',
    'coreFear',
    'coreFlaw',
    'behaviorStyle',
    'moralLeaning',
    'mostCaredAbout',
    'bottomLine',
    'temptation',
    'arcDirection',
  ]);
  return patch;
}

function normalizeFoundationKeyCharactersPatch(raw: unknown): StoryFoundation['keyRelations']['keyCharacters'] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(isRecord)
    .map(item => ({
      id: normalizeString(item.id),
      name: normalizeString(item.name),
      role: normalizeString(item.role),
      relationArc: normalizeString(item.relationArc),
    }))
    .filter(item => item.name || item.role || item.relationArc);
}

function normalizeFoundationKeyRelationsPatch(raw: Record<string, unknown>): FoundationPatch['keyRelations'] {
  const patch: FoundationPatch['keyRelations'] = {};

  if (isRecord(raw.antagonist)) {
    const antagonistPatch: Partial<StoryFoundation['keyRelations']['antagonist']> = {};
    assignStringFields(antagonistPatch, raw.antagonist, ['name', 'goal', 'conflict']);
    if (hasPatchFields(antagonistPatch as Record<string, unknown>)) {
      patch.antagonist = antagonistPatch;
    }
  }

  if ('keyCharacters' in raw) {
    patch.keyCharacters = normalizeFoundationKeyCharactersPatch(raw.keyCharacters);
  }

  return patch;
}

function normalizeFoundationConflictFrameworkPatch(
  raw: Record<string, unknown>,
): Partial<StoryFoundation['conflictFramework']> {
  const patch: FoundationPatch['conflictFramework'] = {};
  assignStringFields(patch, raw, [
    'mainConflict',
    'innerConflict',
    'relationConflict',
    'externalObstacle',
    'failureCost',
    'timePressure',
    'escalationPattern',
  ]);
  assignStringListFields(patch, raw, ['irreversibleEvents']);
  return patch;
}

function normalizeFoundationNarrativeRulesPatch(
  raw: Record<string, unknown>,
): Partial<StoryFoundation['narrativeRules']> {
  const patch: FoundationPatch['narrativeRules'] = {};
  assignStringFields(patch, raw, [
    'pov',
    'tenseAndStyle',
    'languageQuality',
    'infoDisclosure',
    'plotDriver',
    'romanceWeight',
    'ensembleWeight',
  ]);
  assignBooleanFields(patch, raw, ['allowExposition']);
  assignStringListFields(patch, raw, ['emphasisTags', 'forbiddenPatterns']);
  return patch;
}

function normalizeFoundationWorldBriefPatch(raw: Record<string, unknown>): Partial<StoryFoundation['worldBrief']> {
  const patch: FoundationPatch['worldBrief'] = {};
  assignStringFields(patch, raw, ['worldType']);
  assignStringListFields(patch, raw, [
    'requiredRules',
    'keyScenes',
    'settingPivots',
    'conflictGeneratingRules',
    'forbiddenSettings',
  ]);
  return patch;
}

function normalizeFoundationEndgamePatch(raw: Record<string, unknown>): Partial<StoryFoundation['endgame']> {
  const patch: FoundationPatch['endgame'] = {};
  assignStringFields(patch, raw, ['overallDirection', 'endingType', 'rootProblem', 'readerFeeling']);
  assignBooleanFields(patch, raw, ['protagonistChanges']);
  assignStringListFields(patch, raw, ['mustResolve']);
  return patch;
}

function normalizeFoundationExtensionsPatch(raw: unknown): StoryFoundation['extensions'] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(isRecord)
    .map(item => ({
      id: normalizeString(item.id),
      title: normalizeString(item.title),
      fields: normalizeExtraRecord(item.fields),
    }));
}

export function normalizeFoundationPatchFromRecord(foundationPatchRaw: Record<string, unknown>): FoundationPatch {
  const patch: FoundationPatch = {};

  if (isRecord(foundationPatchRaw.positioning)) {
    const modulePatch = normalizeFoundationPositioningPatch(foundationPatchRaw.positioning);
    if (hasPatchFields(modulePatch as Record<string, unknown>)) {
      patch.positioning = modulePatch;
    }
  }

  if (isRecord(foundationPatchRaw.core)) {
    const modulePatch = normalizeFoundationCorePatch(foundationPatchRaw.core);
    if (hasPatchFields(modulePatch as Record<string, unknown>)) {
      patch.core = modulePatch;
    }
  }

  if (isRecord(foundationPatchRaw.protagonist)) {
    const modulePatch = normalizeFoundationProtagonistPatch(foundationPatchRaw.protagonist);
    if (hasPatchFields(modulePatch as Record<string, unknown>)) {
      patch.protagonist = modulePatch;
    }
  }

  if (isRecord(foundationPatchRaw.keyRelations)) {
    const modulePatch = normalizeFoundationKeyRelationsPatch(foundationPatchRaw.keyRelations);
    if (hasPatchFields(modulePatch as Record<string, unknown>)) {
      patch.keyRelations = modulePatch;
    }
  }

  if (isRecord(foundationPatchRaw.conflictFramework)) {
    const modulePatch = normalizeFoundationConflictFrameworkPatch(foundationPatchRaw.conflictFramework);
    if (hasPatchFields(modulePatch as Record<string, unknown>)) {
      patch.conflictFramework = modulePatch;
    }
  }

  if (isRecord(foundationPatchRaw.narrativeRules)) {
    const modulePatch = normalizeFoundationNarrativeRulesPatch(foundationPatchRaw.narrativeRules);
    if (hasPatchFields(modulePatch as Record<string, unknown>)) {
      patch.narrativeRules = modulePatch;
    }
  }

  if (isRecord(foundationPatchRaw.worldBrief)) {
    const modulePatch = normalizeFoundationWorldBriefPatch(foundationPatchRaw.worldBrief);
    if (hasPatchFields(modulePatch as Record<string, unknown>)) {
      patch.worldBrief = modulePatch;
    }
  }

  if (isRecord(foundationPatchRaw.endgame)) {
    const modulePatch = normalizeFoundationEndgamePatch(foundationPatchRaw.endgame);
    if (hasPatchFields(modulePatch as Record<string, unknown>)) {
      patch.endgame = modulePatch;
    }
  }

  if ('extensions' in foundationPatchRaw && Array.isArray(foundationPatchRaw.extensions)) {
    patch.extensions = normalizeFoundationExtensionsPatch(foundationPatchRaw.extensions);
  }

  if (Object.keys(patch).length > 0) {
    return patch;
  }

  const parsedLegacyPatch = LegacyStorySetupPatchOutputSchema.safeParse(foundationPatchRaw);
  if (parsedLegacyPatch.success) {
    return migrateLegacyStorySetupToFoundation(parsedLegacyPatch.data);
  }

  return migrateLegacyStorySetupToFoundation(foundationPatchRaw);
}

function extractFoundationPatch(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (isRecord(payload.foundationPatch)) {
    return payload.foundationPatch;
  }

  if (isRecord(payload.foundation)) {
    return payload.foundation;
  }

  return extractLegacySetupPatch(payload);
}

export function extractLegacyFoundationCommandItems(payload: unknown): ExtractedItems {
  if (!isRecord(payload)) {
    return {
      hasField: false,
      items: [],
    };
  }

  return extractLegacySetupCommandItemsFromRecord(payload);
}

export function normalizeLegacyFoundationCommandFromGenericCommand(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) {
    return null;
  }

  const { operation } = resolveLegacyFoundationCommandMetadata(item);
  if (!operation) {
    return null;
  }

  const normalizedCommand = normalizeLegacyFoundationCommandItem(item);
  if (!normalizedCommand) {
    return null;
  }

  return ('target' in normalizedCommand || 'entity' in normalizedCommand || 'resource' in normalizedCommand)
    ? normalizedCommand
    : { ...normalizedCommand, target: 'foundation' };
}

export function normalizeFoundationPatchFromPayload(payload: unknown): FoundationPatch | null {
  const foundationPatchRaw = extractFoundationPatch(payload);
  if (!foundationPatchRaw) {
    return null;
  }

  return normalizeFoundationPatchFromRecord(foundationPatchRaw);
}
