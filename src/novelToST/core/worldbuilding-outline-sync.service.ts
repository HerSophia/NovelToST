import { useFoundationStore } from '../stores/foundation.store';
import type { CommittedWorldbookCandidate } from './worldbook-commit.service';
import type { FoundationKeyCharacter, StoryFoundation } from '../types/foundation';

export type FoundationSyncField =
  | 'protagonist'
  | 'keyCharacters'
  | 'requiredRules'
  | 'forbiddenSettings'
  | 'forbiddenPatterns';

export type FoundationSyncReceipt = {
  totalInputCount: number;
  validInputCount: number;
  appendedCount: number;
  skippedCount: number;
  appendedCountByField: Record<FoundationSyncField, number>;
};

const CHARACTER_CATEGORY_HINTS = ['角色', '人物', '配角', 'character'];
const PROTAGONIST_CATEGORY_HINTS = ['主角', '男主', '女主', '主人公', 'protagonist', 'hero'];
const WORLD_RULE_CATEGORY_HINTS = ['规则', '体系', '法则', '力量', '魔法', 'system', 'worldrule', 'world_rule'];
const NARRATIVE_CONSTRAINT_HINTS = ['叙事', '套路', '文风', '视角', '节奏', '写法', 'pattern', 'narrative'];

function normalizeCompareText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function includesAnyHint(text: string, hints: readonly string[]): boolean {
  if (!text) {
    return false;
  }

  return hints.some(hint => text.includes(normalizeCompareText(hint)));
}

function buildCandidateEntryValue(candidate: CommittedWorldbookCandidate): string {
  const resolvedName = candidate.resolvedName.trim();
  const originalName = candidate.originalName.trim();
  const displayName = resolvedName || originalName;
  const normalizedContent = candidate.content.trim();

  if (displayName && normalizedContent) {
    return `${displayName}：${normalizedContent}`;
  }

  return displayName || normalizedContent;
}

function appendUniqueEntry(target: string[], entry: string): boolean {
  const normalizedEntry = normalizeCompareText(entry);
  if (!normalizedEntry) {
    return false;
  }

  const existed = target.some(item => normalizeCompareText(item) === normalizedEntry);
  if (existed) {
    return false;
  }

  target.push(entry.trim());
  return true;
}

function appendUniqueKeyCharacter(target: FoundationKeyCharacter[], candidate: CommittedWorldbookCandidate): boolean {
  const name = candidate.resolvedName.trim() || candidate.originalName.trim();
  const role = candidate.content.trim();
  const compareValue = normalizeCompareText(name || role);

  if (!compareValue) {
    return false;
  }

  const existed = target.some(character => normalizeCompareText(character.name || character.role) === compareValue);
  if (existed) {
    return false;
  }

  target.push({
    id: '',
    name,
    role,
    relationArc: '',
  });
  return true;
}

function applyProtagonistCandidate(
  foundation: StoryFoundation,
  candidate: CommittedWorldbookCandidate,
): Partial<StoryFoundation['protagonist']> | null {
  const name = candidate.resolvedName.trim() || candidate.originalName.trim();
  const identity = candidate.content.trim();
  const currentName = foundation.protagonist.name.trim();
  const currentIdentity = foundation.protagonist.identity.trim();

  const patch: Partial<StoryFoundation['protagonist']> = {};
  if (name && normalizeCompareText(name) !== normalizeCompareText(currentName)) {
    patch.name = name;
  }

  if (identity && normalizeCompareText(identity) !== normalizeCompareText(currentIdentity)) {
    patch.identity = identity;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function resolveConstraintTargetField(candidate: CommittedWorldbookCandidate): 'forbiddenSettings' | 'forbiddenPatterns' {
  const normalizedCategory = normalizeCompareText(candidate.category);
  const normalizedContent = normalizeCompareText(candidate.content);

  return includesAnyHint(`${normalizedCategory} ${normalizedContent}`, NARRATIVE_CONSTRAINT_HINTS)
    ? 'forbiddenPatterns'
    : 'forbiddenSettings';
}

export function syncCommittedCandidatesToFoundation(candidates: CommittedWorldbookCandidate[]): FoundationSyncReceipt {
  const foundationStore = useFoundationStore();
  const foundation = foundationStore.foundation;

  const nextKeyCharacters = [...foundation.keyRelations.keyCharacters];
  const nextRequiredRules = [...foundation.worldBrief.requiredRules];
  const nextForbiddenSettings = [...foundation.worldBrief.forbiddenSettings];
  const nextForbiddenPatterns = [...foundation.narrativeRules.forbiddenPatterns];
  let protagonistPatch: Partial<StoryFoundation['protagonist']> | null = null;

  const appendedCountByField: Record<FoundationSyncField, number> = {
    protagonist: 0,
    keyCharacters: 0,
    requiredRules: 0,
    forbiddenSettings: 0,
    forbiddenPatterns: 0,
  };

  let validInputCount = 0;

  candidates.forEach(candidate => {
    const entryValue = buildCandidateEntryValue(candidate);
    if (!entryValue) {
      return;
    }

    validInputCount += 1;

    const normalizedCategory = normalizeCompareText(candidate.category);
    if (includesAnyHint(normalizedCategory, PROTAGONIST_CATEGORY_HINTS)) {
      const nextPatch = applyProtagonistCandidate(foundation, candidate);
      if (nextPatch) {
        protagonistPatch = { ...(protagonistPatch ?? {}), ...nextPatch };
        appendedCountByField.protagonist += 1;
      }
      return;
    }

    if (includesAnyHint(normalizedCategory, CHARACTER_CATEGORY_HINTS)) {
      if (appendUniqueKeyCharacter(nextKeyCharacters, candidate)) {
        appendedCountByField.keyCharacters += 1;
      }
      return;
    }

    if (includesAnyHint(normalizedCategory, WORLD_RULE_CATEGORY_HINTS)) {
      if (appendUniqueEntry(nextRequiredRules, entryValue)) {
        appendedCountByField.requiredRules += 1;
      }
      return;
    }

    const constraintTargetField = resolveConstraintTargetField(candidate);
    if (constraintTargetField === 'forbiddenPatterns') {
      if (appendUniqueEntry(nextForbiddenPatterns, entryValue)) {
        appendedCountByField.forbiddenPatterns += 1;
      }
      return;
    }

    if (appendUniqueEntry(nextForbiddenSettings, entryValue)) {
      appendedCountByField.forbiddenSettings += 1;
    }
  });

  const appendedCount = Object.values(appendedCountByField).reduce((total, count) => total + count, 0);

  if (protagonistPatch) {
    foundationStore.patchModule('protagonist', protagonistPatch);
  }

  if (appendedCountByField.keyCharacters > 0) {
    foundationStore.patchModule('keyRelations', { keyCharacters: nextKeyCharacters });
  }

  if (appendedCountByField.requiredRules > 0 || appendedCountByField.forbiddenSettings > 0) {
    foundationStore.patchModule('worldBrief', {
      requiredRules: nextRequiredRules,
      forbiddenSettings: nextForbiddenSettings,
    });
  }

  if (appendedCountByField.forbiddenPatterns > 0) {
    foundationStore.patchModule('narrativeRules', { forbiddenPatterns: nextForbiddenPatterns });
  }

  return {
    totalInputCount: candidates.length,
    validInputCount,
    appendedCount,
    skippedCount: Math.max(0, candidates.length - appendedCount),
    appendedCountByField,
  };
}
