import { useOutlineStore } from '@/novelToST/stores/outline.store';

describe('outline.store contract', () => {
  it('should expose stable public surface for UI/composables/services', () => {
    const store = useOutlineStore();

    const expectedKeys = [
      'enabled',
      'missingDetailPolicy',
      'storylines',
      'masterOutline',
      'sessions',
      'activeSessionId',
      'activeSession',
      'activeSnapshot',
      'sortedMasterOutline',
      'sortedStorylines',
      'detailsByChapter',
      'detailChapters',
      'approvedDetailCount',
      'ai',
      'mentionConfig',
      'updatedAt',
      'setEnabled',
      'setMissingDetailPolicy',
      'replaceMasterOutline',
      'appendMasterOutlineNode',
      'createStoryline',
      'createSession',
      'patchStoryline',
      'removeStoryline',
      'setActiveSession',
      'patchMasterOutlineNode',
      'removeMasterOutlineNode',
      'replaceChapterDetails',
      'setChapterDetail',
      'appendMessage',
      'appendSnapshot',
      'setActiveSnapshot',
      'removeLastChatRound',
      'applySnapshot',
      'patchChapterDetail',
      'removeChapterDetail',
      'ensureChapterDetail',
      'getChapterDetail',
      'findMasterNodeByChapter',
      'setAIConfig',
      'patchMentionConfig',
      'touchUpdatedAt',
      'toStateSnapshot',
      'hydrate',
      'reset',
      'lockedStorylineIds',
      'lockedNodeIds',
      'toggleStorylineLock',
      'toggleNodeLock',
      'totalChapterTarget',
      'calendar',
      'synopsis',
      'foundationSyncInfo',
      'setTotalChapterTarget',
      'setCalendar',
      'setSynopsis',
      'setFoundationSyncInfo',
    ] as const;

    expectedKeys.forEach(key => {
      expect(key in store).toBe(true);
    });
  });

  it('should keep state roundtrip stable through toStateSnapshot -> hydrate', () => {
    const store = useOutlineStore();

    store.setEnabled(true);
    store.patchMentionConfig({
      worldbookEntryLabel: {
        includeWorldbookName: false,
        includeTriggerKeywords: true,
      },
    });

    const subplot = store.createStoryline({ title: '支线', type: 'subplot' });
    const node = store.appendMasterOutlineNode({
      title: '节点1',
      chapterStart: 1,
      chapterEnd: 2,
      storylineId: subplot.id,
    });

    store.patchChapterDetail(1, {
      title: '第一章',
      parentNodeId: node.id,
      relatedNodeIds: [node.id],
    });

    const session = store.createSession({ type: 'outline_chat', title: '会话1' });
    store.appendMessage(session.id, { role: 'user', text: 'hello' });
    store.appendSnapshot(session.id);

    const snapshot = store.toStateSnapshot();

    store.reset();
    store.hydrate(snapshot);

    expect(store.toStateSnapshot()).toEqual(snapshot);
  });

  it('should roundtrip new v3 fields through toStateSnapshot -> hydrate', () => {
    const store = useOutlineStore();

    store.setTotalChapterTarget(42);
    store.setCalendar({ type: 'gregorian', name: '公历', description: '标准公历', formatHint: 'YYYY-MM-DD' });
    store.setSynopsis('一段测试梗概');
    store.setFoundationSyncInfo({
      syncedAt: '2026-01-01T00:00:00.000Z',
      logline: '测试 logline',
      coreConflict: '测试冲突',
      emotionalTone: '测试基调',
    });

    const storyline = store.createStoryline({ title: '测试支线', type: 'subplot' });
    store.patchStoryline(storyline.id, {
      themeKeywords: ['主题A', '主题B'],
      linkedCharacters: ['角色X'],
    });

    const node = store.appendMasterOutlineNode({
      title: '测试节点',
      chapterStart: 1,
      chapterEnd: 3,
      storylineId: storyline.id,
    });
    store.patchMasterOutlineNode(node.id, {
      tensionLevel: 7,
      emotionalTone: '紧张',
      foreshadowing: ['伏笔A'],
      payoffs: ['回收A'],
    });

    store.patchChapterDetail(1, {
      parentNodeId: node.id,
      wordCountEstimate: 3000,
      pacing: '快节奏',
      sceneBreakdown: ['场景1', '场景2'],
    });

    const snapshot = store.toStateSnapshot();
    store.reset();
    store.hydrate(snapshot);

    expect(store.totalChapterTarget).toBe(42);
    expect(store.calendar).toEqual({ type: 'gregorian', name: '公历', description: '标准公历', formatHint: 'YYYY-MM-DD' });
    expect(store.synopsis).toBe('一段测试梗概');
    expect(store.foundationSyncInfo).toEqual({
      syncedAt: '2026-01-01T00:00:00.000Z',
      logline: '测试 logline',
      coreConflict: '测试冲突',
      emotionalTone: '测试基调',
    });

    const restoredStoryline = store.storylines.find(s => s.id === storyline.id);
    expect(restoredStoryline?.themeKeywords).toEqual(['主题A', '主题B']);
    expect(restoredStoryline?.linkedCharacters).toEqual(['角色X']);

    const restoredNode = store.masterOutline.find(n => n.id === node.id);
    expect(restoredNode?.tensionLevel).toBe(7);
    expect(restoredNode?.emotionalTone).toBe('紧张');
    expect(restoredNode?.foreshadowing).toEqual(['伏笔A']);
    expect(restoredNode?.payoffs).toEqual(['回收A']);

    const restoredDetail = store.getChapterDetail(1);
    expect(restoredDetail?.wordCountEstimate).toBe(3000);
    expect(restoredDetail?.pacing).toBe('快节奏');
    expect(restoredDetail?.sceneBreakdown).toEqual(['场景1', '场景2']);

    expect(store.toStateSnapshot()).toEqual(snapshot);
  });

  it('should reset new v3 fields to defaults', () => {
    const store = useOutlineStore();

    store.setTotalChapterTarget(10);
    store.setSynopsis('有内容');
    store.setFoundationSyncInfo({
      syncedAt: '2026-01-01T00:00:00.000Z',
      logline: 'test',
      coreConflict: 'test',
      emotionalTone: 'test',
    });

    store.reset();

    expect(store.totalChapterTarget).toBe(0);
    expect(store.calendar).toBeNull();
    expect(store.synopsis).toBe('');
    expect(store.foundationSyncInfo).toBeNull();
  });

});
