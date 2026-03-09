import type {
  WorldbookCommitMode,
  WorldbookEntryCandidate,
  WorldbookEntryCandidateConflict,
  WorldbookEntryCandidateConflictKind,
} from '../types/worldbuilding';

const DEFAULT_COMMIT_MODE: WorldbookCommitMode = 'append_rename';

type ExistingWorldbookEntrySnapshot = {
  name: string;
  normalizedName: string;
  keywordSet: Set<string>;
};

export type WorldbookCommitPreviewItem = {
  candidate: WorldbookEntryCandidate;
  conflict: WorldbookEntryCandidateConflict;
  overlapKeywords: string[];
  resolvedName: string;
  willRename: boolean;
};

export type WorldbookCommitPreview = {
  worldbookName: string;
  mode: WorldbookCommitMode;
  candidates: WorldbookCommitPreviewItem[];
  checkedCount: number;
  renameCount: number;
  conflictCountByKind: Record<WorldbookEntryCandidateConflictKind, number>;
};

export type CommittedWorldbookCandidate = {
  candidateId: string;
  category: string;
  originalName: string;
  resolvedName: string;
  content: string;
};

export type WorldbookCommitReceipt = {
  worldbookName: string;
  mode: WorldbookCommitMode;
  attemptedCount: number;
  successCount: number;
  renamedCount: number;
  failedCount: number;
  skippedCount: number;
  committedEntryNames: string[];
  renamedEntries: Array<{ from: string; to: string }>;
  errorMessage: string | null;
  committedCandidates: CommittedWorldbookCandidate[];
};

export type BuildWorldbookCommitPreviewInput = {
  worldbookName: string;
  candidates: WorldbookEntryCandidate[];
  mode?: WorldbookCommitMode;
};

export type CommitWorldbookCandidatesInput = BuildWorldbookCommitPreviewInput;

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName}不能为空`);
  }

  return normalized;
}

function normalizeCandidateText(value: string): string {
  return value.trim();
}

function toCompareKey(value: string): string {
  return normalizeCandidateText(value).toLocaleLowerCase();
}

function normalizeKeywordList(rawKeywords: readonly string[]): string[] {
  const deduped = new Set<string>();

  rawKeywords.forEach(keyword => {
    const normalized = normalizeCandidateText(keyword);
    if (!normalized) {
      return;
    }

    deduped.add(normalized);
  });

  return [...deduped];
}

function normalizeCommitMode(mode: WorldbookCommitMode | undefined): WorldbookCommitMode {
  if (!mode || mode === 'append_rename') {
    return DEFAULT_COMMIT_MODE;
  }

  console.warn(`[novelToST][worldbuilding] 当前提交模式 ${mode} 暂未实现，已回退为 append_rename`);
  return DEFAULT_COMMIT_MODE;
}

function extractEntryName(entry: Record<string, unknown>): string {
  if (typeof entry.name === 'string') {
    return normalizeCandidateText(entry.name);
  }

  return '';
}

function extractEntryKeywordSet(entry: Record<string, unknown>): Set<string> {
  const strategyValue = entry.strategy;
  if (typeof strategyValue !== 'object' || strategyValue === null || Array.isArray(strategyValue)) {
    return new Set<string>();
  }

  const keysValue = (strategyValue as Record<string, unknown>).keys;
  if (!Array.isArray(keysValue)) {
    return new Set<string>();
  }

  const keywordKeys = keysValue
    .map(keyword => {
      if (typeof keyword === 'string') {
        return toCompareKey(keyword);
      }

      return '';
    })
    .filter(Boolean);

  return new Set<string>(keywordKeys);
}

function normalizeExistingWorldbookEntries(rawEntries: unknown[]): ExistingWorldbookEntrySnapshot[] {
  return rawEntries
    .map(entry => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        return null;
      }

      const entryRecord = entry as Record<string, unknown>;
      const name = extractEntryName(entryRecord);
      if (!name) {
        return null;
      }

      return {
        name,
        normalizedName: toCompareKey(name),
        keywordSet: extractEntryKeywordSet(entryRecord),
      };
    })
    .filter((entry): entry is ExistingWorldbookEntrySnapshot => entry !== null);
}

function detectCandidateConflict(
  candidate: WorldbookEntryCandidate,
  existingEntries: ExistingWorldbookEntrySnapshot[],
): {
  conflict: WorldbookEntryCandidateConflict;
  overlapKeywords: string[];
} {
  const candidateName = normalizeCandidateText(candidate.name);
  const candidateNameKey = toCompareKey(candidateName);

  if (candidateName) {
    const nameConflictTarget = existingEntries.find(entry => entry.normalizedName === candidateNameKey);
    if (nameConflictTarget) {
      return {
        conflict: {
          kind: 'name',
          targetEntryName: nameConflictTarget.name,
        },
        overlapKeywords: [],
      };
    }
  }

  const candidateKeywords = normalizeKeywordList(candidate.keywords);
  if (candidateKeywords.length === 0) {
    return {
      conflict: { kind: 'none' },
      overlapKeywords: [],
    };
  }

  const keywordPairs = candidateKeywords.map(keyword => ({
    original: keyword,
    normalized: toCompareKey(keyword),
  }));

  for (const existingEntry of existingEntries) {
    const overlaps = keywordPairs
      .filter(keyword => existingEntry.keywordSet.has(keyword.normalized))
      .map(keyword => keyword.original);

    if (overlaps.length > 0) {
      return {
        conflict: {
          kind: 'keyword_overlap',
          targetEntryName: existingEntry.name,
        },
        overlapKeywords: overlaps,
      };
    }
  }

  return {
    conflict: { kind: 'none' },
    overlapKeywords: [],
  };
}

function resolveRenamedName(baseName: string, reservedNameKeys: Set<string>): string {
  const normalizedBaseName = normalizeCandidateText(baseName);
  if (!normalizedBaseName) {
    return '';
  }

  const normalizedBaseKey = toCompareKey(normalizedBaseName);
  if (!reservedNameKeys.has(normalizedBaseKey)) {
    reservedNameKeys.add(normalizedBaseKey);
    return normalizedBaseName;
  }

  let suffix = 2;
  while (suffix < 100000) {
    const candidateName = `${normalizedBaseName} (${suffix})`;
    const candidateKey = toCompareKey(candidateName);
    if (!reservedNameKeys.has(candidateKey)) {
      reservedNameKeys.add(candidateKey);
      return candidateName;
    }
    suffix += 1;
  }

  throw new Error(`无法为条目 ${normalizedBaseName} 生成唯一名称`);
}

function buildResolvedNameMap(
  candidates: WorldbookEntryCandidate[],
  existingEntries: ExistingWorldbookEntrySnapshot[],
): Map<string, string> {
  const checkedCandidates = candidates.filter(candidate => candidate.checked);
  const reservedNameKeys = new Set(existingEntries.map(entry => entry.normalizedName));
  const resolvedNameMap = new Map<string, string>();

  checkedCandidates.forEach(candidate => {
    const normalizedName = normalizeCandidateText(candidate.name);
    if (!normalizedName) {
      resolvedNameMap.set(candidate.id, '');
      return;
    }

    resolvedNameMap.set(candidate.id, resolveRenamedName(normalizedName, reservedNameKeys));
  });

  return resolvedNameMap;
}

export async function listSelectableWorldbooks(): Promise<string[]> {
  const names = getWorldbookNames();
  const deduped = new Set<string>();

  names.forEach(name => {
    const normalizedName = normalizeCandidateText(name);
    if (!normalizedName) {
      return;
    }

    deduped.add(normalizedName);
  });

  return [...deduped];
}

export async function buildCommitPreview(input: BuildWorldbookCommitPreviewInput): Promise<WorldbookCommitPreview> {
  const worldbookName = normalizeRequiredText(input.worldbookName, '目标世界书名称');
  const mode = normalizeCommitMode(input.mode);
  const rawWorldbookEntries = await getWorldbook(worldbookName);
  const existingEntries = normalizeExistingWorldbookEntries(rawWorldbookEntries as unknown[]);
  const resolvedNameMap = buildResolvedNameMap(input.candidates, existingEntries);

  const previewItems = input.candidates.map(candidate => {
    const normalizedName = normalizeCandidateText(candidate.name);
    const { conflict, overlapKeywords } = detectCandidateConflict(candidate, existingEntries);
    const resolvedName = candidate.checked
      ? (resolvedNameMap.get(candidate.id) ?? normalizedName)
      : normalizedName;

    return {
      candidate,
      conflict,
      overlapKeywords,
      resolvedName,
      willRename: candidate.checked && normalizedName.length > 0 && resolvedName !== normalizedName,
    };
  });

  const checkedItems = previewItems.filter(item => item.candidate.checked);

  const conflictCountByKind: Record<WorldbookEntryCandidateConflictKind, number> = {
    none: 0,
    name: 0,
    keyword_overlap: 0,
  };

  checkedItems.forEach(item => {
    conflictCountByKind[item.conflict.kind] += 1;
  });

  const renameCount = checkedItems.filter(item => item.willRename).length;

  return {
    worldbookName,
    mode,
    candidates: previewItems,
    checkedCount: checkedItems.length,
    renameCount,
    conflictCountByKind,
  };
}

function buildWorldbookEntryPayload(item: WorldbookCommitPreviewItem): Record<string, unknown> {
  return {
    name: item.resolvedName,
    enabled: true,
    content: item.candidate.content,
    strategy: {
      type: item.candidate.strategy,
      keys: normalizeKeywordList(item.candidate.keywords),
      keys_secondary: {
        logic: 'and_any',
        keys: [],
      },
      scan_depth: 'same_as_global',
    },
    extra: {
      novelToST: {
        source: 'worldbuilding-workbench',
        candidateId: item.candidate.id,
        category: item.candidate.category,
        originalName: item.candidate.name,
      },
    },
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function commitCandidates(input: CommitWorldbookCandidatesInput): Promise<WorldbookCommitReceipt> {
  const preview = await buildCommitPreview(input);

  const checkedItems = preview.candidates.filter(item => item.candidate.checked);
  const invalidNameCount = checkedItems.filter(item => !item.resolvedName.trim()).length;

  const payloadItems = checkedItems.filter(item => item.resolvedName.trim());
  const payload = payloadItems.map(item => buildWorldbookEntryPayload(item));

  const skippedCount = Math.max(0, input.candidates.length - checkedItems.length);
  const renamedEntries = payloadItems
    .filter(item => item.willRename)
    .map(item => ({
      from: normalizeCandidateText(item.candidate.name),
      to: item.resolvedName,
    }));

  if (payload.length === 0) {
    return {
      worldbookName: preview.worldbookName,
      mode: preview.mode,
      attemptedCount: checkedItems.length,
      successCount: 0,
      renamedCount: renamedEntries.length,
      failedCount: invalidNameCount,
      skippedCount,
      committedEntryNames: [],
      renamedEntries,
      errorMessage: checkedItems.length === 0 ? '未选择可提交的候选条目' : '存在空名称候选，无法提交',
      committedCandidates: [],
    };
  }

  try {
    const commitResult = await createWorldbookEntries(preview.worldbookName, payload, {
      render: 'debounced',
    });

    const committedEntryNames = commitResult.new_entries
      .map(entry => {
        if (typeof entry.name !== 'string') {
          return '';
        }

        return entry.name.trim();
      })
      .filter(Boolean);

    const committedEntryNameSet = new Set(committedEntryNames.map(entryName => toCompareKey(entryName)));
    const committedCandidates = payloadItems
      .filter(item => committedEntryNameSet.has(toCompareKey(item.resolvedName)))
      .map(item => ({
        candidateId: item.candidate.id,
        category: item.candidate.category,
        originalName: normalizeCandidateText(item.candidate.name),
        resolvedName: item.resolvedName,
        content: item.candidate.content,
      }));

    const successCount = committedEntryNames.length;
    const failedCount = invalidNameCount + Math.max(0, payload.length - successCount);

    return {
      worldbookName: preview.worldbookName,
      mode: preview.mode,
      attemptedCount: checkedItems.length,
      successCount,
      renamedCount: renamedEntries.length,
      failedCount,
      skippedCount,
      committedEntryNames,
      renamedEntries,
      errorMessage: null,
      committedCandidates,
    };
  } catch (error) {
    return {
      worldbookName: preview.worldbookName,
      mode: preview.mode,
      attemptedCount: checkedItems.length,
      successCount: 0,
      renamedCount: renamedEntries.length,
      failedCount: checkedItems.length,
      skippedCount,
      committedEntryNames: [],
      renamedEntries,
      errorMessage: toErrorMessage(error),
      committedCandidates: [],
    };
  }
}
