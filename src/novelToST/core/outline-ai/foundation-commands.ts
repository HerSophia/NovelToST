import {
  mergeFoundationPatch,
  type FoundationPatch,
} from '../foundation-legacy.service';
import {
  extractGenericCommandItems,
  isRecord,
  type ExtractedItems,
} from './shared';
import {
  extractLegacyFoundationCommandItems,
  normalizeFoundationPatchFromRecord,
  normalizeLegacyFoundationCommandFromGenericCommand,
} from './foundation-compat';

type OutlineFoundationCommandOp = 'patch';

function extractFoundationCommandItems(payload: unknown): ExtractedItems {
  if (!isRecord(payload)) {
    return {
      hasField: false,
      items: [],
    };
  }

  if (Array.isArray(payload.foundationCommands)) {
    return {
      hasField: true,
      items: payload.foundationCommands,
    };
  }

  if (Array.isArray(payload.foundationOps)) {
    return {
      hasField: true,
      items: payload.foundationOps,
    };
  }

  const outlineSection = payload.outline;
  if (isRecord(outlineSection)) {
    if (Array.isArray(outlineSection.foundationCommands)) {
      return {
        hasField: true,
        items: outlineSection.foundationCommands,
      };
    }

    if (Array.isArray(outlineSection.foundationOps)) {
      return {
        hasField: true,
        items: outlineSection.foundationOps,
      };
    }
  }

  return {
    hasField: false,
    items: [],
  };
}

function normalizeFoundationCommandOperationFromType(raw: unknown): OutlineFoundationCommandOp | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'foundation.patch' ||
    normalized === 'foundation.update' ||
    normalized === 'foundation.set' ||
    normalized === 'foundation_patch' ||
    normalized === 'foundation_update' ||
    normalized === 'foundation_set' ||
    normalized === 'patch_foundation' ||
    normalized === 'update_foundation' ||
    normalized === 'set_foundation' ||
    normalized === 'outline.foundation.patch' ||
    normalized === 'outline.foundation.update' ||
    normalized === 'outline.foundation.set'
  ) {
    return 'patch';
  }

  return null;
}

function normalizeFoundationCommandOperation(raw: unknown): OutlineFoundationCommandOp | null {
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

function isFoundationCommandTarget(raw: unknown): boolean {
  if (typeof raw !== 'string') {
    return false;
  }

  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, '_');

  return (
    normalized === 'foundation' ||
    normalized === 'foundations' ||
    normalized === 'story_foundation' ||
    normalized === 'story_foundations' ||
    normalized === 'storyfoundation' ||
    normalized === 'storyfoundations' ||
    normalized === 'outline_foundation' ||
    normalized === 'outline_foundations'
  );
}

function normalizeFoundationCommandFromGenericCommand(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) {
    return null;
  }

  const operationByType = normalizeFoundationCommandOperationFromType(item.type ?? item.kind);
  const hasFoundationTarget = [item.target, item.entity, item.resource].some(value => isFoundationCommandTarget(value));
  const operationByOp = hasFoundationTarget ? normalizeFoundationCommandOperation(item.op ?? item.action) : null;
  const operation = operationByType ?? operationByOp;
  if (!operation) {
    return null;
  }

  return {
    ...item,
    op: operation,
    action: operation,
  };
}

function omitFoundationCommandMeta(command: Record<string, unknown>): Record<string, unknown> {
  const omittedKeys = new Set([
    'op',
    'action',
    'type',
    'kind',
    'target',
    'entity',
    'resource',
    'id',
    'patch',
    'foundation',
    'payload',
    'data',
  ]);

  const seed: Record<string, unknown> = {};
  Object.entries(command).forEach(([key, value]) => {
    if (omittedKeys.has(key)) {
      return;
    }

    seed[key] = value;
  });

  return seed;
}

function resolveFoundationCommandPatch(command: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(command.patch)) {
    return command.patch;
  }

  if (isRecord(command.foundation)) {
    return command.foundation;
  }

  if (isRecord(command.payload)) {
    return command.payload;
  }

  if (isRecord(command.data)) {
    return command.data;
  }

  const fallback = omitFoundationCommandMeta(command);
  return Object.keys(fallback).length > 0 ? fallback : null;
}

function collectFoundationPatchPaths(patch: FoundationPatch, prefix: string = ''): string[] {
  const paths: string[] = [];

  Object.entries(patch).forEach(([key, value]) => {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value) || !isRecord(value)) {
      paths.push(nextPath);
      return;
    }

    const nested = collectFoundationPatchPaths(value as FoundationPatch, nextPath);
    paths.push(...(nested.length > 0 ? nested : [nextPath]));
  });

  return paths;
}

function applyFoundationCommands(
  baseFoundationPatch: FoundationPatch,
  commandItems: unknown[],
): {
  foundationPatch: FoundationPatch;
  appliedCommandCount: number;
  commandWarnings: string[];
} {
  let nextPatch: FoundationPatch = { ...baseFoundationPatch };
  let appliedCommandCount = 0;
  const commandWarnings: string[] = [];
  const lastPatchIndexByField = new Map<string, number>();

  commandItems.forEach((item, index) => {
    if (!isRecord(item)) {
      return;
    }

    const rawOperation = item.op ?? item.action ?? item.type ?? item.kind;
    const operation = typeof rawOperation === 'undefined' ? 'patch' : normalizeFoundationCommandOperation(rawOperation);
    if (operation !== 'patch') {
      commandWarnings.push(`foundation 命令#${index + 1} 不支持操作 ${String(item.op ?? item.action ?? item.type ?? item.kind)}，已跳过`);
      return;
    }

    const commandPatch = resolveFoundationCommandPatch(item);
    if (!commandPatch) {
      commandWarnings.push(`foundation.patch 命令#${index + 1} 缺少 patch，已跳过`);
      return;
    }

    const normalizedPatch = normalizeFoundationPatchFromRecord(commandPatch);
    if (Object.keys(normalizedPatch).length === 0) {
      commandWarnings.push(`foundation.patch 命令#${index + 1} 未产生有效字段，已跳过`);
      return;
    }

    const patchPaths = collectFoundationPatchPaths(normalizedPatch);
    patchPaths.forEach(field => {
      const previousIndex = lastPatchIndexByField.get(field);
      if (typeof previousIndex === 'number') {
        commandWarnings.push(
          `foundation 命令冲突：字段 ${String(field)} 被重复 patch（命令#${previousIndex + 1} -> 命令#${index + 1}）`,
        );
      }
      lastPatchIndexByField.set(field, index);
    });

    nextPatch = mergeFoundationPatch(nextPatch, normalizedPatch);
    appliedCommandCount += 1;
  });

  return {
    foundationPatch: nextPatch,
    appliedCommandCount,
    commandWarnings,
  };
}

export function normalizeFoundationCommandsFromPayload(
  payload: unknown,
  options: {
    baseFoundationPatch: FoundationPatch;
  },
): {
  hasField: boolean;
  foundationPatch: FoundationPatch;
  commandWarnings: string[];
} {
  const extractedFoundationCommands = extractFoundationCommandItems(payload);
  const extractedLegacyFoundationCommands = extractLegacyFoundationCommandItems(payload);
  const extractedCommands = extractGenericCommandItems(payload);
  if (!extractedFoundationCommands.hasField && !extractedLegacyFoundationCommands.hasField && !extractedCommands.hasField) {
    return {
      hasField: false,
      foundationPatch: options.baseFoundationPatch,
      commandWarnings: [],
    };
  }

  const normalizedGenericFoundationCommands = extractedCommands.items
    .map(item => normalizeFoundationCommandFromGenericCommand(item))
    .filter((item): item is Record<string, unknown> => item !== null);
  const normalizedLegacyGenericFoundationCommands = extractedCommands.items
    .map(item => normalizeLegacyFoundationCommandFromGenericCommand(item))
    .filter((item): item is Record<string, unknown> => item !== null);
  const mergedCommandItems = [
    ...extractedFoundationCommands.items,
    ...extractedLegacyFoundationCommands.items,
    ...normalizedGenericFoundationCommands,
    ...normalizedLegacyGenericFoundationCommands,
  ];
  const applied = applyFoundationCommands(options.baseFoundationPatch, mergedCommandItems);

  return {
    hasField: applied.appliedCommandCount > 0,
    foundationPatch: applied.foundationPatch,
    commandWarnings: applied.commandWarnings,
  };
}
