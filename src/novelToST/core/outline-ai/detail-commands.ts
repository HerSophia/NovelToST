import type { ChapterDetail } from '../../types/outline';
import {
  extractGenericCommandItems,
  isRecord,
  normalizeChapter,
  normalizeChapterDetailFromItem,
  normalizeCrudCommandOperation,
  type ExtractedItems,
  type OutlineCrudCommandOp,
} from './shared';

type OutlineDetailCommandOp = OutlineCrudCommandOp;

function extractDetailCommandItems(payload: unknown): ExtractedItems {
  if (!isRecord(payload)) {
    return {
      hasField: false,
      items: [],
    };
  }

  if (Array.isArray(payload.detailCommands)) {
    return {
      hasField: true,
      items: payload.detailCommands,
    };
  }

  if (Array.isArray(payload.detailOps)) {
    return {
      hasField: true,
      items: payload.detailOps,
    };
  }

  if (Array.isArray(payload.chapterDetailCommands)) {
    return {
      hasField: true,
      items: payload.chapterDetailCommands,
    };
  }

  if (Array.isArray(payload.chapterDetailOps)) {
    return {
      hasField: true,
      items: payload.chapterDetailOps,
    };
  }

  const outlineSection = payload.outline;
  if (isRecord(outlineSection)) {
    if (Array.isArray(outlineSection.detailCommands)) {
      return {
        hasField: true,
        items: outlineSection.detailCommands,
      };
    }

    if (Array.isArray(outlineSection.detailOps)) {
      return {
        hasField: true,
        items: outlineSection.detailOps,
      };
    }

    if (Array.isArray(outlineSection.chapterDetailCommands)) {
      return {
        hasField: true,
        items: outlineSection.chapterDetailCommands,
      };
    }

    if (Array.isArray(outlineSection.chapterDetailOps)) {
      return {
        hasField: true,
        items: outlineSection.chapterDetailOps,
      };
    }
  }

  return {
    hasField: false,
    items: [],
  };
}

function normalizeDetailCommandOperationFromType(raw: unknown): OutlineDetailCommandOp | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'detail.create' ||
    normalized === 'detail_create' ||
    normalized === 'create_detail' ||
    normalized === 'chapter_detail.create' ||
    normalized === 'chapter_detail_create' ||
    normalized === 'create_chapter_detail' ||
    normalized === 'chapterdetail.create' ||
    normalized === 'chapterdetail_create' ||
    normalized === 'outline.detail.create'
  ) {
    return 'create';
  }

  if (
    normalized === 'detail.update' ||
    normalized === 'detail_update' ||
    normalized === 'update_detail' ||
    normalized === 'chapter_detail.update' ||
    normalized === 'chapter_detail_update' ||
    normalized === 'update_chapter_detail' ||
    normalized === 'chapterdetail.update' ||
    normalized === 'chapterdetail_update' ||
    normalized === 'outline.detail.update'
  ) {
    return 'update';
  }

  if (
    normalized === 'detail.delete' ||
    normalized === 'detail.remove' ||
    normalized === 'detail_remove' ||
    normalized === 'detail_delete' ||
    normalized === 'delete_detail' ||
    normalized === 'remove_detail' ||
    normalized === 'chapter_detail.delete' ||
    normalized === 'chapter_detail.remove' ||
    normalized === 'chapter_detail_delete' ||
    normalized === 'delete_chapter_detail' ||
    normalized === 'remove_chapter_detail' ||
    normalized === 'chapterdetail.delete' ||
    normalized === 'chapterdetail.remove' ||
    normalized === 'outline.detail.delete' ||
    normalized === 'outline.detail.remove'
  ) {
    return 'delete';
  }

  return null;
}

function isDetailCommandTarget(raw: unknown): boolean {
  if (typeof raw !== 'string') {
    return false;
  }

  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, '_');

  return (
    normalized === 'detail' ||
    normalized === 'details' ||
    normalized === 'chapter_detail' ||
    normalized === 'chapter_details' ||
    normalized === 'chapterdetail' ||
    normalized === 'chapterdetails' ||
    normalized === 'outline_detail' ||
    normalized === 'outline_details'
  );
}

function normalizeDetailCommandFromGenericCommand(item: unknown): Record<string, unknown> | null {
  if (!isRecord(item)) {
    return null;
  }

  const operationByType = normalizeDetailCommandOperationFromType(item.type ?? item.kind);
  const hasDetailTarget = [item.target, item.entity, item.resource].some(value => isDetailCommandTarget(value));
  const operationByOp = hasDetailTarget ? normalizeCrudCommandOperation(item.op ?? item.action) : null;
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

function resolveDetailCommandChapter(command: Record<string, unknown>): number | null {
  const candidates = [command.chapter, command.chapterNumber, command.chapterNo, command.id, command.detailId, command.targetId];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return normalizeChapter(candidate, 1);
    }

    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate.trim());
      if (Number.isFinite(parsed)) {
        return normalizeChapter(parsed, 1);
      }
    }
  }

  return null;
}

function omitDetailCommandMeta(command: Record<string, unknown>): Record<string, unknown> {
  const omittedKeys = new Set([
    'op',
    'action',
    'id',
    'detailId',
    'chapter',
    'chapterNo',
    'chapterNumber',
    'targetId',
    'patch',
    'detail',
    'chapterDetail',
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

function resolveDetailCommandPatch(command: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(command.patch)) {
    return command.patch;
  }

  if (isRecord(command.detail)) {
    return command.detail;
  }

  if (isRecord(command.chapterDetail)) {
    return command.chapterDetail;
  }

  if (isRecord(command.payload)) {
    return command.payload;
  }

  if (isRecord(command.data)) {
    return command.data;
  }

  const fallback = omitDetailCommandMeta(command);
  return Object.keys(fallback).length > 0 ? fallback : null;
}

function resolveDetailCommandCreateSeed(command: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(command.detail)) {
    return command.detail;
  }

  if (isRecord(command.chapterDetail)) {
    return command.chapterDetail;
  }

  if (isRecord(command.payload)) {
    return command.payload;
  }

  if (isRecord(command.data)) {
    return command.data;
  }

  const fallback = omitDetailCommandMeta(command);
  const commandChapter = resolveDetailCommandChapter(command);
  if (commandChapter !== null) {
    fallback.chapter = commandChapter;
  }

  return Object.keys(fallback).length > 0 ? fallback : null;
}

function sortDetailsByChapter(detailsByChapter: Record<number, ChapterDetail>): Record<number, ChapterDetail> {
  const sortedEntries = Object.entries(detailsByChapter)
    .map(([key, detail]) => ({
      chapter: Number(key),
      detail,
    }))
    .filter(item => Number.isFinite(item.chapter) && item.chapter >= 1)
    .sort((left, right) => left.chapter - right.chapter);

  const sorted: Record<number, ChapterDetail> = {};
  sortedEntries.forEach(item => {
    sorted[item.chapter] = item.detail;
  });

  return sorted;
}

function extractChapterDetailItems(
  payload: unknown,
  options: {
    allowRootArray: boolean;
  },
): ExtractedItems {
  if (options.allowRootArray && Array.isArray(payload)) {
    return {
      hasField: true,
      items: payload,
    };
  }

  if (!isRecord(payload)) {
    return {
      hasField: false,
      items: [],
    };
  }

  if (Array.isArray(payload.details)) {
    return {
      hasField: true,
      items: payload.details,
    };
  }

  if (Array.isArray(payload.chapterDetails)) {
    return {
      hasField: true,
      items: payload.chapterDetails,
    };
  }

  if (Array.isArray(payload.chapters)) {
    return {
      hasField: true,
      items: payload.chapters,
    };
  }

  if (isRecord(payload.detail)) {
    return {
      hasField: true,
      items: [payload.detail],
    };
  }

  if (isRecord(payload.detailsByChapter)) {
    const mapped = Object.entries(payload.detailsByChapter).map(([key, value]) => ({
      chapter: Number(key),
      ...(isRecord(value) ? value : {}),
    }));

    return {
      hasField: true,
      items: mapped,
    };
  }

  const asChapterMap = Object.entries(payload)
    .filter(([key, value]) => /^\d+$/.test(key) && isRecord(value))
    .map(([key, value]) => ({
      chapter: Number(key),
      ...(value as Record<string, unknown>),
    }));

  if (asChapterMap.length > 0) {
    return {
      hasField: true,
      items: asChapterMap,
    };
  }

  return {
    hasField: false,
    items: [],
  };
}

export function normalizeChapterDetailsFromPayload(
  payload: unknown,
  options: {
    allowRootArray: boolean;
  },
): {
  hasField: boolean;
  details: ChapterDetail[];
} {
  const extracted = extractChapterDetailItems(payload, options);
  if (!extracted.hasField) {
    return {
      hasField: false,
      details: [],
    };
  }

  const details = extracted.items
    .map(item => normalizeChapterDetailFromItem(item, 1))
    .filter((detail): detail is ChapterDetail => detail !== null)
    .sort((left, right) => left.chapter - right.chapter);

  return {
    hasField: true,
    details,
  };
}

export function normalizeChapterDetailsRecordFromPayload(payload: unknown): {
  hasField: boolean;
  detailsByChapter: Record<number, ChapterDetail>;
} {
  const parsed = normalizeChapterDetailsFromPayload(payload, { allowRootArray: false });
  if (!parsed.hasField) {
    return {
      hasField: false,
      detailsByChapter: {},
    };
  }

  const detailsByChapter: Record<number, ChapterDetail> = {};
  parsed.details.forEach(detail => {
    detailsByChapter[detail.chapter] = detail;
  });

  return {
    hasField: true,
    detailsByChapter,
  };
}

function applyDetailCommandsToRecord(
  baseDetailsByChapter: Record<number, ChapterDetail>,
  commandItems: unknown[],
): {
  detailsByChapter: Record<number, ChapterDetail>;
  appliedCommandCount: number;
  commandWarnings: string[];
} {
  const nextDetailsByChapter = { ...baseDetailsByChapter };
  let appliedCommandCount = 0;
  const commandWarnings: string[] = [];
  const lastOperationByChapter = new Map<number, OutlineDetailCommandOp>();

  commandItems.forEach((item, index) => {
    if (!isRecord(item)) {
      return;
    }

    const operation = normalizeCrudCommandOperation(item.op ?? item.action);
    if (!operation) {
      return;
    }

    const commandChapter = resolveDetailCommandChapter(item);

    if (operation === 'delete') {
      if (commandChapter === null) {
        commandWarnings.push(`detail.delete 命令#${index + 1} 缺少 chapter，已跳过`);
        return;
      }

      if (!Object.prototype.hasOwnProperty.call(nextDetailsByChapter, commandChapter)) {
        const lastOperation = lastOperationByChapter.get(commandChapter);
        if (lastOperation === 'delete') {
          commandWarnings.push(`detail 命令冲突：chapter=${commandChapter} 在删除后再次删除（命令#${index + 1}）`);
        } else {
          commandWarnings.push(`detail.delete 命令#${index + 1} 目标不存在（chapter=${commandChapter}），已跳过`);
        }
        return;
      }

      const previousOperation = lastOperationByChapter.get(commandChapter);
      if (previousOperation === 'update') {
        commandWarnings.push(`detail 命令冲突：chapter=${commandChapter} 先更新后删除（命令#${index + 1}）`);
      }

      if (previousOperation === 'create') {
        commandWarnings.push(`detail 命令冲突：chapter=${commandChapter} 同轮先创建后删除（命令#${index + 1}）`);
      }

      delete nextDetailsByChapter[commandChapter];
      lastOperationByChapter.set(commandChapter, 'delete');
      appliedCommandCount += 1;
      return;
    }

    if (operation === 'update') {
      const patch = resolveDetailCommandPatch(item);
      if (!patch) {
        commandWarnings.push(`detail.update 命令#${index + 1} 缺少 patch，已跳过`);
        return;
      }

      const targetChapter = commandChapter ?? resolveDetailCommandChapter(patch);
      if (targetChapter === null) {
        commandWarnings.push(`detail.update 命令#${index + 1} 缺少 chapter，已跳过`);
        return;
      }

      if (!Object.prototype.hasOwnProperty.call(nextDetailsByChapter, targetChapter)) {
        const lastOperation = lastOperationByChapter.get(targetChapter);
        if (lastOperation === 'delete') {
          commandWarnings.push(`detail 命令冲突：chapter=${targetChapter} 先删除后更新（命令#${index + 1}）`);
        } else {
          commandWarnings.push(`detail.update 命令#${index + 1} 目标不存在（chapter=${targetChapter}），已跳过`);
        }
        return;
      }

      if (typeof patch.chapter === 'number' && patch.chapter !== targetChapter) {
        commandWarnings.push(`detail.update 命令#${index + 1} 试图改写 chapter，已忽略（chapter=${targetChapter}）`);
      }

      const normalizedDetail = normalizeChapterDetailFromItem(
        {
          ...nextDetailsByChapter[targetChapter],
          ...patch,
          chapter: targetChapter,
        },
        targetChapter,
      );

      if (!normalizedDetail) {
        return;
      }

      nextDetailsByChapter[targetChapter] = normalizedDetail;
      appliedCommandCount += 1;
      lastOperationByChapter.set(targetChapter, 'update');
      return;
    }

    const createSeed = resolveDetailCommandCreateSeed(item);
    if (!createSeed) {
      commandWarnings.push(`detail.create 命令#${index + 1} 缺少创建数据，已跳过`);
      return;
    }

    const createChapter = commandChapter ?? resolveDetailCommandChapter(createSeed);
    if (createChapter === null) {
      commandWarnings.push(`detail.create 命令#${index + 1} 缺少 chapter，已跳过`);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(nextDetailsByChapter, createChapter)) {
      commandWarnings.push(`detail.create 命令#${index + 1} 目标已存在（chapter=${createChapter}），已跳过`);
      return;
    }

    const normalizedDetail = normalizeChapterDetailFromItem(
      {
        ...createSeed,
        chapter: createChapter,
      },
      createChapter,
    );

    if (!normalizedDetail) {
      commandWarnings.push(`detail.create 命令#${index + 1} 创建数据无效，已跳过（chapter=${createChapter}）`);
      return;
    }

    nextDetailsByChapter[createChapter] = normalizedDetail;
    appliedCommandCount += 1;
    lastOperationByChapter.set(createChapter, 'create');
  });

  return {
    detailsByChapter: sortDetailsByChapter(nextDetailsByChapter),
    appliedCommandCount,
    commandWarnings,
  };
}

export function normalizeChapterDetailCommandsFromPayload(
  payload: unknown,
  options: {
    baseDetailsByChapter: Record<number, ChapterDetail>;
  },
): {
  hasField: boolean;
  detailsByChapter: Record<number, ChapterDetail>;
  commandWarnings: string[];
} {
  const extractedDetailCommands = extractDetailCommandItems(payload);
  const extractedCommands = extractGenericCommandItems(payload);

  if (!extractedDetailCommands.hasField && !extractedCommands.hasField) {
    return {
      hasField: false,
      detailsByChapter: {},
      commandWarnings: [],
    };
  }

  const normalizedGenericDetailCommands = extractedCommands.items
    .map(item => normalizeDetailCommandFromGenericCommand(item))
    .filter((item): item is Record<string, unknown> => item !== null);
  const mergedCommandItems = [...extractedDetailCommands.items, ...normalizedGenericDetailCommands];
  const applied = applyDetailCommandsToRecord(options.baseDetailsByChapter, mergedCommandItems);

  return {
    hasField: applied.appliedCommandCount > 0,
    detailsByChapter: applied.detailsByChapter,
    commandWarnings: applied.commandWarnings,
  };
}
