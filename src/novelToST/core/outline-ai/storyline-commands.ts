import type { Storyline } from '../../types/outline';
import {
  extractGenericCommandItems,
  isRecord,
  normalizeCrudCommandOperation,
  normalizeStorylineFromItem,
  type ExtractedItems,
  type OutlineCrudCommandOp,
} from './shared';

type OutlineStorylineCommandOp = OutlineCrudCommandOp;

function extractStorylineCommandItems(payload: unknown): ExtractedItems {
  if (!isRecord(payload)) {
    return {
      hasField: false,
      items: [],
    };
  }

  if (Array.isArray(payload.storylineCommands)) {
    return {
      hasField: true,
      items: payload.storylineCommands,
    };
  }

  if (Array.isArray(payload.storylineOps)) {
    return {
      hasField: true,
      items: payload.storylineOps,
    };
  }

  const outlineSection = payload.outline;
  if (isRecord(outlineSection)) {
    if (Array.isArray(outlineSection.storylineCommands)) {
      return {
        hasField: true,
        items: outlineSection.storylineCommands,
      };
    }

    if (Array.isArray(outlineSection.storylineOps)) {
      return {
        hasField: true,
        items: outlineSection.storylineOps,
      };
    }
  }

  return {
    hasField: false,
    items: [],
  };
}

function normalizeStorylineCommandOperationFromType(raw: unknown): OutlineStorylineCommandOp | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'storyline.create' ||
    normalized === 'storyline_create' ||
    normalized === 'create_storyline' ||
    normalized === 'outline.storyline.create'
  ) {
    return 'create';
  }

  if (
    normalized === 'storyline.update' ||
    normalized === 'storyline_update' ||
    normalized === 'update_storyline' ||
    normalized === 'outline.storyline.update'
  ) {
    return 'update';
  }

  if (
    normalized === 'storyline.delete' ||
    normalized === 'storyline_remove' ||
    normalized === 'storyline_delete' ||
    normalized === 'delete_storyline' ||
    normalized === 'remove_storyline' ||
    normalized === 'outline.storyline.delete' ||
    normalized === 'outline.storyline.remove'
  ) {
    return 'delete';
  }

  return null;
}

function isStorylineCommandTarget(raw: unknown): boolean {
  if (typeof raw !== 'string') {
    return false;
  }

  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, '_');

  return (
    normalized === 'storyline' ||
    normalized === 'storylines' ||
    normalized === 'line' ||
    normalized === 'lines' ||
    normalized === 'outline_storyline' ||
    normalized === 'outline_storylines'
  );
}

function normalizeStorylineCommandFromGenericCommand(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) {
    return null;
  }

  const operationByType = normalizeStorylineCommandOperationFromType(item.type ?? item.kind);
  const hasStorylineTarget = [item.target, item.entity, item.resource].some(value => isStorylineCommandTarget(value));
  const operationByOp = hasStorylineTarget ? normalizeCrudCommandOperation(item.op ?? item.action) : null;
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

function resolveStorylineCommandId(command: Record<string, unknown>): string {
  const candidates = [command.id, command.storylineId, command.targetId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function omitStorylineCommandMeta(command: Record<string, unknown>): Record<string, unknown> {
  const omittedKeys = new Set([
    'op',
    'action',
    'id',
    'storylineId',
    'targetId',
    'patch',
    'storyline',
    'line',
    'payload',
    'data',
    'type',
    'kind',
    'target',
    'entity',
    'resource',
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

function resolveStorylineCommandPatch(command: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(command.patch)) {
    return command.patch;
  }

  if (isRecord(command.storyline)) {
    return command.storyline;
  }

  if (isRecord(command.line)) {
    return command.line;
  }

  if (isRecord(command.payload)) {
    return command.payload;
  }

  if (isRecord(command.data)) {
    return command.data;
  }

  const fallback = omitStorylineCommandMeta(command);
  return Object.keys(fallback).length > 0 ? fallback : null;
}

function resolveStorylineCommandCreateSeed(command: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(command.storyline)) {
    return command.storyline;
  }

  if (isRecord(command.line)) {
    return command.line;
  }

  if (isRecord(command.payload)) {
    return command.payload;
  }

  if (isRecord(command.data)) {
    return command.data;
  }

  const fallback = omitStorylineCommandMeta(command);
  const commandStorylineId = resolveStorylineCommandId(command);
  if (commandStorylineId) {
    fallback.id = commandStorylineId;
  }

  return Object.keys(fallback).length > 0 ? fallback : null;
}

function compareStorylineOrder(left: Storyline, right: Storyline): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.id.localeCompare(right.id);
}

export function sortStorylines(storylines: Storyline[]): Storyline[] {
  return [...storylines].sort(compareStorylineOrder);
}

function ensureUniqueStorylineId(candidate: string, existingIds: Set<string>, fallbackIndex: number): string {
  const baseId = candidate.trim() || `outline-ai-storyline-${Math.max(1, Math.trunc(fallbackIndex) + 1)}`;
  let nextId = baseId;
  let suffix = 1;
  while (existingIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }

  return nextId;
}

function applyStorylineCommands(
  baseStorylines: Storyline[],
  commandItems: unknown[],
): {
  storylines: Storyline[];
  appliedCommandCount: number;
  commandWarnings: string[];
} {
  let nextStorylines = [...baseStorylines];
  let appliedCommandCount = 0;
  const commandWarnings: string[] = [];
  const nextStorylineIds = new Set(nextStorylines.map(storyline => storyline.id));
  const lastOperationByStorylineId = new Map<string, OutlineStorylineCommandOp>();

  commandItems.forEach((item, index) => {
    if (!isRecord(item)) {
      return;
    }

    const operation = normalizeCrudCommandOperation(item.op ?? item.action);
    if (!operation) {
      return;
    }

    if (operation === 'delete') {
      const commandStorylineId = resolveStorylineCommandId(item);
      if (!commandStorylineId) {
        commandWarnings.push(`storyline.delete 命令#${index + 1} 缺少 id，已跳过`);
        return;
      }

      if (!nextStorylineIds.has(commandStorylineId)) {
        const lastOperation = lastOperationByStorylineId.get(commandStorylineId);
        if (lastOperation === 'delete') {
          commandWarnings.push(`storyline 命令冲突：id=${commandStorylineId} 在删除后再次删除（命令#${index + 1}）`);
        } else {
          commandWarnings.push(`storyline.delete 命令#${index + 1} 目标不存在（id=${commandStorylineId}），已跳过`);
        }
        return;
      }

      if (nextStorylines.length <= 1) {
        commandWarnings.push(
          `storyline.delete 命令#${index + 1} 被拒绝：至少需保留 1 条 storyline（id=${commandStorylineId}）`,
        );
        return;
      }

      const previousOperation = lastOperationByStorylineId.get(commandStorylineId);
      if (previousOperation === 'update') {
        commandWarnings.push(`storyline 命令冲突：id=${commandStorylineId} 先更新后删除（命令#${index + 1}）`);
      }

      if (previousOperation === 'create') {
        commandWarnings.push(`storyline 命令冲突：id=${commandStorylineId} 同轮先创建后删除（命令#${index + 1}）`);
      }

      nextStorylines = nextStorylines.filter(storyline => storyline.id !== commandStorylineId);
      nextStorylineIds.delete(commandStorylineId);
      lastOperationByStorylineId.set(commandStorylineId, 'delete');
      appliedCommandCount += 1;
      return;
    }

    if (operation === 'update') {
      const commandStorylineId = resolveStorylineCommandId(item);
      if (!commandStorylineId) {
        commandWarnings.push(`storyline.update 命令#${index + 1} 缺少 id，已跳过`);
        return;
      }

      const targetStorylineIndex = nextStorylines.findIndex(storyline => storyline.id === commandStorylineId);
      if (targetStorylineIndex < 0) {
        const lastOperation = lastOperationByStorylineId.get(commandStorylineId);
        if (lastOperation === 'delete') {
          commandWarnings.push(`storyline 命令冲突：id=${commandStorylineId} 先删除后更新（命令#${index + 1}）`);
        } else {
          commandWarnings.push(`storyline.update 命令#${index + 1} 目标不存在（id=${commandStorylineId}），已跳过`);
        }
        return;
      }

      const patch = resolveStorylineCommandPatch(item);
      if (!patch) {
        commandWarnings.push(`storyline.update 命令#${index + 1} 缺少 patch，已跳过（id=${commandStorylineId}）`);
        return;
      }

      const normalizedStoryline = normalizeStorylineFromItem(
        {
          ...nextStorylines[targetStorylineIndex],
          ...patch,
          id: commandStorylineId,
        },
        nextStorylines.length + index,
      );

      if (!normalizedStoryline) {
        return;
      }

      const requestedStorylineId = typeof patch.id === 'string' ? patch.id.trim() : '';
      if (requestedStorylineId && requestedStorylineId !== commandStorylineId) {
        commandWarnings.push(`storyline.update 命令#${index + 1} 试图改写 id，已忽略（id=${commandStorylineId}）`);
      }

      nextStorylines[targetStorylineIndex] = {
        ...normalizedStoryline,
        id: commandStorylineId,
      };
      appliedCommandCount += 1;
      lastOperationByStorylineId.set(commandStorylineId, 'update');
      return;
    }

    const createSeed = resolveStorylineCommandCreateSeed(item);
    if (!createSeed) {
      commandWarnings.push(`storyline.create 命令#${index + 1} 缺少创建数据，已跳过`);
      return;
    }

    const requestedStorylineId = typeof createSeed.id === 'string' ? createSeed.id.trim() : '';
    if (requestedStorylineId && nextStorylineIds.has(requestedStorylineId)) {
      commandWarnings.push(`storyline.create 命令#${index + 1} 的 id=${requestedStorylineId} 已存在，系统将自动重命名`);
    }

    const normalizedStoryline = normalizeStorylineFromItem(createSeed, nextStorylines.length + index);
    if (!normalizedStoryline) {
      commandWarnings.push(`storyline.create 命令#${index + 1} 创建数据无效，已跳过`);
      return;
    }

    const nextStorylineId = ensureUniqueStorylineId(normalizedStoryline.id, nextStorylineIds, nextStorylines.length + index);
    const createdStoryline = {
      ...normalizedStoryline,
      id: nextStorylineId,
    };

    nextStorylines.push(createdStoryline);
    nextStorylineIds.add(nextStorylineId);
    lastOperationByStorylineId.set(nextStorylineId, 'create');
    appliedCommandCount += 1;
  });

  return {
    storylines: sortStorylines(nextStorylines),
    appliedCommandCount,
    commandWarnings,
  };
}

export function normalizeStorylineCommandsFromPayload(
  payload: unknown,
  options: {
    baseStorylines: Storyline[];
  },
): {
  hasField: boolean;
  storylines: Storyline[];
  commandWarnings: string[];
} {
  const extractedStorylineCommands = extractStorylineCommandItems(payload);
  const extractedCommands = extractGenericCommandItems(payload);

  if (!extractedStorylineCommands.hasField && !extractedCommands.hasField) {
    return {
      hasField: false,
      storylines: [],
      commandWarnings: [],
    };
  }

  const normalizedGenericStorylineCommands = extractedCommands.items
    .map(item => normalizeStorylineCommandFromGenericCommand(item))
    .filter((item): item is Record<string, unknown> => item !== null);
  const mergedCommandItems = [...extractedStorylineCommands.items, ...normalizedGenericStorylineCommands];
  if (mergedCommandItems.length === 0) {
    return {
      hasField: false,
      storylines: [],
      commandWarnings: [],
    };
  }

  const applied = applyStorylineCommands(options.baseStorylines, mergedCommandItems);
  return {
    hasField: applied.appliedCommandCount > 0,
    storylines: applied.storylines,
    commandWarnings: applied.commandWarnings,
  };
}
