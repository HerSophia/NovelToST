import {
  deriveChapterDetailsByAI,
  generateMasterOutlineByAI,
  rewriteChapterDetailByAI,
} from '@/novelToST/core/outline-ai.service';
import { useOutlineControl } from '@/novelToST/composables/useOutlineControl';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { useOutlineStore } from '@/novelToST/stores/outline.store';
import { stMocks } from '../../setup/st-globals.mock';

vi.mock('@/novelToST/core/outline-ai.service', async () => {
  const actual = await vi.importActual<typeof import('@/novelToST/core/outline-ai.service')>(
    '@/novelToST/core/outline-ai.service',
  );

  return {
    ...actual,
    generateMasterOutlineByAI: vi.fn(),
    deriveChapterDetailsByAI: vi.fn(),
    rewriteChapterDetailByAI: vi.fn(),
  };
});

function satisfyMinimumFoundationReadiness() {
  const foundationStore = useFoundationStore();
  foundationStore.patchModule('positioning', { genre: '奇幻' });
  foundationStore.patchModule('core', { logline: '主角在失序帝国中追查真相。' });
  foundationStore.patchModule('protagonist', { name: '林舟' });

  return foundationStore;
}

function seedMasterOutlineNode() {
  const outlineStore = useOutlineStore();
  const storylineId = outlineStore.storylines[0]?.id ?? '';
  outlineStore.appendMasterOutlineNode({
    id: 'node-phase3',
    storylineId,
    title: '第一幕节点',
    summary: '用于第三阶段门槛联调',
    chapterStart: 1,
    chapterEnd: 2,
    status: 'draft',
  });
}

describe('useOutlineControl', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();
  const generateMasterOutlineByAIMock = vi.mocked(generateMasterOutlineByAI);
  const deriveChapterDetailsByAIMock = vi.mocked(deriveChapterDetailsByAI);
  const rewriteChapterDetailByAIMock = vi.mocked(rewriteChapterDetailByAI);

  beforeEach(() => {
    generateRawMock.mockReset();
    generateMasterOutlineByAIMock.mockReset();
    deriveChapterDetailsByAIMock.mockReset();
    rewriteChapterDetailByAIMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should run outline chat round and keep existing structure when parsing fails', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    const session = control.createOutlineChatSession({ title: '测试会话' });

    generateRawMock.mockResolvedValue('建议先明确主线目标，再细分节点。');

    control.outlineChatInput.value = '先给我一个改进建议';
    const result = await control.runOutlineChatRound();

    expect(result?.parseError).toContain('未提取到 JSON');
    expect(control.lastOutlineChatParseError.value).toContain('未提取到 JSON');

    const latestSession = store.sessions.find(item => item.id === session.id);
    expect(latestSession?.messages).toHaveLength(2);
    expect(latestSession?.snapshots).toHaveLength(0);
    expect(latestSession?.messages[1]?.parseError).toContain('未提取到 JSON');
    expect(latestSession?.messages[1]?.rawResponse).toBe('建议先明确主线目标，再细分节点。');
    expect(stMocks.toastr.warning).toHaveBeenCalled();
  });

  it('should resolve selected @ mentions into frozen snapshots before sending', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    const storylineId = store.storylines[0]?.id ?? '';
    store.appendMasterOutlineNode({
      id: 'node-mention',
      storylineId,
      title: '引用节点',
      summary: '用于固化快照',
      chapterStart: 1,
      chapterEnd: 2,
      status: 'draft',
    });

    const session = control.createOutlineChatSession({ title: 'mention 固化会话' });

    generateRawMock.mockResolvedValue('先确认范围。');

    const result = await control.runOutlineChatRound({
      sessionId: session.id,
      instruction: '请根据我引用的内容给建议',
      mentions: [
        { kind: 'node', id: 'node-mention', label: '引用节点' },
        { kind: 'foundation', id: 'foundation:current', label: '故事基底' },
        { kind: 'node', id: 'missing-node', label: '缺失节点' },
      ],
    });

    expect(result?.parseError).toContain('未提取到 JSON');

    const latestSession = store.sessions.find(item => item.id === session.id);
    const userMessage = latestSession?.messages[0];

    expect(userMessage?.mentions).toEqual([
      { kind: 'node', id: 'node-mention', label: '引用节点' },
      { kind: 'foundation', id: 'foundation:current', label: '故事基底' },
      { kind: 'node', id: 'missing-node', label: '缺失节点' },
    ]);
    expect(userMessage?.mentionSnapshots).toHaveLength(2);
    const frozenAtSet = new Set((userMessage?.mentionSnapshots ?? []).map(snapshot => snapshot.frozenAt));
    expect(frozenAtSet.size).toBe(1);

    const nodeSnapshot = userMessage?.mentionSnapshots?.find(snapshot => snapshot.kind === 'node' && snapshot.id === 'node-mention');
    expect(nodeSnapshot?.content).toContain('引用节点');

    expect(userMessage?.mentionWarnings).toEqual(['引用解析失败：node/缺失节点']);
  });

  it('should resolve worldbook_entry mentions into frozen snapshots before sending', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    const session = control.createOutlineChatSession({ title: 'worldbook_entry 固化会话' });

    stMocks.getChatWorldbookName.mockReturnValue('主线词典');
    stMocks.getWorldbook.mockResolvedValue([
      {
        uid: 11,
        name: '帝都',
        enabled: true,
        content: '帝都是联邦首都。',
        strategy: {
          type: 'selective',
          keys: ['帝都', '首都'],
        },
      },
    ]);

    generateRawMock.mockResolvedValue('先确认范围。');

    await control.runOutlineChatRound({
      sessionId: session.id,
      instruction: '请参考这条世界书条目',
      mentions: [{ kind: 'worldbook_entry', id: 'worldbook-entry:%E4%B8%BB%E7%BA%BF%E8%AF%8D%E5%85%B8:11', label: '帝都（主线词典）' }],
    });

    const latestSession = store.sessions.find(item => item.id === session.id);
    const userMessage = latestSession?.messages[0];
    const entrySnapshot = userMessage?.mentionSnapshots?.find(snapshot => snapshot.kind === 'worldbook_entry');

    expect(entrySnapshot).toBeDefined();
    expect(entrySnapshot?.content).toContain('世界书：主线词典');
    expect(entrySnapshot?.content).toContain('UID：11');
    expect(entrySnapshot?.content).toContain('正文：帝都是联邦首都。');
  });

  it('should retry with frozen mention snapshots instead of resolving latest store data', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    const storylineId = store.storylines[0]?.id ?? '';
    store.appendMasterOutlineNode({
      id: 'node-retry',
      storylineId,
      title: '旧节点标题',
      summary: '旧摘要',
      chapterStart: 1,
      chapterEnd: 3,
      status: 'draft',
    });

    const session = control.createOutlineChatSession({ title: 'mention 重试会话' });

    generateRawMock.mockResolvedValueOnce('首轮建议。').mockResolvedValueOnce('重试建议。');

    await control.runOutlineChatRound({
      sessionId: session.id,
      instruction: '请参考引用节点输出建议',
      mentions: [{ kind: 'node', id: 'node-retry', label: '重试引用节点' }],
    });

    store.patchMasterOutlineNode('node-retry', {
      title: '新节点标题',
      summary: '新摘要',
    });

    await control.retryLastOutlineChatRequest(session.id);

    const latestSession = store.sessions.find(item => item.id === session.id);
    expect(latestSession?.messages).toHaveLength(2);

    const retriedUserSnapshot = latestSession?.messages[0]?.mentionSnapshots?.find(snapshot => snapshot.id === 'node-retry');
    expect(retriedUserSnapshot?.content).toContain('旧节点标题');
    expect(retriedUserSnapshot?.content).not.toContain('新节点标题');
  });

  it('should keep unresolved mention warnings on retry without re-resolving live data', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    const session = control.createOutlineChatSession({ title: 'mention 未解析重试会话' });

    generateRawMock.mockResolvedValueOnce('首轮建议。').mockResolvedValueOnce('重试建议。');

    await control.runOutlineChatRound({
      sessionId: session.id,
      instruction: '请参考我引用的节点',
      mentions: [{ kind: 'node', id: 'late-node', label: '后置节点' }],
    });

    const storylineId = store.storylines[0]?.id ?? '';
    store.appendMasterOutlineNode({
      id: 'late-node',
      storylineId,
      title: '后来补齐的节点',
      summary: '不应被重试轮重新解析',
      chapterStart: 2,
      chapterEnd: 4,
      status: 'draft',
    });

    await control.retryLastOutlineChatRequest(session.id);

    const latestSession = store.sessions.find(item => item.id === session.id);
    expect(latestSession?.messages).toHaveLength(2);

    const retriedUserMessage = latestSession?.messages[0];
    expect(retriedUserMessage?.mentions).toEqual([{ kind: 'node', id: 'late-node', label: '后置节点' }]);
    expect(retriedUserMessage?.mentionSnapshots).toBeUndefined();
    expect(retriedUserMessage?.mentionWarnings).toEqual(['引用解析失败：node/后置节点']);
  });

  it('should expose readiness-aware generation button states', () => {
    const control = useOutlineControl();

    expect(control.canGenerateMasterOutline.value).toBe(false);
    expect(control.canDeriveDetails.value).toBe(false);
    expect(control.canRewriteDetail.value).toBe(false);

    satisfyMinimumFoundationReadiness();
    expect(control.canGenerateMasterOutline.value).toBe(true);
    expect(control.canDeriveDetails.value).toBe(false);
    expect(control.canRewriteDetail.value).toBe(true);

    seedMasterOutlineNode();
    expect(control.canDeriveDetails.value).toBe(true);
  });

  it('should block master outline generation when foundation minimum readiness is unmet', async () => {
    const control = useOutlineControl();

    await control.generateMaster();

    expect(generateMasterOutlineByAIMock).not.toHaveBeenCalled();
    const warningMessage = String(stMocks.toastr.warning.mock.calls.at(-1)?.[0] ?? '');
    expect(warningMessage).toContain('当前故事基底尚未达到最低生成门槛');
    expect(warningMessage).toContain('题材');
    expect(warningMessage).toContain('一句话故事');
  });

  it('should open reminder modal before master outline generation when recommended foundation items are missing', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    satisfyMinimumFoundationReadiness();

    const pending = control.generateMaster();

    expect(control.foundationGenerationReminder.value?.title).toBe('故事基底补充提醒');
    expect(control.foundationGenerationReminder.value?.confirmText).toBe('继续生成总纲');
    expect(control.foundationGenerationReminder.value?.recommendedItems.length).toBeGreaterThan(0);
    expect(generateMasterOutlineByAIMock).not.toHaveBeenCalled();

    control.cancelFoundationGenerationReminder();
    await pending;

    expect(control.foundationGenerationReminder.value).toBeNull();
    expect(generateMasterOutlineByAIMock).not.toHaveBeenCalled();
  });

  it('should continue master outline generation after reminder modal confirmation', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();
    const storylineId = store.storylines[0]?.id ?? '';

    store.setAIConfig({ enabled: true });
    satisfyMinimumFoundationReadiness();
    generateMasterOutlineByAIMock.mockResolvedValue([
      {
        id: 'node-generated',
        storylineId,
        title: '生成节点',
        summary: '通过提醒确认后继续执行',
        chapterStart: 1,
        chapterEnd: 3,
        turningPoints: [],
        phase: 'setup',
        status: 'draft',
      },
    ]);

    const pending = control.generateMaster();
    expect(control.foundationGenerationReminder.value?.confirmText).toBe('继续生成总纲');

    control.confirmFoundationGenerationReminder();
    await pending;

    expect(generateMasterOutlineByAIMock).toHaveBeenCalledTimes(1);
    expect(store.masterOutline[0]?.title).toBe('生成节点');
    expect(stMocks.toastr.success).toHaveBeenCalledWith('已生成 1 个总纲节点');
  });

  it('should block detail derivation when foundation minimum readiness is unmet', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    seedMasterOutlineNode();

    await control.deriveDetails();

    expect(deriveChapterDetailsByAIMock).not.toHaveBeenCalled();
    const warningMessage = String(stMocks.toastr.warning.mock.calls.at(-1)?.[0] ?? '');
    expect(warningMessage).toContain('当前故事基底尚未达到最低生成门槛');
  });

  it('should continue detail derivation after readiness reminder confirmation', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    satisfyMinimumFoundationReadiness();
    seedMasterOutlineNode();
    deriveChapterDetailsByAIMock.mockResolvedValue([
      {
        chapter: 1,
        parentNodeId: 'node-phase3',
        title: '第一章细纲',
        goal: '建立主角目标',
        conflict: '主角被迫接下任务',
        beats: ['收到委托', '决定出发'],
        mustInclude: [],
        mustAvoid: [],
        status: 'draft',
      },
    ]);

    const pending = control.deriveDetails();
    expect(control.foundationGenerationReminder.value?.confirmText).toBe('继续派生细纲');

    control.confirmFoundationGenerationReminder();
    await pending;

    expect(deriveChapterDetailsByAIMock).toHaveBeenCalledTimes(1);
    expect(store.getChapterDetail(1)?.title).toBe('第一章细纲');
    expect(stMocks.toastr.success).toHaveBeenCalledWith('已派生 1 章细纲');
  });

  it('should open reminder modal before rewriting detail when recommended foundation items are missing', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    satisfyMinimumFoundationReadiness();

    const pending = control.rewriteDetail(2);

    expect(control.foundationGenerationReminder.value?.confirmText).toBe('继续重写细纲');
    expect(control.foundationGenerationReminder.value?.description).toContain('最低生成门槛');

    control.cancelFoundationGenerationReminder();
    await pending;

    expect(control.foundationGenerationReminder.value).toBeNull();
    expect(rewriteChapterDetailByAIMock).not.toHaveBeenCalled();
  });

  it('should continue rewriting detail after reminder modal confirmation', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    satisfyMinimumFoundationReadiness();
    rewriteChapterDetailByAIMock.mockResolvedValue({
      chapter: 2,
      parentNodeId: '',
      title: '重写后的第二章',
      goal: '确认重写流程继续执行',
      conflict: '主角被迫面对新的阻力',
      beats: ['接受任务', '准备行动'],
      mustInclude: [],
      mustAvoid: [],
      status: 'draft',
    });

    const pending = control.rewriteDetail(2);
    control.confirmFoundationGenerationReminder();
    await pending;

    expect(rewriteChapterDetailByAIMock).toHaveBeenCalledTimes(1);
    expect(store.getChapterDetail(2)?.title).toBe('重写后的第二章');
  });

  it('should apply snapshot safely by default and overwrite details only when applyDetails=true', () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    const oldDetail = {
      chapter: 2,
      parentNodeId: '',
      title: '旧细纲',
      goal: '旧目标',
      conflict: '旧冲突',
      beats: ['旧节拍'],
      mustInclude: [],
      mustAvoid: [],
      status: 'draft' as const,
    };

    const newDetail = {
      chapter: 2,
      parentNodeId: '',
      title: '新细纲',
      goal: '新目标',
      conflict: '新冲突',
      beats: ['新节拍'],
      mustInclude: [],
      mustAvoid: [],
      status: 'draft' as const,
    };

    store.setChapterDetail(oldDetail);
    const session = control.createOutlineChatSession({ title: '快照会话' });
    const snapshot = store.appendSnapshot(session.id, {
      detailsByChapter: {
        2: newDetail,
      },
    });

    expect(snapshot).not.toBeNull();

    const safeApplied = control.applyOutlineSnapshot(snapshot!.id, {
      sessionId: session.id,
    });
    expect(safeApplied).not.toBeNull();
    expect(store.getChapterDetail(2)?.title).toBe('旧细纲');

    const detailsApplied = control.applyOutlineSnapshot(snapshot!.id, {
      sessionId: session.id,
      applyDetails: true,
    });
    expect(detailsApplied).not.toBeNull();
    expect(store.getChapterDetail(2)?.title).toBe('新细纲');
  });

  it('should delete last outline chat request and rollback its latest snapshot', () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    const session = control.createOutlineChatSession({ title: '删除测试会话' });

    store.appendMessage(session.id, { role: 'user', text: '第一轮请求' });
    store.appendMessage(session.id, { role: 'assistant', text: '第一轮回复' });
    store.appendSnapshot(session.id);

    store.appendMessage(session.id, { role: 'user', text: '第二轮请求' });
    store.appendMessage(session.id, { role: 'assistant', text: '第二轮回复' });
    store.appendSnapshot(session.id);

    const deletedInstruction = control.deleteLastOutlineChatRequest(session.id);
    const latestSession = store.sessions.find(item => item.id === session.id);

    expect(deletedInstruction).toBe('第二轮请求');
    expect(latestSession?.messages.map(message => message.text)).toEqual(['第一轮请求', '第一轮回复']);
    expect(latestSession?.snapshots).toHaveLength(1);
    expect(latestSession?.snapshots[0]?.version).toBe(1);
  });

  it('should retry last outline chat request by replacing previous round', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    const session = control.createOutlineChatSession({ title: '重试测试会话' });

    generateRawMock
      .mockResolvedValueOnce(`已生成第一版结构。\n\n\`\`\`json
{
  "storylines": [
    {
      "id": "line-main",
      "type": "main",
      "title": "主线",
      "description": "第一版",
      "status": "draft"
    }
  ],
  "nodes": [
    {
      "id": "node-old",
      "storylineId": "line-main",
      "title": "旧节点",
      "summary": "旧结构",
      "chapterStart": 1,
      "chapterEnd": 2,
      "phase": "setup",
      "status": "draft"
    }
  ]
}
\`\`\``)
      .mockResolvedValueOnce(`已按同一请求重试并优化。\n\n\`\`\`json
{
  "storylines": [
    {
      "id": "line-main",
      "type": "main",
      "title": "主线",
      "description": "重试版",
      "status": "draft"
    }
  ],
  "nodes": [
    {
      "id": "node-new",
      "storylineId": "line-main",
      "title": "新节点",
      "summary": "重试结构",
      "chapterStart": 1,
      "chapterEnd": 3,
      "phase": "setup",
      "status": "draft"
    }
  ]
}
\`\`\``);

    control.outlineChatInput.value = '请生成第一幕主线节点';
    await control.runOutlineChatRound();
    await control.retryLastOutlineChatRequest(session.id);

    const latestSession = store.sessions.find(item => item.id === session.id);
    expect(latestSession?.messages).toHaveLength(2);
    expect(latestSession?.messages[0]?.text).toBe('请生成第一幕主线节点');
    expect(latestSession?.messages[1]?.text).toContain('重试');
    expect(latestSession?.snapshots).toHaveLength(1);
    expect(latestSession?.snapshots[0]?.masterOutline[0]?.title).toBe('新节点');
  });

  it('should capture foundation sync info after successful master outline generation', async () =>{
    const store = useOutlineStore();
    const control = useOutlineControl();
    const foundationStore = satisfyMinimumFoundationReadiness();

    store.setAIConfig({ enabled: true });
    foundationStore.patchModule('core', {
      logline: '追查帝国真相',
      coreConflict: '帝国阴谋',
      emotionalTone: '紧张悬疑',
    });

    const storylineId = store.storylines[0]?.id ?? '';
    generateMasterOutlineByAIMock.mockResolvedValue([
      {
        id: 'node-sync',
        storylineId,
        title: '同步测试节点',
        summary: '用于验证同步捕获',
        chapterStart: 1,
        chapterEnd: 3,
        turningPoints: [],
        phase: 'setup',
        status: 'draft',
      },
    ]);

    const pending = control.generateMaster();
    control.confirmFoundationGenerationReminder();
    await pending;

    expect(store.foundationSyncInfo).not.toBeNull();
    expect(store.foundationSyncInfo?.logline).toBe('追查帝国真相');
    expect(store.foundationSyncInfo?.coreConflict).toBe('帝国阴谋');
    expect(store.foundationSyncInfo?.emotionalTone).toBe('紧张悬疑');
    expect(store.foundationSyncInfo?.syncedAt).toBe(foundationStore.updatedAt);
  });

  it('should capture foundation sync info after successful outline chat round', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();
    const foundationStore =satisfyMinimumFoundationReadiness();

    store.setAIConfig({ enabled: true });
    foundationStore.patchModule('core', {
      logline: '对话同步测试',
      coreConflict: '对话冲突',
      emotionalTone: '沉重',
    });

    const session = control.createOutlineChatSession({ title: '同步测试会话' });

    generateRawMock.mockResolvedValue(`已完成。\n\n\`\`\`json
{
  "storylines": [
    { "id": "line-main", "type": "main", "title": "主线", "description": "同步测试", "status": "draft" }
  ],
  "nodes": [
    { "id": "node-chat-sync", "storylineId": "line-main", "title": "对话同步节点", "summary": "验证", "chapterStart": 1, "chapterEnd": 2, "status": "draft" }
  ]
}
\`\`\``);

    control.outlineChatInput.value = '生成主线节点';
    await control.runOutlineChatRound({ sessionId: session.id });

    expect(store.foundationSyncInfo).not.toBeNull();
    expect(store.foundationSyncInfo?.logline).toBe('对话同步测试');
    expect(store.foundationSyncInfo?.syncedAt).toBe(foundationStore.updatedAt);
  });

  it('should not capture foundation sync info when outline chat parse fails', async () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    store.setAIConfig({ enabled: true });
    const session = control.createOutlineChatSession({ title: '解析失败会话' });

    generateRawMock.mockResolvedValue('纯文本建议，不含 JSON。');

    control.outlineChatInput.value = '给建议';
    await control.runOutlineChatRound({ sessionId: session.id });

    expect(store.foundationSyncInfo).toBeNull();
  });

  it('should prefer outlineStore.totalChapterTarget over settingsStore.settings.totalChapters', () => {
    const store = useOutlineStore();
    const control = useOutlineControl();

    expect(control.chapterCount.value).toBe(1000);

    store.setTotalChapterTarget(30);
    expect(control.chapterCount.value).toBe(30);

    store.setTotalChapterTarget(0);
    expect(control.chapterCount.value).toBe(1000);
  });

});
