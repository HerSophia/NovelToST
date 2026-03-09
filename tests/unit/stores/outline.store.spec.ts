import { useOutlineStore } from '@/novelToST/stores/outline.store';
import {
  MAX_OUTLINE_SESSIONS,
  MAX_OUTLINE_SNAPSHOTS_PER_SESSION,
} from '@/novelToST/stores/outline/core/outline.constants';

describe('outline.store', () => {
  it('should initialize with v2 default outline state', () => {
    const store = useOutlineStore();

    expect(store.enabled).toBe(false);
    expect(store.missingDetailPolicy).toBe('warn_fallback');

    expect(store.storylines.length).toBeGreaterThanOrEqual(1);
    expect(store.storylines[0]?.type).toBe('main');

    expect(store.sessions).toEqual([]);
    expect(store.activeSessionId).toBeNull();

    const detail = store.ensureChapterDetail(1);
    expect(detail.relatedNodeIds).toEqual([]);
    expect(detail.pov).toBe('');
    expect(detail.narrativeTime).toBeNull();
    expect(detail.emotionalArc).toBe('');
    expect(detail.endHook).toBe('');
    expect(detail.notes).toBe('');
    expect(detail.extra).toEqual({});

    expect(store.masterOutline).toEqual([]);
    expect(store.detailChapters).toEqual([1]);
    expect(store.ai.enabled).toBe(true);
    expect(store.mentionConfig.worldbookEntryLabel.includeWorldbookName).toBe(true);
    expect(store.mentionConfig.worldbookEntryLabel.includeTriggerKeywords).toBe(false);
    expect(store.mentionConfig.worldbookEntryLabel.includeStrategyType).toBe(false);
  });

  it('should hydrate legacy v1 payload and fill v2 defaults', () => {
    const store = useOutlineStore();

    const legacySetup = {
      title: '  赛博长篇  ',
      characters: ['阿离', '  ', '洛琪'],
      worldRules: ['规则一'],
    };

    store.hydrate({
      enabled: true,
      missingDetailPolicy: 'strict_block',
      setup: legacySetup,
      masterOutline: [
        {
          id: '',
          title: ' 开端 ',
          summary: ' 进入主线 ',
          chapterStart: 1,
          chapterEnd: 5,
          turningPoints: ['转折A', ''],
          status: 'approved',
        },
      ],
      detailsByChapter: {
        '3': {
          chapter: 3,
          parentNodeId: '',
          title: ' 交锋 ',
          goal: '推进关系',
          conflict: '误会',
          beats: ['节拍1', ''],
          mustInclude: [],
          mustAvoid: ['跑题'],
          status: 'draft',
        },
      },
      ai: {
        enabled: false,
        provider: 'custom',
        model: ' test-model ',
        temperature: 0.92,
      },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(store.enabled).toBe(true);
    expect(store.missingDetailPolicy).toBe('strict_block');
    expect(store.toStateSnapshot()).not.toHaveProperty('setup');

    expect(store.storylines.length).toBeGreaterThanOrEqual(1);
    const mainStorylineId = store.storylines[0]?.id ?? '';

    const node = store.masterOutline[0];
    expect(node?.id.length).toBeGreaterThan(0);
    expect(node?.title).toBe('开端');
    expect(node?.turningPoints).toEqual(['转折A']);
    expect(node?.storylineId).toBe(mainStorylineId);
    expect(node?.phase).toBe('custom');
    expect(node?.events?.map(event => event.description)).toEqual(['转折A']);
    expect(node?.keywords).toEqual([]);

    const detail = store.getChapterDetail(3);
    expect(detail?.title).toBe('交锋');
    expect(detail?.relatedNodeIds).toEqual([]);
    expect(detail?.pov).toBe('');
    expect(detail?.narrativeTime).toBeNull();
    expect(detail?.emotionalArc).toBe('');
    expect(detail?.endHook).toBe('');
    expect(detail?.notes).toBe('');
    expect(detail?.extra).toEqual({});

    expect(store.sessions).toEqual([]);
    expect(store.activeSessionId).toBeNull();
    expect(store.ai.provider).toBe('custom');
    expect(store.ai.model).toBe('test-model');
    expect(store.mentionConfig.worldbookEntryLabel.includeWorldbookName).toBe(true);
    expect(store.mentionConfig.worldbookEntryLabel.includeTriggerKeywords).toBe(false);
    expect(store.mentionConfig.worldbookEntryLabel.includeStrategyType).toBe(false);
  });

  it('should patch mention config and keep it in state snapshot roundtrip', () => {
    const store = useOutlineStore();

    store.patchMentionConfig({
      worldbookEntryLabel: {
        includeWorldbookName: false,
        includeTriggerKeywords: true,
        includeStrategyType: true,
      },
    });

    expect(store.mentionConfig.worldbookEntryLabel).toEqual({
      includeWorldbookName: false,
      includeTriggerKeywords: true,
      includeStrategyType: true,
    });

    const snapshot = store.toStateSnapshot();
    store.reset();
    store.hydrate(snapshot);

    expect(store.mentionConfig.worldbookEntryLabel).toEqual({
      includeWorldbookName: false,
      includeTriggerKeywords: true,
      includeStrategyType: true,
    });
  });

  it('should support master outline CRUD and clear weak links when deleting node', () => {
    const store = useOutlineStore();

    const node = store.appendMasterOutlineNode({
      title: '第一幕',
      chapterStart: 1,
      chapterEnd: 4,
    });

    store.patchMasterOutlineNode(node.id, {
      chapterEnd: 6,
      summary: '第一幕扩展',
    });

    store.patchChapterDetail(2, {
      title: '第二章',
      parentNodeId: node.id,
      relatedNodeIds: [node.id, '  external-node  ', node.id],
    });

    expect(store.findMasterNodeByChapter(5)?.id).toBe(node.id);
    expect(store.getChapterDetail(2)?.parentNodeId).toBe(node.id);
    expect(store.getChapterDetail(2)?.relatedNodeIds).toEqual([node.id, 'external-node']);

    store.removeMasterOutlineNode(node.id);

    expect(store.masterOutline).toHaveLength(0);
    expect(store.getChapterDetail(2)?.parentNodeId).toBe('');
    expect(store.getChapterDetail(2)?.relatedNodeIds).toEqual(['external-node']);
  });

  it('should support storyline CRUD and rebind removed storyline nodes to main storyline', () => {
    const store = useOutlineStore();

    const mainStorylineId = store.storylines.find(storyline => storyline.type === 'main')?.id ?? store.storylines[0]?.id ?? '';
    expect(mainStorylineId).not.toBe('');

    const subplot = store.createStoryline({
      title: '  支线A  ',
      type: 'subplot',
    });

    expect(subplot.title).toBe('支线A');
    expect(store.storylines.some(storyline => storyline.id === subplot.id)).toBe(true);

    const node = store.appendMasterOutlineNode({
      title: '支线节点',
      chapterStart: 4,
      chapterEnd: 6,
      storylineId: subplot.id,
    });

    expect(node.storylineId).toBe(subplot.id);

    store.patchStoryline(subplot.id, { title: '  支线A-改  ' });
    expect(store.storylines.find(storyline => storyline.id === subplot.id)?.title).toBe('支线A-改');

    store.removeStoryline(subplot.id);

    expect(store.storylines.some(storyline => storyline.id === subplot.id)).toBe(false);
    expect(store.masterOutline.find(outlineNode => outlineNode.id === node.id)?.storylineId).toBe(mainStorylineId);

    store.removeStoryline(mainStorylineId);
    expect(store.storylines.length).toBeGreaterThanOrEqual(1);
  });

  it('should support sessions/messages/snapshots CRUD and apply snapshot', () => {
    const store = useOutlineStore();

    const subplot = store.createStoryline({ title: '会话支线', type: 'subplot' });
    const node = store.appendMasterOutlineNode({
      title: '会话节点',
      chapterStart: 2,
      chapterEnd: 3,
      storylineId: subplot.id,
    });

    store.patchChapterDetail(2, {
      title: '第2章',
      parentNodeId: node.id,
      relatedNodeIds: [node.id],
    });

    const session = store.createSession({
      type: 'chapter_detail',
      title: '  第二章会话  ',
      seed: '  聚焦冲突推进  ',
      targetChapter: 2,
    });

    expect(store.activeSessionId).toBe(session.id);
    expect(session.title).toBe('第二章会话');
    expect(session.seed).toBe('聚焦冲突推进');
    expect(session.targetChapter).toBe(2);

    const message = store.appendMessage(session.id, {
      role: 'user',
      text: '  给我两个方案  ',
    });
    expect(message?.text).toBe('给我两个方案');
    expect(store.activeSession?.messages).toHaveLength(1);

    const snapshot1 = store.appendSnapshot(session.id);
    expect(snapshot1).not.toBeNull();
    if (!snapshot1) {
      throw new Error('snapshot1 should not be null');
    }

    expect(snapshot1.version).toBe(1);
    expect(snapshot1.masterOutline.map(outlineNode => outlineNode.id)).toContain(node.id);

    store.removeMasterOutlineNode(node.id);
    expect(store.masterOutline.some(outlineNode => outlineNode.id === node.id)).toBe(false);

    const snapshot2 = store.appendSnapshot(session.id);
    expect(snapshot2).not.toBeNull();
    if (!snapshot2) {
      throw new Error('snapshot2 should not be null');
    }

    expect(snapshot2.version).toBe(2);
    expect(store.activeSnapshot?.id).toBe(snapshot2.id);

    store.setActiveSession(null);
    expect(store.activeSessionId).toBeNull();
    store.setActiveSession(session.id);
    expect(store.activeSessionId).toBe(session.id);

    store.setActiveSnapshot(session.id, snapshot1.id);
    expect(store.activeSession?.activeSnapshotId).toBe(snapshot1.id);

    const applied = store.applySnapshot(session.id, snapshot1.id);
    expect(applied?.id).toBe(snapshot1.id);
    expect(store.masterOutline.some(outlineNode => outlineNode.id === node.id)).toBe(true);
    expect(store.getChapterDetail(2)?.parentNodeId).toBe('');
    expect(store.activeSessionId).toBe(session.id);
    expect(store.activeSnapshot?.id).toBe(snapshot1.id);

    const appliedWithDetails = store.applySnapshot(session.id, snapshot1.id, { applyDetails: true });
    expect(appliedWithDetails?.id).toBe(snapshot1.id);
    expect(store.getChapterDetail(2)?.parentNodeId).toBe(node.id);
  });

  it('should set appliedSnapshotId on session after applySnapshot', () => {
    const store = useOutlineStore();
    const session = store.createSession({ type: 'outline_chat', title: '已应用标识测试' });
    const snapshot = store.appendSnapshot(session.id);
    expect(snapshot).not.toBeNull();
    if (!snapshot) throw new Error('snapshot should not be null');

    const latestSessionBefore = store.sessions.find(s => s.id === session.id);
    expect(latestSessionBefore?.appliedSnapshotId).toBeNull();

    store.applySnapshot(session.id, snapshot.id);

    const latestSessionAfter = store.sessions.find(s => s.id === session.id);
    expect(latestSessionAfter?.appliedSnapshotId).toBe(snapshot.id);
  });

  it('should preserve locked storylines when applying snapshot', () => {
    const store = useOutlineStore();

    const storyline = store.createStoryline({ title: '锁定故事线', type: 'subplot' });
    store.toggleStorylineLock(storyline.id);
    expect(store.lockedStorylineIds).toContain(storyline.id);

    const session = store.createSession({ type: 'outline_chat', title: '锁定测试' });
    const snapshot = store.appendSnapshot(session.id, {
      storylines: [
        {
          id: storyline.id,
          type: 'subplot',
          title: '草案中的新标题',
          description: '草案描述',
          color: '',
          sortOrder: 0,
          status: 'draft',
          extra: {},
        },
      ],
    });
    expect(snapshot).not.toBeNull();
    if (!snapshot) throw new Error('snapshot should not be null');

    store.applySnapshot(session.id, snapshot.id);

    const preserved = store.storylines.find(s => s.id === storyline.id);
    expect(preserved?.title).toBe('锁定故事线');
  });

  it('should preserve locked master outline nodes when applying snapshot', () => {
    const store = useOutlineStore();

    const storylineId = store.storylines[0]?.id ?? '';
    const node = store.appendMasterOutlineNode({
      title: '原始节点',
      summary: '原始摘要',
      chapterStart: 1,
      chapterEnd: 2,
      storylineId,
    });

    store.toggleNodeLock(node.id);
    expect(store.lockedNodeIds).toContain(node.id);

    const session = store.createSession({ type: 'outline_chat', title: '节点锁定测试' });
    const snapshot = store.appendSnapshot(session.id, {
      masterOutline: [
        {
          id: node.id,
          title: '草案节点标题',
          summary: '草案摘要',
          chapterStart: 1,
          chapterEnd: 3,
          turningPoints: [],
          storylineId,
          status: 'draft',
        },
      ],
    });
    expect(snapshot).not.toBeNull();
    if (!snapshot) throw new Error('snapshot should not be null');

    store.applySnapshot(session.id, snapshot.id);
    expect(store.masterOutline.find(n => n.id === node.id)?.title).toBe('原始节点');
  });

  it('should preserve parse/raw debug fields and mention metadata in session messages', () => {
    const store = useOutlineStore();
    const session = store.createSession({ type: 'outline_chat', title: '消息元数据测试' });

    store.appendMessage(session.id, {
      role: 'assistant',
      text: '解析失败，请检查 JSON',
      parseError: '结构化解析失败：未提取到 JSON 结果',
      rawResponse: 'RAW_RESPONSE_PAYLOAD',
      mentions: [
        { kind: 'node', id: 'node-1', label: '开场危机' },
        { kind: 'storyline', id: 'line-main', label: '主线' },
        { kind: 'worldbook_entry', id: 'worldbook-entry:main-dict:11', label: '帝都（主线词典）' },
      ],
      mentionSnapshots: [
        {
          kind: 'node',
          id: 'node-1',
          label: '开场危机',
          frozenAt: '2026-01-01T00:00:00.000Z',
          content: '节点快照内容',
        },
        {
          kind: 'worldbook_entry',
          id: 'worldbook-entry:main-dict:11',
          label: '帝都（主线词典）',
          frozenAt: '2026-01-01T00:00:00.000Z',
          content: '世界书条目快照内容',
        },
      ],
      mentionWarnings: ['引用解析失败：detail/第3章'],
    });

    const persistedMessage = store.activeSession?.messages[0];
    expect(persistedMessage?.parseError).toContain('未提取到 JSON');
    expect(persistedMessage?.rawResponse).toBe('RAW_RESPONSE_PAYLOAD');
    expect(persistedMessage?.mentions).toEqual([
      { kind: 'node', id: 'node-1', label: '开场危机' },
      { kind: 'storyline', id: 'line-main', label: '主线' },
      { kind: 'worldbook_entry', id: 'worldbook-entry:main-dict:11', label: '帝都（主线词典）' },
    ]);
    expect(persistedMessage?.mentionSnapshots).toEqual([
      {
        kind: 'node',
        id: 'node-1',
        label: '开场危机',
        frozenAt: '2026-01-01T00:00:00.000Z',
        content: '节点快照内容',
      },
      {
        kind: 'worldbook_entry',
        id: 'worldbook-entry:main-dict:11',
        label: '帝都（主线词典）',
        frozenAt: '2026-01-01T00:00:00.000Z',
        content: '世界书条目快照内容',
      },
    ]);
    expect(persistedMessage?.mentionWarnings).toEqual(['引用解析失败：detail/第3章']);
  });

  it('should remove last chat round and rollback latest snapshot only when round has snapshot', () => {
    const store = useOutlineStore();
    const session = store.createSession({
      type: 'outline_chat',
      title: '回滚测试会话',
    });

    store.appendMessage(session.id, {
      role: 'user',
      text: '第一轮请求',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    store.appendMessage(session.id, {
      role: 'assistant',
      text: '第一轮回复',
      createdAt: '2026-01-01T00:00:01.000Z',
    });
    store.appendSnapshot(session.id, {
      createdAt: '2026-01-01T00:00:02.000Z',
    });

    store.appendMessage(session.id, {
      role: 'user',
      text: '第二轮请求',
      createdAt: '2026-01-01T00:00:03.000Z',
    });
    store.appendMessage(session.id, {
      role: 'assistant',
      text: '第二轮回复',
      createdAt: '2026-01-01T00:00:04.000Z',
    });

    const removedWithoutSnapshot = store.removeLastChatRound(session.id);
    const latestSessionAfterFirstRemove = store.sessions.find(item => item.id === session.id);

    expect(removedWithoutSnapshot?.lastUserInstruction).toBe('第二轮请求');
    expect(removedWithoutSnapshot?.removedSnapshot).toBeNull();
    expect(latestSessionAfterFirstRemove?.messages.map(message => message.text)).toEqual(['第一轮请求', '第一轮回复']);
    expect(latestSessionAfterFirstRemove?.snapshots).toHaveLength(1);

    store.appendMessage(session.id, {
      role: 'user',
      text: '第三轮请求',
      createdAt: '2026-01-01T00:00:05.000Z',
    });
    store.appendMessage(session.id, {
      role: 'assistant',
      text: '第三轮回复',
      createdAt: '2026-01-01T00:00:06.000Z',
    });
    store.appendSnapshot(session.id, {
      createdAt: '2026-01-01T00:00:07.000Z',
    });

    const removedWithSnapshot = store.removeLastChatRound(session.id);
    const latestSessionAfterSecondRemove = store.sessions.find(item => item.id === session.id);

    expect(removedWithSnapshot?.lastUserInstruction).toBe('第三轮请求');
    expect(removedWithSnapshot?.removedSnapshot?.version).toBe(2);
    expect(latestSessionAfterSecondRemove?.snapshots).toHaveLength(1);
  });

  it('should cap sessions to latest MAX_OUTLINE_SESSIONS on createSession', () => {
    const store = useOutlineStore();
    const createdSessionIds: string[] = [];

    const total = MAX_OUTLINE_SESSIONS + 3;
    for (let index = 0; index < total; index += 1) {
      const session = store.createSession({
        type: 'outline_chat',
        title: `会话-${index + 1}`,
      });
      createdSessionIds.push(session.id);
    }

    expect(store.sessions).toHaveLength(MAX_OUTLINE_SESSIONS);
    expect(store.sessions[0]?.id).toBe(createdSessionIds.at(-MAX_OUTLINE_SESSIONS));
    expect(store.sessions.at(-1)?.id).toBe(createdSessionIds.at(-1));
    expect(store.activeSessionId).toBe(createdSessionIds.at(-1));
  });

  it('should cap snapshots to latest MAX_OUTLINE_SNAPSHOTS_PER_SESSION and keep activeSnapshotId valid', () => {
    const store = useOutlineStore();
    const session = store.createSession({ type: 'outline_chat', title: '快照限额测试' });
    const createdSnapshotIds: string[] = [];

    const total = MAX_OUTLINE_SNAPSHOTS_PER_SESSION + 5;
    for (let index = 0; index < total; index += 1) {
      const snapshot = store.appendSnapshot(session.id);
      if (!snapshot) {
        throw new Error('snapshot should not be null');
      }
      createdSnapshotIds.push(snapshot.id);
    }

    const latestSession = store.sessions.find(item => item.id === session.id);
    expect(latestSession).toBeDefined();

    if (!latestSession) {
      throw new Error('latestSession should exist');
    }

    expect(latestSession.snapshots).toHaveLength(MAX_OUTLINE_SNAPSHOTS_PER_SESSION);
    expect(latestSession.snapshots.map(snapshot => snapshot.id)).toEqual(
      createdSnapshotIds.slice(-MAX_OUTLINE_SNAPSHOTS_PER_SESSION),
    );
    expect(latestSession.snapshots[0]?.version).toBe(total - MAX_OUTLINE_SNAPSHOTS_PER_SESSION + 1);
    expect(latestSession.snapshots.at(-1)?.version).toBe(total);
    expect(latestSession.activeSnapshotId).toBe(createdSnapshotIds.at(-1));
  });

  it('should keep session updatedAt monotonic when repeated updates happen within same millisecond', () => {
    vi.useFakeTimers();

    const baseMs = new Date('2026-04-01T00:00:00.000Z').getTime();
    vi.setSystemTime(baseMs);

    try {
      const store = useOutlineStore();
      const session = store.createSession({
        type: 'outline_chat',
        title: '时间戳测试会话',
      });

      const initialUpdatedAt = store.sessions.find(item => item.id === session.id)?.updatedAt ?? '';

      store.appendMessage(session.id, {
        role: 'user',
        text: '第一条消息',
      });
      const afterFirstAppend = store.sessions.find(item => item.id === session.id)?.updatedAt ?? '';

      store.appendMessage(session.id, {
        role: 'assistant',
        text: '第二条消息',
      });
      const afterSecondAppend = store.sessions.find(item => item.id === session.id)?.updatedAt ?? '';

      expect(Date.parse(initialUpdatedAt)).toBeGreaterThan(0);
      expect(Date.parse(afterFirstAppend)).toBeGreaterThan(Date.parse(initialUpdatedAt));
      expect(Date.parse(afterSecondAppend)).toBeGreaterThan(Date.parse(afterFirstAppend));
    } finally {
      vi.useRealTimers();
    }
  });

  it('should normalize duplicated session/snapshot ids and fallback invalid active pointers during hydrate', () => {
    const store = useOutlineStore();

    store.hydrate({
      sessions: [
        {
          id: 'session-dup',
          type: 'outline_chat',
          title: '  会话A  ',
          seed: '  seedA  ',
          targetChapter: 2,
          messages: [
            {
              id: '',
              role: 'assistant',
              text: '  hi  ',
              createdAt: '',
            },
          ],
          snapshots: [
            {
              id: 'snapshot-dup',
              version: 1,
              storylines: [],
              masterOutline: [
                {
                  id: 'node-in-snapshot',
                  title: '  节点  ',
                  summary: '  摘要  ',
                  chapterStart: 1,
                  chapterEnd: 2,
                  turningPoints: ['转折A'],
                  storylineId: 'missing-storyline',
                  status: 'draft',
                },
              ],
              detailsByChapter: {
                '1': {
                  chapter: 1,
                  parentNodeId: 'node-in-snapshot',
                  title: '',
                  goal: '',
                  conflict: '',
                  beats: [],
                  mustInclude: [],
                  mustAvoid: [],
                  status: 'draft',
                },
              },
              createdAt: '',
            },
            {
              id: 'snapshot-dup',
              version: 2,
              storylines: [],
              masterOutline: [],
              detailsByChapter: {},
              createdAt: '',
            },
          ],
          activeSnapshotId: 'snapshot-not-exists',
          updatedAt: '',
        },
        {
          id: 'session-dup',
          type: 'chapter_detail',
          title: '会话B',
          seed: '',
          targetChapter: null,
          messages: [],
          snapshots: [],
          activeSnapshotId: null,
          updatedAt: '',
        },
      ],
      activeSessionId: 'session-not-exists',
    });

    expect(store.sessions).toHaveLength(2);
    expect(new Set(store.sessions.map(session => session.id)).size).toBe(2);
    expect(store.activeSessionId).toBe(store.sessions[0]?.id ?? null);

    const sessionA = store.sessions[0];
    expect(sessionA?.title).toBe('会话A');
    expect(sessionA?.seed).toBe('seedA');
    expect(sessionA?.messages[0]?.text).toBe('hi');
    expect(new Set((sessionA?.snapshots ?? []).map(snapshot => snapshot.id)).size).toBe(sessionA?.snapshots.length);
    expect(sessionA?.activeSnapshotId).toBe(sessionA?.snapshots.at(-1)?.id ?? null);

    const firstSnapshot = sessionA?.snapshots[0];
    const snapshotMainStorylineId = firstSnapshot?.storylines[0]?.id ?? '';
    expect(snapshotMainStorylineId).not.toBe('');
    expect(firstSnapshot?.masterOutline[0]?.storylineId).toBe(snapshotMainStorylineId);
  });
});
