import type { StoryFoundation } from '../types/foundation';
import type { OutlineMentionKind } from '../types/outline';

export type DeepPartial<T> = T extends readonly (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type FoundationPatch = DeepPartial<StoryFoundation>;

type LegacyStorySetup = {
  title: string;
  genre: string;
  premise: string;
  tone: string;
  coreConflict: string;
  characters: string[];
  worldRules: string[];
  constraints: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => normalizeString(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|[，,；;]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
}

function splitLegacyCharacterText(value: string): { name: string; detail: string } {
  const normalized = value.trim();
  if (!normalized) {
    return { name: '', detail: '' };
  }

  const separatorIndex = normalized.search(/[：:]/);
  if (separatorIndex < 0) {
    return {
      name: normalized,
      detail: '',
    };
  }

  return {
    name: normalized.slice(0, separatorIndex).trim(),
    detail: normalized.slice(separatorIndex + 1).trim(),
  };
}

export function normalizeLegacyStorySetup(raw: unknown): LegacyStorySetup {
  const record = isRecord(raw) ? raw : {};

  return {
    title: normalizeString(record.title),
    genre: normalizeString(record.genre),
    premise: normalizeString(record.premise),
    tone: normalizeString(record.tone),
    coreConflict: normalizeString(record.coreConflict),
    characters: normalizeStringList(record.characters),
    worldRules: normalizeStringList(record.worldRules),
    constraints: normalizeStringList(record.constraints),
  };
}

export function migrateLegacyStorySetupToFoundation(raw: unknown): FoundationPatch {
  const setup = normalizeLegacyStorySetup(raw);
  const patch: FoundationPatch = {};

  if (setup.title || setup.genre) {
    patch.positioning = {
      ...(setup.title ? { title: setup.title } : {}),
      ...(setup.genre ? { genre: setup.genre } : {}),
    };
  }

  if (setup.premise || setup.tone || setup.coreConflict) {
    patch.core = {
      ...(setup.premise ? { logline: setup.premise } : {}),
      ...(setup.coreConflict ? { coreConflict: setup.coreConflict } : {}),
      ...(setup.tone ? { emotionalTone: setup.tone } : {}),
    };
  }

  const firstCharacter = setup.characters[0] ? splitLegacyCharacterText(setup.characters[0]) : null;
  if (firstCharacter && (firstCharacter.name || firstCharacter.detail)) {
    patch.protagonist = {
      ...(firstCharacter.name ? { name: firstCharacter.name } : {}),
      ...(firstCharacter.detail ? { identity: firstCharacter.detail } : {}),
    };
  }

  const remainingCharacters = setup.characters.slice(firstCharacter ? 1 : 0);
  if (remainingCharacters.length > 0) {
    patch.keyRelations = {
      keyCharacters: remainingCharacters.map((value, index) => {
        const parsed = splitLegacyCharacterText(value);
        return {
          id: `legacy-keychar-${index + 1}`,
          name: parsed.name || value,
          role: parsed.detail,
          relationArc: '',
        };
      }),
    };
  }

  if (setup.worldRules.length > 0 || setup.constraints.length > 0) {
    patch.worldBrief = {
      ...(setup.worldRules.length > 0 ? { requiredRules: [...setup.worldRules] } : {}),
      ...(setup.constraints.length > 0 ? { forbiddenSettings: [...setup.constraints] } : {}),
    };
  }

  if (setup.constraints.length > 0) {
    patch.narrativeRules = {
      forbiddenPatterns: [...setup.constraints],
    };
  }

  return patch;
}

function hasMeaningfulContent(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.some(item => hasMeaningfulContent(item));
  }

  if (isRecord(value)) {
    return Object.values(value).some(item => hasMeaningfulContent(item));
  }

  return false;
}

export function isFoundationEmpty(foundation: StoryFoundation): boolean {
  return !hasMeaningfulContent(foundation);
}

function mergePlainObjects(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  Object.entries(patch).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = [...value];
      return;
    }

    if (isRecord(value)) {
      const current = isRecord(result[key]) ? (result[key] as Record<string, unknown>) : {};
      result[key] = mergePlainObjects(current, value);
      return;
    }

    if (value !== undefined) {
      result[key] = value;
    }
  });

  return result;
}

export function mergeFoundationPatch(base: FoundationPatch, patch: FoundationPatch): FoundationPatch {
  return mergePlainObjects(base as Record<string, unknown>, patch as Record<string, unknown>) as FoundationPatch;
}

export function normalizeLegacyOutlineMentionKind(kind: unknown): OutlineMentionKind | null {
  if (typeof kind !== 'string') {
    return null;
  }

  const normalized = kind.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'setup') {
    return 'foundation';
  }

  if (
    normalized === 'foundation' ||
    normalized === 'worldbook' ||
    normalized === 'worldbook_entry' ||
    normalized === 'storyline' ||
    normalized === 'node' ||
    normalized === 'detail'
  ) {
    return normalized as OutlineMentionKind;
  }

  return null;
}

export function normalizeLegacyOutlineMentionId(kind: unknown, id: unknown): string {
  const normalizedKind = normalizeLegacyOutlineMentionKind(kind);
  const normalizedId = normalizeString(id);

  if (normalizedKind === 'foundation' && normalizedId === 'setup:current') {
    return 'foundation:current';
  }

  return normalizedId;
}
