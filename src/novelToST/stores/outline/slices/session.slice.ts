import type {
  OutlineMessage,
  OutlineSession,
  OutlineSnapshot,
} from '../../../types/outline';
import {
  cloneOutlineSnapshot,
  cloneStoryline,
  ensureMainStoryline,
  normalizeChapter,
  normalizeDetailsRecord,
  normalizeMasterOutlineNodesForStorylines,
  normalizeOutlineMessage,
  normalizeOutlineSession,
  normalizeOutlineSnapshot,
} from '../core/outline.domain';
import { createOutlineSessionId } from '../core/outline.ids';
import { MAX_OUTLINE_SESSIONS, MAX_OUTLINE_SNAPSHOTS_PER_SESSION } from '../core/outline.constants';
import { OutlineSessionTypeSchema } from '../core/outline.schemas';
import { nextTimestamp, nextTimestampAfter } from '../core/outline.time';
import type {
  AppendOutlineMessageInput,
  AppendOutlineSnapshotInput,
  ApplyOutlineSnapshotOptions,
  CreateOutlineSessionInput,
  RemoveLastOutlineChatRoundResult,
} from '../core/outline.types';
import type { OutlineMutationContext } from './context';

export function createSessionSlice(context: OutlineMutationContext) {
  const updateSessionById = (
    sessionId: string,
    updater: (session: OutlineSession) => OutlineSession,
  ): OutlineSession | null => {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return null;
    }

    let updatedSession: OutlineSession | null = null;

    context.sessions.value = context.sessions.value.map(session => {
      if (session.id !== normalizedSessionId) {
        return session;
      }

      const nextSession = updater(session);
      if (nextSession === session) {
        return session;
      }

      updatedSession = {
        ...nextSession,
        id: session.id,
        updatedAt: nextTimestampAfter(nextSession.updatedAt),
      };

      return updatedSession;
    });

    if (!updatedSession) {
      return null;
    }

    context.touchUpdatedAt();
    return updatedSession;
  };

  const setActiveSession = (sessionId: string | null) => {
    if (sessionId === null) {
      if (context.activeSessionId.value !== null) {
        context.activeSessionId.value = null;
        context.touchUpdatedAt();
      }
      return;
    }

    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId || context.activeSessionId.value === normalizedSessionId) {
      return;
    }

    if (!context.sessions.value.some(session => session.id === normalizedSessionId)) {
      return;
    }

    context.activeSessionId.value = normalizedSessionId;
    context.touchUpdatedAt();
  };

  const createSession = (input: CreateOutlineSessionInput = {}): OutlineSession => {
    const type = OutlineSessionTypeSchema.parse(input.type ?? 'outline_chat');
    const title = input.title?.trim() || `大纲会话 ${context.sessions.value.length + 1}`;
    const seed = input.seed?.trim() || '';
    const targetChapter = input.targetChapter == null ? null : normalizeChapter(input.targetChapter, 1);

    const session = normalizeOutlineSession({
      id: createOutlineSessionId(),
      type,
      title,
      seed,
      targetChapter,
      messages: [],
      snapshots: [],
      activeSnapshotId: null,
      updatedAt: nextTimestamp(),
    });

    const nextSessions = [...context.sessions.value, session];
    context.sessions.value =
      nextSessions.length > MAX_OUTLINE_SESSIONS ? nextSessions.slice(-MAX_OUTLINE_SESSIONS) : nextSessions;
    context.activeSessionId.value = session.id;
    context.touchUpdatedAt();

    return session;
  };

  const appendMessage = (sessionId: string, input: AppendOutlineMessageInput): OutlineMessage | null => {
    let createdMessage: OutlineMessage | null = null;

    updateSessionById(sessionId, session => {
      const nextMessage = normalizeOutlineMessage({
        id: input.id,
        role: input.role,
        text: input.text,
        createdAt: input.createdAt,
        parseError: input.parseError,
        rawResponse: input.rawResponse,
        mentions: input.mentions,
        mentionSnapshots: input.mentionSnapshots,
        mentionWarnings: input.mentionWarnings,
      });

      createdMessage = nextMessage;

      return {
        ...session,
        messages: [...session.messages, nextMessage],
      };
    });

    return createdMessage;
  };

  const appendSnapshot = (sessionId: string, snapshotSeed: AppendOutlineSnapshotInput = {}): OutlineSnapshot | null => {
    let createdSnapshot: OutlineSnapshot | null = null;

    updateSessionById(sessionId, session => {
      const nextVersion = session.snapshots.reduce((maxVersion, snapshot) => Math.max(maxVersion, snapshot.version), 0) + 1;
      const nextSnapshot = {
        ...normalizeOutlineSnapshot({
          id: snapshotSeed.id,
          version: nextVersion,
          storylines: snapshotSeed.storylines ?? context.storylines.value,
          masterOutline: snapshotSeed.masterOutline ?? context.masterOutline.value,
          detailsByChapter: snapshotSeed.detailsByChapter ?? context.detailsByChapter.value,
          createdAt: snapshotSeed.createdAt,
        }),
        version: nextVersion,
      };
      const nextSnapshots = [...session.snapshots, nextSnapshot];
      const cappedSnapshots =
        nextSnapshots.length > MAX_OUTLINE_SNAPSHOTS_PER_SESSION
          ? nextSnapshots.slice(-MAX_OUTLINE_SNAPSHOTS_PER_SESSION)
          : nextSnapshots;
      createdSnapshot = nextSnapshot;

      return {
        ...session,
        snapshots: cappedSnapshots,
        activeSnapshotId: nextSnapshot.id,
      };
    });

    return createdSnapshot;
  };

  const setActiveSnapshot = (sessionId: string, snapshotId: string | null): OutlineSession | null => {
    return updateSessionById(sessionId, session => {
      if (snapshotId === null) {
        if (session.activeSnapshotId === null) {
          return session;
        }

        return {
          ...session,
          activeSnapshotId: null,
        };
      }

      const normalizedSnapshotId = snapshotId.trim();
      if (!normalizedSnapshotId || session.activeSnapshotId === normalizedSnapshotId) {
        return session;
      }

      if (!session.snapshots.some(snapshot => snapshot.id === normalizedSnapshotId)) {
        return session;
      }

      return {
        ...session,
        activeSnapshotId: normalizedSnapshotId,
      };
    });
  };

  const removeLastChatRound = (sessionId: string): RemoveLastOutlineChatRoundResult | null => {
    let removedResult: RemoveLastOutlineChatRoundResult | null = null;

    const updatedSession = updateSessionById(sessionId, session => {
      if (session.messages.length === 0) {
        removedResult = {
          removedMessages: [],
          removedSnapshot: null,
          lastUserInstruction: null,
        };
        return session;
      }

      const nextMessages = [...session.messages];
      const removedMessages: OutlineMessage[] = [];

      while (nextMessages.length > 0) {
        const lastMessage = nextMessages.at(-1);
        if (!lastMessage) {
          break;
        }

        removedMessages.unshift(lastMessage);
        nextMessages.pop();

        if (lastMessage.role === 'user') {
          break;
        }
      }

      const lastUserMessage = [...removedMessages].reverse().find(message => message.role === 'user') ?? null;
      if (!lastUserMessage) {
        removedResult = {
          removedMessages: [],
          removedSnapshot: null,
          lastUserInstruction: null,
        };
        return session;
      }

      const latestSnapshot = session.snapshots.at(-1) ?? null;
      let nextSnapshots = session.snapshots;
      let removedSnapshot: OutlineSnapshot | null = null;

      if (latestSnapshot) {
        const userMessageTimestamp = Date.parse(lastUserMessage.createdAt);
        const snapshotTimestamp = Date.parse(latestSnapshot.createdAt);

        if (Number.isFinite(userMessageTimestamp) && Number.isFinite(snapshotTimestamp) && snapshotTimestamp >= userMessageTimestamp) {
          removedSnapshot = latestSnapshot;
          nextSnapshots = session.snapshots.slice(0, -1);
        }
      }

      const nextActiveSnapshotId =
        session.activeSnapshotId !== null && nextSnapshots.some(snapshot => snapshot.id === session.activeSnapshotId)
          ? session.activeSnapshotId
          : nextSnapshots.at(-1)?.id ?? null;

      removedResult = {
        removedMessages,
        removedSnapshot: removedSnapshot ? cloneOutlineSnapshot(removedSnapshot) : null,
        lastUserInstruction: lastUserMessage.text,
      };

      return {
        ...session,
        messages: nextMessages,
        snapshots: nextSnapshots,
        activeSnapshotId: nextActiveSnapshotId,
      };
    });

    if (!updatedSession && !removedResult) {
      return null;
    }

    return (
      removedResult ?? {
        removedMessages: [],
        removedSnapshot: null,
        lastUserInstruction: null,
      }
    );
  };

  const applySnapshot = (
    sessionId: string,
    snapshotId: string,
    options: ApplyOutlineSnapshotOptions = {},
  ): OutlineSnapshot | null => {
    const normalizedSessionId = sessionId.trim();
    const normalizedSnapshotId = snapshotId.trim();
    if (!normalizedSessionId || !normalizedSnapshotId) {
      return null;
    }

    const targetSession = context.sessions.value.find(session => session.id === normalizedSessionId);
    if (!targetSession) {
      return null;
    }

    const targetSnapshot = targetSession.snapshots.find(snapshot => snapshot.id === normalizedSnapshotId);
    if (!targetSnapshot) {
      return null;
    }

    const applyDetails = options.applyDetails === true;

    // ── 按锁状态合并故事线 ──
    const lockedStorylineSet = new Set(context.lockedStorylineIds.value);
    const currentStorylineMap = new Map(context.storylines.value.map(s => [s.id, s]));

    const mergedStorylines: typeof targetSnapshot.storylines = targetSnapshot.storylines.map(snapshotStoryline => {
      if (lockedStorylineSet.has(snapshotStoryline.id) && currentStorylineMap.has(snapshotStoryline.id)) {
        return cloneStoryline(currentStorylineMap.get(snapshotStoryline.id)!);
      }
      return cloneStoryline(snapshotStoryline);
    });

    // 追加当前已锁定但草案中不存在的故事线
    const snapshotStorylineIds = new Set(targetSnapshot.storylines.map(s => s.id));
    for (const currentStoryline of context.storylines.value) {
      if (lockedStorylineSet.has(currentStoryline.id) && !snapshotStorylineIds.has(currentStoryline.id)) {
        mergedStorylines.push(cloneStoryline(currentStoryline));
      }
    }

    const nextStorylines = ensureMainStoryline(mergedStorylines);

    // ── 按锁状态合并主大纲节点 ──
    const lockedNodeSet = new Set(context.lockedNodeIds.value);
    const currentNodeMap = new Map(context.masterOutline.value.map(n => [n.id, n]));

    const mergedNodes: typeof targetSnapshot.masterOutline = targetSnapshot.masterOutline.map(snapshotNode => {
      if (lockedNodeSet.has(snapshotNode.id) && currentNodeMap.has(snapshotNode.id)) {
        return { ...currentNodeMap.get(snapshotNode.id)! };
      }
      return { ...snapshotNode };
    });

    // 追加当前已锁定但草案中不存在的节点
    const snapshotNodeIds = new Set(targetSnapshot.masterOutline.map(n => n.id));
    for (const currentNode of context.masterOutline.value) {
      if (lockedNodeSet.has(currentNode.id) && !snapshotNodeIds.has(currentNode.id)) {
        mergedNodes.push({ ...currentNode });
      }
    }

    context.storylines.value = nextStorylines;
    context.masterOutline.value = normalizeMasterOutlineNodesForStorylines(mergedNodes, nextStorylines);

    if (applyDetails) {
      context.detailsByChapter.value = normalizeDetailsRecord(targetSnapshot.detailsByChapter);
    }
    context.sessions.value = context.sessions.value.map(session => {
      if (session.id !== normalizedSessionId) {
        return session;
      }

      return {
        ...session,
        activeSnapshotId: normalizedSnapshotId,
        appliedSnapshotId: normalizedSnapshotId,
        updatedAt: nextTimestampAfter(session.updatedAt),
      };
    });

    context.activeSessionId.value = normalizedSessionId;
    context.touchUpdatedAt();

    return cloneOutlineSnapshot(targetSnapshot);
  };

  return {
    setActiveSession,
    createSession,
    appendMessage,
    appendSnapshot,
    setActiveSnapshot,
    removeLastChatRound,
    applySnapshot,
  };
}
