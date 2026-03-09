import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { z } from 'zod';
import type {
  WorldbookCommitMode,
  WorldbookEntryCandidate,
  WorldbookEntryCandidateConflict,
  WorldbuildingDraft,
  WorldbuildingDraftVersion,
  WorldbuildingMessage,
  WorldbuildingMessageRole,
  WorldbuildingRelation,
  WorldbuildingSession,
  WorldbuildingState,
  WorldbuildingType,
} from '../types/worldbuilding';

const WorldbuildingTypeSchema = z.enum([
  'character',
  'faction',
  'location',
  'system',
  'history_placeholder',
  'item_placeholder',
  'culture_placeholder',
  'custom_placeholder',
]);

const WorldbuildingMessageRoleSchema = z.enum(['user', 'assistant', 'system']);

const WorldbuildingRelationSchema = z
  .object({
    target: z.string().default(''),
    relation: z.string().default(''),
  })
  .prefault({});

const WorldbuildingDraftSchema = z
  .object({
    name: z.string().default(''),
    aliases: z.array(z.string()).default([]),
    summary: z.string().default(''),
    facts: z.array(z.string()).default([]),
    constraints: z.array(z.string()).default([]),
    relations: z.array(WorldbuildingRelationSchema).default([]),
    extra: z.record(z.string(), z.unknown()).default({}),
  })
  .prefault({});

const WorldbuildingMessageSchema = z
  .object({
    id: z.string().default(''),
    role: WorldbuildingMessageRoleSchema.default('user'),
    text: z.string().default(''),
    createdAt: z.string().default(''),
  })
  .prefault({});

const WorldbuildingDraftVersionSchema = z
  .object({
    id: z.string().default(''),
    version: z.number().int().min(1).default(1),
    draft: WorldbuildingDraftSchema,
    lockedFields: z.array(z.string()).default([]),
    createdAt: z.string().default(''),
  })
  .prefault({});

const WorldbuildingSessionSchema = z
  .object({
    id: z.string().default(''),
    type: WorldbuildingTypeSchema.default('character'),
    title: z.string().default(''),
    seed: z.string().default(''),
    messages: z.array(WorldbuildingMessageSchema).default([]),
    versions: z.array(WorldbuildingDraftVersionSchema).default([]),
    activeVersionId: z.string().nullable().default(null),
    updatedAt: z.string().default(''),
  })
  .prefault({});

const WorldbookEntryCandidateConflictSchema = z
  .object({
    kind: z.enum(['none', 'name', 'keyword_overlap']).default('none'),
    targetEntryName: z.string().optional(),
  })
  .prefault({});

const WorldbookEntryCandidateSchema = z
  .object({
    id: z.string().default(''),
    category: z.string().default(''),
    name: z.string().default(''),
    keywords: z.array(z.string()).default([]),
    content: z.string().default(''),
    strategy: z.enum(['constant', 'selective']).default('constant'),
    checked: z.boolean().default(true),
    conflict: WorldbookEntryCandidateConflictSchema.optional(),
  })
  .prefault({});

const WorldbookCommitModeSchema = z.enum(['append_rename', 'keep_existing', 'replace_existing', 'ai_merge']);

const WorldbuildingStateSchema = z
  .object({
    sessions: z.array(WorldbuildingSessionSchema).default([]),
    activeSessionId: z.string().nullable().default(null),
    candidates: z.array(WorldbookEntryCandidateSchema).default([]),
    selectedWorldbookName: z.string().nullable().default(null),
    commitMode: WorldbookCommitModeSchema.default('append_rename'),
    updatedAt: z.string().default(''),
  })
  .prefault({});

export type CreateWorldbuildingSessionInput = {
  type?: WorldbuildingType;
  title?: string;
  seed?: string;
};

export type PatchWorldbuildingSessionInput = Partial<Pick<WorldbuildingSession, 'type' | 'title' | 'seed'>>;

export type AppendWorldbuildingMessageInput = {
  id?: string;
  role: WorldbuildingMessageRole;
  text: string;
  createdAt?: string;
};

export type AppendWorldbuildingDraftVersionInput = {
  id?: string;
  draft: WorldbuildingDraft;
  lockedFields?: string[];
  createdAt?: string;
  activate?: boolean;
};

let sessionCounter = 0;
let messageCounter = 0;
let versionCounter = 0;
let candidateCounter = 0;

function nextTimestamp(): string {
  return new Date().toISOString();
}

function nextTimestampAfter(previous: string | null | undefined): string {
  const previousMs = typeof previous === 'string' ? Date.parse(previous) : Number.NaN;
  const nowMs = Date.now();
  const nextMs = Number.isFinite(previousMs) && nowMs <= previousMs ? previousMs + 1 : nowMs;

  return new Date(nextMs).toISOString();
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string') {
    return nextTimestamp();
  }

  const normalized = value.trim();
  return normalized || nextTimestamp();
}

function createSessionId(): string {
  sessionCounter += 1;
  return `worldbuilding-session-${Date.now()}-${sessionCounter}`;
}

function createMessageId(): string {
  messageCounter += 1;
  return `worldbuilding-message-${Date.now()}-${messageCounter}`;
}

function createDraftVersionId(): string {
  versionCounter += 1;
  return `worldbuilding-version-${Date.now()}-${versionCounter}`;
}

function createCandidateId(): string {
  candidateCounter += 1;
  return `worldbuilding-candidate-${Date.now()}-${candidateCounter}`;
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const deduped = new Set<string>();
  values.forEach(value => {
    if (typeof value !== 'string') {
      return;
    }

    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  });

  return [...deduped];
}

function normalizeExtraRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const result: Record<string, unknown> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return;
    }

    result[normalizedKey] = value;
  });

  return result;
}

function normalizeRelation(raw: unknown): WorldbuildingRelation {
  const parsed = WorldbuildingRelationSchema.parse(raw);

  return {
    target: parsed.target.trim(),
    relation: parsed.relation.trim(),
  };
}

function normalizeRelations(raw: unknown): WorldbuildingRelation[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map(relation => normalizeRelation(relation))
    .filter(relation => relation.target.length > 0 || relation.relation.length > 0);
}

function createEmptyWorldbuildingDraft(seed: string = ''): WorldbuildingDraft {
  return {
    name: '',
    aliases: [],
    summary: seed,
    facts: [],
    constraints: [],
    relations: [],
    extra: {},
  };
}

function normalizeDraft(raw: unknown): WorldbuildingDraft {
  const parsed = WorldbuildingDraftSchema.parse(raw);

  return {
    name: parsed.name.trim(),
    aliases: normalizeStringList(parsed.aliases),
    summary: parsed.summary.trim(),
    facts: normalizeStringList(parsed.facts),
    constraints: normalizeStringList(parsed.constraints),
    relations: normalizeRelations(parsed.relations),
    extra: normalizeExtraRecord(parsed.extra),
  };
}

function cloneDraft(draft: WorldbuildingDraft): WorldbuildingDraft {
  return {
    name: draft.name,
    aliases: [...draft.aliases],
    summary: draft.summary,
    facts: [...draft.facts],
    constraints: [...draft.constraints],
    relations: draft.relations.map(relation => ({
      target: relation.target,
      relation: relation.relation,
    })),
    extra: { ...draft.extra },
  };
}

function createInitialDraftVersion(seed: string = ''): WorldbuildingDraftVersion {
  return {
    id: createDraftVersionId(),
    version: 1,
    draft: createEmptyWorldbuildingDraft(seed.trim()),
    lockedFields: [],
    createdAt: nextTimestamp(),
  };
}

function normalizeDraftVersion(raw: unknown): WorldbuildingDraftVersion {
  const parsed = WorldbuildingDraftVersionSchema.parse(raw);

  return {
    id: parsed.id.trim() || createDraftVersionId(),
    version: Math.max(1, Math.trunc(parsed.version)),
    draft: normalizeDraft(parsed.draft),
    lockedFields: normalizeStringList(parsed.lockedFields),
    createdAt: normalizeTimestamp(parsed.createdAt),
  };
}

function cloneDraftVersion(version: WorldbuildingDraftVersion): WorldbuildingDraftVersion {
  return {
    id: version.id,
    version: version.version,
    draft: cloneDraft(version.draft),
    lockedFields: [...version.lockedFields],
    createdAt: version.createdAt,
  };
}

function normalizeMessage(raw: unknown): WorldbuildingMessage {
  const parsed = WorldbuildingMessageSchema.parse(raw);

  return {
    id: parsed.id.trim() || createMessageId(),
    role: parsed.role,
    text: parsed.text.trim(),
    createdAt: normalizeTimestamp(parsed.createdAt),
  };
}

function cloneMessage(message: WorldbuildingMessage): WorldbuildingMessage {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    createdAt: message.createdAt,
  };
}

function normalizeWorldbuildingName(name: unknown): string | null {
  if (typeof name !== 'string') {
    return null;
  }

  const normalized = name.trim();
  return normalized || null;
}

function normalizeCandidateConflict(raw: unknown): WorldbookEntryCandidateConflict {
  const parsed = WorldbookEntryCandidateConflictSchema.parse(raw);

  if (parsed.kind === 'none') {
    return { kind: 'none' };
  }

  const targetEntryName = parsed.targetEntryName?.trim();

  if (!targetEntryName) {
    return { kind: parsed.kind };
  }

  return {
    kind: parsed.kind,
    targetEntryName,
  };
}

function normalizeCandidate(raw: unknown): WorldbookEntryCandidate {
  const parsed = WorldbookEntryCandidateSchema.parse(raw);

  return {
    id: parsed.id.trim() || createCandidateId(),
    category: parsed.category.trim(),
    name: parsed.name.trim(),
    keywords: normalizeStringList(parsed.keywords),
    content: parsed.content.trim(),
    strategy: parsed.strategy,
    checked: Boolean(parsed.checked),
    conflict: parsed.conflict ? normalizeCandidateConflict(parsed.conflict) : undefined,
  };
}

function cloneCandidate(candidate: WorldbookEntryCandidate): WorldbookEntryCandidate {
  return {
    id: candidate.id,
    category: candidate.category,
    name: candidate.name,
    keywords: [...candidate.keywords],
    content: candidate.content,
    strategy: candidate.strategy,
    checked: candidate.checked,
    conflict: candidate.conflict ? { ...candidate.conflict } : undefined,
  };
}

function normalizeSession(raw: unknown): WorldbuildingSession {
  const parsed = WorldbuildingSessionSchema.parse(raw);

  const normalizedVersions = parsed.versions
    .map(version => normalizeDraftVersion(version))
    .sort((left, right) => left.version - right.version);

  const dedupedVersions: WorldbuildingDraftVersion[] = [];
  const versionIds = new Set<string>();

  normalizedVersions.forEach(version => {
    let normalizedVersion = version;

    if (versionIds.has(normalizedVersion.id)) {
      normalizedVersion = {
        ...normalizedVersion,
        id: createDraftVersionId(),
      };
    }

    versionIds.add(normalizedVersion.id);
    dedupedVersions.push(normalizedVersion);
  });

  if (dedupedVersions.length === 0) {
    dedupedVersions.push(createInitialDraftVersion(parsed.seed));
  }

  const requestedActiveVersionId = parsed.activeVersionId?.trim() || null;
  const activeVersionId =
    requestedActiveVersionId && dedupedVersions.some(version => version.id === requestedActiveVersionId)
      ? requestedActiveVersionId
      : (dedupedVersions.at(-1)?.id ?? null);

  return {
    id: parsed.id.trim() || createSessionId(),
    type: parsed.type,
    title: parsed.title.trim(),
    seed: parsed.seed.trim(),
    messages: parsed.messages.map(message => normalizeMessage(message)),
    versions: dedupedVersions,
    activeVersionId,
    updatedAt: normalizeTimestamp(parsed.updatedAt),
  };
}

function cloneSession(session: WorldbuildingSession): WorldbuildingSession {
  return {
    id: session.id,
    type: session.type,
    title: session.title,
    seed: session.seed,
    messages: session.messages.map(cloneMessage),
    versions: session.versions.map(cloneDraftVersion),
    activeVersionId: session.activeVersionId,
    updatedAt: session.updatedAt,
  };
}

function createDefaultWorldbuildingState(): WorldbuildingState {
  return {
    sessions: [],
    activeSessionId: null,
    candidates: [],
    selectedWorldbookName: null,
    commitMode: 'append_rename',
    updatedAt: nextTimestamp(),
  };
}

function normalizeWorldbuildingState(raw: unknown): WorldbuildingState {
  const parsed = WorldbuildingStateSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn('[novelToST][worldbuilding] 世界设定状态解析失败，回退默认结构', parsed.error);
    return createDefaultWorldbuildingState();
  }

  const normalizedSessions: WorldbuildingSession[] = [];
  const sessionIds = new Set<string>();

  parsed.data.sessions.forEach(session => {
    let normalizedSession = normalizeSession(session);

    if (sessionIds.has(normalizedSession.id)) {
      normalizedSession = {
        ...normalizedSession,
        id: createSessionId(),
      };
    }

    sessionIds.add(normalizedSession.id);
    normalizedSessions.push(normalizedSession);
  });

  const requestedSessionId = parsed.data.activeSessionId?.trim() || null;
  const activeSessionId =
    requestedSessionId && normalizedSessions.some(session => session.id === requestedSessionId)
      ? requestedSessionId
      : (normalizedSessions[0]?.id ?? null);

  return {
    sessions: normalizedSessions,
    activeSessionId,
    candidates: parsed.data.candidates.map(candidate => normalizeCandidate(candidate)),
    selectedWorldbookName: normalizeWorldbuildingName(parsed.data.selectedWorldbookName),
    commitMode: parsed.data.commitMode,
    updatedAt: normalizeTimestamp(parsed.data.updatedAt),
  };
}

function resolveVersionId(session: WorldbuildingSession, versionId: string | null | undefined): string | null {
  const requestedVersionId = versionId?.trim();
  if (requestedVersionId && session.versions.some(version => version.id === requestedVersionId)) {
    return requestedVersionId;
  }

  if (session.activeVersionId && session.versions.some(version => version.id === session.activeVersionId)) {
    return session.activeVersionId;
  }

  return session.versions.at(-1)?.id ?? null;
}

function areStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export const useWorldbuildingStore = defineStore('novelToST/worldbuilding', () => {
  const defaultState = createDefaultWorldbuildingState();

  const sessions = ref<WorldbuildingSession[]>(defaultState.sessions.map(cloneSession));
  const activeSessionId = ref<string | null>(defaultState.activeSessionId);
  const candidates = ref<WorldbookEntryCandidate[]>(defaultState.candidates.map(cloneCandidate));
  const selectedWorldbookName = ref<string | null>(defaultState.selectedWorldbookName);
  const commitMode = ref<WorldbookCommitMode>(defaultState.commitMode);
  const updatedAt = ref(defaultState.updatedAt);

  const sessionCount = computed(() => sessions.value.length);

  const activeSession = computed<WorldbuildingSession | null>(
    () => sessions.value.find(session => session.id === activeSessionId.value) ?? null,
  );

  const activeVersion = computed<WorldbuildingDraftVersion | null>(() => {
    const session = activeSession.value;
    if (!session) {
      return null;
    }

    const targetVersionId = resolveVersionId(session, session.activeVersionId);
    if (!targetVersionId) {
      return null;
    }

    return session.versions.find(version => version.id === targetVersionId) ?? null;
  });

  const checkedCandidateCount = computed(() => candidates.value.filter(candidate => candidate.checked).length);

  const touchUpdatedAt = () => {
    updatedAt.value = nextTimestampAfter(updatedAt.value);
  };

  const updateSessionById = (
    sessionId: string,
    updater: (session: WorldbuildingSession) => WorldbuildingSession,
  ): WorldbuildingSession | null => {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return null;
    }

    let updatedSession: WorldbuildingSession | null = null;

    sessions.value = sessions.value.map(session => {
      if (session.id !== normalizedSessionId) {
        return session;
      }

      const nextSession = updater(session);
      if (nextSession === session) {
        return session;
      }

      updatedSession = {
        ...nextSession,
        updatedAt: nextTimestampAfter(nextSession.updatedAt),
      };

      return updatedSession;
    });

    if (!updatedSession) {
      return null;
    }

    touchUpdatedAt();
    return updatedSession;
  };

  const setActiveSession = (sessionId: string | null) => {
    if (sessionId === null) {
      if (activeSessionId.value !== null) {
        activeSessionId.value = null;
        touchUpdatedAt();
      }
      return;
    }

    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return;
    }

    if (!sessions.value.some(session => session.id === normalizedSessionId)) {
      return;
    }

    if (activeSessionId.value === normalizedSessionId) {
      return;
    }

    activeSessionId.value = normalizedSessionId;
    touchUpdatedAt();
  };

  const createSession = (input: CreateWorldbuildingSessionInput = {}): WorldbuildingSession => {
    const type = WorldbuildingTypeSchema.parse(input.type ?? 'character');
    const title = input.title?.trim() || `设定会话 ${sessions.value.length + 1}`;
    const seed = input.seed?.trim() || '';

    const initialVersion = createInitialDraftVersion(seed);

    const session: WorldbuildingSession = {
      id: createSessionId(),
      type,
      title,
      seed,
      messages: [],
      versions: [initialVersion],
      activeVersionId: initialVersion.id,
      updatedAt: nextTimestampAfter(null),
    };

    sessions.value = [...sessions.value, session];
    activeSessionId.value = session.id;
    touchUpdatedAt();

    return session;
  };

  const patchSession = (sessionId: string, patch: PatchWorldbuildingSessionInput): WorldbuildingSession | null => {
    return updateSessionById(sessionId, session => {
      const nextType = patch.type !== undefined ? WorldbuildingTypeSchema.parse(patch.type) : session.type;
      const nextTitle = patch.title !== undefined ? patch.title.trim() : session.title;
      const nextSeed = patch.seed !== undefined ? patch.seed.trim() : session.seed;

      if (nextType === session.type && nextTitle === session.title && nextSeed === session.seed) {
        return session;
      }

      return {
        ...session,
        type: nextType,
        title: nextTitle,
        seed: nextSeed,
      };
    });
  };

  const removeSession = (sessionId: string): void => {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId || !sessions.value.some(session => session.id === normalizedSessionId)) {
      return;
    }

    sessions.value = sessions.value.filter(session => session.id !== normalizedSessionId);

    if (activeSessionId.value === normalizedSessionId) {
      activeSessionId.value = sessions.value[0]?.id ?? null;
    }

    touchUpdatedAt();
  };

  const appendMessage = (sessionId: string, input: AppendWorldbuildingMessageInput): WorldbuildingMessage | null => {
    let createdMessage: WorldbuildingMessage | null = null;

    updateSessionById(sessionId, session => {
      createdMessage = normalizeMessage({
        id: input.id,
        role: input.role,
        text: input.text,
        createdAt: input.createdAt,
      });

      return {
        ...session,
        messages: [...session.messages, createdMessage],
      };
    });

    return createdMessage;
  };

  const replaceMessages = (sessionId: string, messages: WorldbuildingMessage[]): WorldbuildingSession | null => {
    return updateSessionById(sessionId, session => {
      const normalizedMessages = messages.map(message => normalizeMessage(message));
      return {
        ...session,
        messages: normalizedMessages,
      };
    });
  };

  const clearMessages = (sessionId: string): WorldbuildingSession | null => {
    return updateSessionById(sessionId, session => {
      if (session.messages.length === 0) {
        return session;
      }

      return {
        ...session,
        messages: [],
      };
    });
  };

  const getLastRoundUserInstruction = (sessionId: string): string | null => {
    const session = sessions.value.find(s => s.id === sessionId);
    if (!session) {
      return null;
    }

    const msgs = session.messages;
    let assistantIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        assistantIdx = i;
        break;
      }
    }

    if (assistantIdx < 0) {
      return null;
    }

    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        return msgs[i].text;
      }
    }

    return null;
  };

  const deleteLastRound = (sessionId: string): void => {
    updateSessionById(sessionId, session => {
      const msgs = session.messages;
      const indicesToRemove = new Set<number>();

      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          indicesToRemove.add(i);
          for (let j = i - 1; j >= 0; j--) {
            if (msgs[j].role === 'user') {
              indicesToRemove.add(j);
              break;
            }
          }
          break;
        }
      }

      if (indicesToRemove.size === 0) {
        return session;
      }

      return {
        ...session,
        messages: msgs.filter((_, idx) => !indicesToRemove.has(idx)),
      };
    });
  };

  const appendDraftVersion = (
    sessionId: string,
    input: AppendWorldbuildingDraftVersionInput,
  ): WorldbuildingDraftVersion | null => {
    let createdVersion: WorldbuildingDraftVersion | null = null;

    updateSessionById(sessionId, session => {
      const nextVersionNumber =
        session.versions.reduce((maxVersionNumber, version) => Math.max(maxVersionNumber, version.version), 0) + 1;

      createdVersion = normalizeDraftVersion({
        id: input.id,
        version: nextVersionNumber,
        draft: input.draft,
        lockedFields: input.lockedFields,
        createdAt: input.createdAt,
      });

      return {
        ...session,
        versions: [...session.versions, createdVersion],
        activeVersionId: input.activate === false ? session.activeVersionId : createdVersion.id,
      };
    });

    return createdVersion;
  };

  const setActiveVersion = (sessionId: string, versionId: string): WorldbuildingSession | null => {
    const normalizedVersionId = versionId.trim();

    return updateSessionById(sessionId, session => {
      if (!normalizedVersionId || !session.versions.some(version => version.id === normalizedVersionId)) {
        return session;
      }

      if (session.activeVersionId === normalizedVersionId) {
        return session;
      }

      return {
        ...session,
        activeVersionId: normalizedVersionId,
      };
    });
  };

  const removeDraftVersion = (sessionId: string, versionId: string): WorldbuildingSession | null => {
    const normalizedVersionId = versionId.trim();

    return updateSessionById(sessionId, session => {
      if (!normalizedVersionId || !session.versions.some(version => version.id === normalizedVersionId)) {
        return session;
      }

      let nextVersions = session.versions.filter(version => version.id !== normalizedVersionId);
      if (nextVersions.length === 0) {
        nextVersions = [createInitialDraftVersion(session.seed)];
      }

      let nextActiveVersionId = session.activeVersionId;
      if (!nextActiveVersionId || !nextVersions.some(version => version.id === nextActiveVersionId)) {
        nextActiveVersionId = nextVersions.at(-1)?.id ?? null;
      }

      return {
        ...session,
        versions: nextVersions,
        activeVersionId: nextActiveVersionId,
      };
    });
  };

  const setLockedFields = (
    sessionId: string,
    lockedFields: string[],
    versionId?: string | null,
  ): WorldbuildingDraftVersion | null => {
    const normalizedLockedFields = normalizeStringList(lockedFields);

    let updatedVersion: WorldbuildingDraftVersion | null = null;

    updateSessionById(sessionId, session => {
      const targetVersionId = resolveVersionId(session, versionId);
      if (!targetVersionId) {
        return session;
      }

      const nextVersions = session.versions.map(version => {
        if (version.id !== targetVersionId) {
          return version;
        }

        if (areStringArraysEqual(version.lockedFields, normalizedLockedFields)) {
          updatedVersion = version;
          return version;
        }

        const nextVersion = {
          ...version,
          lockedFields: [...normalizedLockedFields],
        };

        updatedVersion = nextVersion;
        return nextVersion;
      });

      if (!updatedVersion || nextVersions.every((version, index) => version === session.versions[index])) {
        return session;
      }

      return {
        ...session,
        versions: nextVersions,
      };
    });

    return updatedVersion;
  };

  const toggleLockedField = (
    sessionId: string,
    field: string,
    versionId?: string | null,
  ): WorldbuildingDraftVersion | null => {
    const normalizedField = field.trim();
    if (!normalizedField) {
      return null;
    }

    const session = sessions.value.find(item => item.id === sessionId.trim());
    if (!session) {
      return null;
    }

    const targetVersionId = resolveVersionId(session, versionId);
    const targetVersion = session.versions.find(version => version.id === targetVersionId);
    if (!targetVersion) {
      return null;
    }

    const nextLockedFields = targetVersion.lockedFields.includes(normalizedField)
      ? targetVersion.lockedFields.filter(item => item !== normalizedField)
      : [...targetVersion.lockedFields, normalizedField];

    return setLockedFields(session.id, nextLockedFields, targetVersion.id);
  };

  const setCandidates = (nextCandidates: WorldbookEntryCandidate[]) => {
    candidates.value = nextCandidates.map(candidate => normalizeCandidate(candidate));
    touchUpdatedAt();
  };

  const setCandidateChecked = (candidateId: string, checked: boolean): WorldbookEntryCandidate | null => {
    const normalizedCandidateId = candidateId.trim();
    if (!normalizedCandidateId) {
      return null;
    }

    const candidateIndex = candidates.value.findIndex(candidate => candidate.id === normalizedCandidateId);
    if (candidateIndex < 0) {
      return null;
    }

    const currentCandidate = candidates.value[candidateIndex];
    if (currentCandidate.checked === checked) {
      return currentCandidate;
    }

    const updatedCandidate: WorldbookEntryCandidate = {
      ...currentCandidate,
      checked,
    };

    candidates.value = candidates.value.map((candidate, index) => (index === candidateIndex ? updatedCandidate : candidate));

    touchUpdatedAt();
    return updatedCandidate;
  };

  const patchCandidate = (candidateId: string, patch: Partial<WorldbookEntryCandidate>): WorldbookEntryCandidate | null => {
    const normalizedCandidateId = candidateId.trim();
    if (!normalizedCandidateId) {
      return null;
    }

    const candidateIndex = candidates.value.findIndex(candidate => candidate.id === normalizedCandidateId);
    if (candidateIndex < 0) {
      return null;
    }

    const currentCandidate = candidates.value[candidateIndex];
    const updatedCandidate = normalizeCandidate({
      ...currentCandidate,
      ...patch,
      id: currentCandidate.id,
    });

    candidates.value = candidates.value.map((candidate, index) => (index === candidateIndex ? updatedCandidate : candidate));

    touchUpdatedAt();
    return updatedCandidate;
  };

  const removeCandidate = (candidateId: string): void => {
    const normalizedCandidateId = candidateId.trim();
    if (!normalizedCandidateId || !candidates.value.some(candidate => candidate.id === normalizedCandidateId)) {
      return;
    }

    candidates.value = candidates.value.filter(candidate => candidate.id !== normalizedCandidateId);
    touchUpdatedAt();
  };

  const clearCandidates = (): void => {
    if (candidates.value.length === 0) {
      return;
    }

    candidates.value = [];
    touchUpdatedAt();
  };

  const setSelectedWorldbookName = (name: string | null): void => {
    const normalizedName = normalizeWorldbuildingName(name);
    if (selectedWorldbookName.value === normalizedName) {
      return;
    }

    selectedWorldbookName.value = normalizedName;
    touchUpdatedAt();
  };

  const setCommitMode = (mode: WorldbookCommitMode): void => {
    const normalizedMode = WorldbookCommitModeSchema.parse(mode);
    if (commitMode.value === normalizedMode) {
      return;
    }

    commitMode.value = normalizedMode;
    touchUpdatedAt();
  };

  const toStateSnapshot = (): WorldbuildingState => {
    return {
      sessions: sessions.value.map(cloneSession),
      activeSessionId: activeSessionId.value,
      candidates: candidates.value.map(cloneCandidate),
      selectedWorldbookName: selectedWorldbookName.value,
      commitMode: commitMode.value,
      updatedAt: updatedAt.value,
    };
  };

  const hydrate = (rawState: unknown): void => {
    const normalizedState = normalizeWorldbuildingState(rawState);

    sessions.value = normalizedState.sessions.map(cloneSession);
    activeSessionId.value = normalizedState.activeSessionId;
    candidates.value = normalizedState.candidates.map(cloneCandidate);
    selectedWorldbookName.value = normalizedState.selectedWorldbookName;
    commitMode.value = normalizedState.commitMode;
    updatedAt.value = normalizedState.updatedAt;
  };

  const reset = (): void => {
    const nextState = createDefaultWorldbuildingState();

    sessions.value = nextState.sessions;
    activeSessionId.value = nextState.activeSessionId;
    candidates.value = nextState.candidates;
    selectedWorldbookName.value = nextState.selectedWorldbookName;
    commitMode.value = nextState.commitMode;
    updatedAt.value = nextState.updatedAt;
  };

  return {
    sessions,
    activeSessionId,
    candidates,
    selectedWorldbookName,
    commitMode,
    updatedAt,

    sessionCount,
    activeSession,
    activeVersion,
    checkedCandidateCount,

    createEmptyDraft: createEmptyWorldbuildingDraft,
    touchUpdatedAt,
    setActiveSession,
    createSession,
    patchSession,
    removeSession,
    appendMessage,
    replaceMessages,
    clearMessages,
    getLastRoundUserInstruction,
    deleteLastRound,
    appendDraftVersion,
    setActiveVersion,
    removeDraftVersion,
    setLockedFields,
    toggleLockedField,
    setCandidates,
    setCandidateChecked,
    patchCandidate,
    removeCandidate,
    clearCandidates,
    setSelectedWorldbookName,
    setCommitMode,
    toStateSnapshot,
    hydrate,
    reset,
  };
});
