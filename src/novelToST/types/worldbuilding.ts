export type WorldbuildingType =
  | 'character'
  | 'faction'
  | 'location'
  | 'system'
  | 'history_placeholder'
  | 'item_placeholder'
  | 'culture_placeholder'
  | 'custom_placeholder';

export type WorldbuildingMessageRole = 'user' | 'assistant' | 'system';

export type WorldbuildingAIBusyAction = 'expand' | 'refine' | 'consistency' | 'candidates';

export type WorldbuildingMessage = {
  id: string;
  role: WorldbuildingMessageRole;
  text: string;
  createdAt: string;
};

export type WorldbuildingRelation = {
  target: string;
  relation: string;
};

export type WorldbuildingDraft = {
  name: string;
  aliases: string[];
  summary: string;
  facts: string[];
  constraints: string[];
  relations: WorldbuildingRelation[];
  extra: Record<string, unknown>;
};

export type WorldbuildingDraftField = keyof WorldbuildingDraft;

export type WorldbuildingDraftVersion = {
  id: string;
  version: number;
  draft: WorldbuildingDraft;
  lockedFields: string[];
  createdAt: string;
};

export type WorldbuildingSession = {
  id: string;
  type: WorldbuildingType;
  title: string;
  seed: string;
  messages: WorldbuildingMessage[];
  versions: WorldbuildingDraftVersion[];
  activeVersionId: string | null;
  updatedAt: string;
};

export type WorldbookEntryCandidateConflictKind = 'none' | 'name' | 'keyword_overlap';

export type WorldbookEntryCandidateConflict = {
  kind: WorldbookEntryCandidateConflictKind;
  targetEntryName?: string;
};

export type WorldbookEntryCandidate = {
  id: string;
  category: string;
  name: string;
  keywords: string[];
  content: string;
  strategy: 'constant' | 'selective';
  checked: boolean;
  conflict?: WorldbookEntryCandidateConflict;
};

export type WorldbookCommitMode = 'append_rename' | 'keep_existing' | 'replace_existing' | 'ai_merge';

export type WorldbuildingState = {
  sessions: WorldbuildingSession[];
  activeSessionId: string | null;
  candidates: WorldbookEntryCandidate[];
  selectedWorldbookName: string | null;
  commitMode: WorldbookCommitMode;
  updatedAt: string;
};
