import type {
  ChapterDetail,
  MasterOutlineNode,
  Storyline,
} from '../../types/outline';
import type { FoundationPatch } from '../foundation-legacy.service';
import { normalizeFoundationPatchFromPayload } from './foundation-compat';
import { normalizeFoundationCommandsFromPayload } from './foundation-commands';
import {
  normalizeChapterDetailCommandsFromPayload,
  normalizeChapterDetailsRecordFromPayload,
} from './detail-commands';
import {
  normalizeMasterOutlineCommandsFromPayload,
  normalizeMasterOutlineFromPayload,
} from './node-commands';
import {
  isRecord,
  normalizeStorylineFromItem,
  type ExtractedItems,
} from './shared';
import {
  normalizeStorylineCommandsFromPayload,
  sortStorylines,
} from './storyline-commands';

export type ParseOutlineWorkshopPayloadOptions = {
  chapterCount: number;
  baseStorylines?: Storyline[];
  baseMasterOutline?: MasterOutlineNode[];
  baseDetailsByChapter?: Record<number, ChapterDetail>;
};

export type ParsedOutlineWorkshopPayload = {
  foundationPatch: FoundationPatch | null;
  storylines: Storyline[] | null;
  masterOutline: MasterOutlineNode[] | null;
  detailsByChapter: Record<number, ChapterDetail> | null;
  commandWarnings: string[];
  hasStructuredUpdate: boolean;
};

function extractStorylineItems(payload: unknown): ExtractedItems {
  if (!isRecord(payload)) {
    return {
      hasField: false,
      items: [],
    };
  }

  if (Array.isArray(payload.storylines)) {
    return {
      hasField: true,
      items: payload.storylines,
    };
  }

  const outlineSection = payload.outline;
  if (isRecord(outlineSection) && Array.isArray(outlineSection.storylines)) {
    return {
      hasField: true,
      items: outlineSection.storylines,
    };
  }

  return {
    hasField: false,
    items: [],
  };
}

function normalizeStorylinesFromPayload(payload: unknown): {
  hasField: boolean;
  storylines: Storyline[];
} {
  const extracted = extractStorylineItems(payload);
  if (!extracted.hasField) {
    return {
      hasField: false,
      storylines: [],
    };
  }

  const storylines = extracted.items
    .map((item, index) => normalizeStorylineFromItem(item, index))
    .filter((storyline): storyline is Storyline => storyline !== null);

  return {
    hasField: true,
    storylines: sortStorylines(storylines),
  };
}

export function parseOutlineWorkshopPayload(
  payload: unknown,
  options: ParseOutlineWorkshopPayloadOptions,
): ParsedOutlineWorkshopPayload {
  const chapterCount = Math.max(1, Math.trunc(options.chapterCount));

  const parsedFoundationPatchFromPayload = normalizeFoundationPatchFromPayload(payload);
  const commandBaseFoundationPatch = parsedFoundationPatchFromPayload ?? {};
  const parsedFoundationCommands = normalizeFoundationCommandsFromPayload(payload, {
    baseFoundationPatch: commandBaseFoundationPatch,
  });
  const resolvedFoundationHasField = parsedFoundationPatchFromPayload !== null || parsedFoundationCommands.hasField;
  const resolvedFoundationPatch = parsedFoundationCommands.hasField
    ? parsedFoundationCommands.foundationPatch
    : parsedFoundationPatchFromPayload;

  const parsedStorylinesFromPayload = normalizeStorylinesFromPayload(payload);
  const commandBaseStorylines =
    parsedStorylinesFromPayload.hasField ? parsedStorylinesFromPayload.storylines : options.baseStorylines ?? [];
  const parsedStorylineCommands = normalizeStorylineCommandsFromPayload(payload, {
    baseStorylines: commandBaseStorylines,
  });
  const resolvedStorylinesHasField = parsedStorylinesFromPayload.hasField || parsedStorylineCommands.hasField;
  const resolvedStorylines = parsedStorylineCommands.hasField
    ? parsedStorylineCommands.storylines
    : parsedStorylinesFromPayload.storylines;

  const parsedMasterOutline = normalizeMasterOutlineFromPayload(payload, chapterCount);
  const commandBaseMasterOutline =
    parsedMasterOutline.hasField ? parsedMasterOutline.masterOutline : options.baseMasterOutline ?? [];
  const parsedMasterOutlineCommands = normalizeMasterOutlineCommandsFromPayload(payload, {
    chapterCount,
    baseMasterOutline: commandBaseMasterOutline,
  });
  const resolvedMasterOutlineHasField = parsedMasterOutline.hasField || parsedMasterOutlineCommands.hasField;
  const resolvedMasterOutline = parsedMasterOutlineCommands.hasField
    ? parsedMasterOutlineCommands.masterOutline
    : parsedMasterOutline.masterOutline;

  const parsedDetailsFromPayload = normalizeChapterDetailsRecordFromPayload(payload);
  const commandBaseDetailsByChapter =
    parsedDetailsFromPayload.hasField ? parsedDetailsFromPayload.detailsByChapter : options.baseDetailsByChapter ?? {};
  const parsedDetailCommands = normalizeChapterDetailCommandsFromPayload(payload, {
    baseDetailsByChapter: commandBaseDetailsByChapter,
  });
  const resolvedDetailsHasField = parsedDetailsFromPayload.hasField || parsedDetailCommands.hasField;
  const resolvedDetailsByChapter = parsedDetailCommands.hasField
    ? parsedDetailCommands.detailsByChapter
    : parsedDetailsFromPayload.detailsByChapter;
  const commandWarnings = [
    ...parsedFoundationCommands.commandWarnings,
    ...parsedStorylineCommands.commandWarnings,
    ...parsedMasterOutlineCommands.commandWarnings,
    ...parsedDetailCommands.commandWarnings,
  ];

  return {
    foundationPatch: resolvedFoundationHasField ? resolvedFoundationPatch ?? {} : null,
    storylines: resolvedStorylinesHasField ? resolvedStorylines : null,
    masterOutline: resolvedMasterOutlineHasField ? resolvedMasterOutline : null,
    detailsByChapter: resolvedDetailsHasField ? resolvedDetailsByChapter : null,
    commandWarnings,
    hasStructuredUpdate:
      resolvedFoundationHasField ||
      resolvedStorylinesHasField ||
      resolvedMasterOutlineHasField ||
      resolvedDetailsHasField,
  };
}
