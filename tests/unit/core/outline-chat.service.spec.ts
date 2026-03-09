import { runOutlineChatRound, type OutlineChatStoreAdapter } from '@/novelToST/core/outline-chat.service';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { useOutlineStore } from '@/novelToST/stores/outline.store';

function createOutlineChatStore(): ReturnType<typeof useOutlineStore> & OutlineChatStoreAdapter {
  const outlineStore = useOutlineStore() as ReturnType<typeof useOutlineStore> & Partial<OutlineChatStoreAdapter>;
  const foundationStore = useFoundationStore();

  Object.defineProperty(outlineStore, 'foundation', {
    configurable: true,
    enumerable: true,
    get: () => foundationStore.foundation,
  });

  return outlineStore as ReturnType<typeof useOutlineStore> & OutlineChatStoreAdapter;
}

describe('outline-chat.service', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();

  beforeEach(() => {
    generateRawMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should append messages and snapshot when structured outline payload is parsed', async () => {
    const store = createOutlineChatStore();
    const session = store.createSession({
      type: 'outline_chat',
      title: '主线会话',
      seed: '推进第一幕',
    });

    generateRawMock.mockResolvedValue(`已按你的要求补全主线与节点。\n\n\`\`\`json
{
  "setup": {
    "title": "星轨残响",
    "characters": ["黎曜", "艾诺"]
  },
  "storylines": [
    {
      "id": "line-main",
      "type": "main",
      "title": "主线",
      "description": "寻找黑匣子",
      "status": "draft"
    }
  ],
  "nodes": [
    {
      "id": "node-1",
      "storylineId": "line-main",
      "title": "失控航线",
      "summary": "主角被迫接管舰桥",
      "chapterStart": 1,
      "chapterEnd": 4,
      "phase": "setup",
      "events": [
        { "tag": "turning_point", "label": "", "description": "接管舰桥" }
      ],
      "timeStart": { "label": "T+0", "sortKey": 0, "note": "" },
      "timeEnd": { "label": "T+3", "sortKey": 3, "note": "" },
      "keywords": ["失忆", "残舰"],
      "status": "draft"
    }
  ]
}
\`\`\``);

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '请把第一幕整理为可执行节点，并补一条主线',
      chapterCount: 20,
    });

    expect(result.parseError).toBeNull();
    expect(result.snapshot).not.toBeNull();
    expect(result.foundationPatch?.positioning?.title).toBe('星轨残响');
    // 自动回写已移除，基底应保持原值（未初始化为空字符串）
    expect(store.foundation.positioning.title).toBe('');

    const latestSession = store.sessions.find(item => item.id === session.id);
    expect(latestSession?.messages).toHaveLength(2);
    expect(latestSession?.messages[0]?.role).toBe('user');
    expect(latestSession?.messages[1]?.role).toBe('assistant');
    expect(latestSession?.messages[1]?.text).toContain('补全主线与节点');
    expect(latestSession?.snapshots).toHaveLength(1);

    expect(result.snapshot?.masterOutline[0]).toMatchObject({
      id: 'node-1',
      phase: 'setup',
      chapterStart: 1,
      chapterEnd: 4,
    });
    expect(result.snapshot?.masterOutline[0]?.events?.[0]?.description).toBe('接管舰桥');
  });

  it('should include current storylines and nodes in system prompt for outline chat', async () => {
    const store = createOutlineChatStore();
    const storyline = store.createStoryline({
      type: 'main',
      title: '__system_line__',
      description: '系统提示词主线',
    });
    store.appendMasterOutlineNode({
      title: '__system_node__',
      summary: '系统提示词节点',
      chapterStart: 1,
      chapterEnd: 2,
      storylineId: storyline.id,
    });
    const session = store.createSession({
      type: 'outline_chat',
      title: '系统提示词会话',
    });

    generateRawMock.mockResolvedValue('先确认本轮目标。');

    await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '继续推进这一条主线',
      chapterCount: 12,
    });

    const payload = generateRawMock.mock.calls[0]?.[0] as {
      user_input?: string;
      ordered_prompts?: Array<string | { role?: string; content?: string }>;
    };

    const systemPromptItem = payload.ordered_prompts?.find(
      (item): item is { role?: string; content?: string } => typeof item === 'object' && item !== null,
    );

    expect(systemPromptItem?.role).toBe('system');
    expect(systemPromptItem?.content ?? '').toContain('当前 Storylines：');
    expect(systemPromptItem?.content ?? '').toContain('__system_line__');
    expect(systemPromptItem?.content ?? '').toContain('默认采用“增量协作模式”');
    expect(systemPromptItem?.content ?? '').toContain('若用户未明确要求“全量重做/完整重排/覆盖全部章节/输出完整大纲”');
    expect(systemPromptItem?.content ?? '').toContain('update 类命令必须只提供最小 patch');
    expect(systemPromptItem?.content ?? '').toContain('node.split');
    expect(systemPromptItem?.content ?? '').toContain('当前 Nodes：');
    expect(systemPromptItem?.content ?? '').toContain('__system_node__');

    expect(payload.user_input ?? '').toContain('最近消息：');
    expect(payload.user_input ?? '').toContain('用户本轮指令：');
    expect(payload.user_input ?? '').toContain('继续推进这一条主线');
    expect(payload.user_input ?? '').toContain('如果用户本轮没有明确要求全量重做，请默认按增量模式输出。');
  });

  it('should persist selected @ mentions and frozen snapshots on user message metadata', async () => {
    const store = createOutlineChatStore();
    const session = store.createSession({
      type: 'outline_chat',
      title: 'mention 元数据会话',
    });

    generateRawMock.mockResolvedValue('先确认本轮目标。');

    await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '请根据我引用的内容调整节点',
      chapterCount: 12,
      mentions: [
        { kind: 'node', id: 'node-1', label: '开场危机' },
        { kind: 'storyline', id: 'line-main', label: '主线' },
      ],
      mentionSnapshots: [
        {
          kind: 'node',
          id: 'node-1',
          label: '开场危机',
          frozenAt: '2026-01-01T00:00:00.000Z',
          content: 'ID：node-1\n标题：开场危机',
        },
      ],
      mentionWarnings: ['引用解析失败：detail/第2章'],
    });

    const latestSession = store.sessions.find(item => item.id === session.id);
    expect(latestSession?.messages[0]).toMatchObject({
      role: 'user',
      text: '请根据我引用的内容调整节点',
      mentions: [
        { kind: 'node', id: 'node-1', label: '开场危机' },
        { kind: 'storyline', id: 'line-main', label: '主线' },
      ],
      mentionSnapshots: [
        {
          kind: 'node',
          id: 'node-1',
          label: '开场危机',
          frozenAt: '2026-01-01T00:00:00.000Z',
          content: 'ID：node-1\n标题：开场危机',
        },
      ],
      mentionWarnings: ['引用解析失败：detail/第2章'],
    });

    expect(latestSession?.messages[1]?.role).toBe('assistant');
  });

  it('should inject mention prompt section with limits and warnings', async () => {
    const store = createOutlineChatStore();
    const session = store.createSession({
      type: 'outline_chat',
      title: 'mention 提示词会话',
    });

    generateRawMock.mockResolvedValue('先确认本轮目标。');

    const mentionSnapshots = Array.from({ length: 6 }, (_, index) => ({
      kind: 'node' as const,
      id: `node-${index + 1}`,
      label: `节点${index + 1}`,
      frozenAt: '2026-01-01T00:00:00.000Z',
      content: `引用内容 ${index + 1} `.repeat(240),
    }));

    await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '结合我选择的引用，微调节点节奏',
      chapterCount: 12,
      mentionSnapshots,
      mentionWarnings: ['引用解析失败：detail/第2章'],
    });

    const payload = generateRawMock.mock.calls[0]?.[0] as {
      ordered_prompts?: Array<string | { role?: string; content?: string }>;
    };
    const systemPromptItem = payload.ordered_prompts?.find(
      (item): item is { role?: string; content?: string } => typeof item === 'object' && item !== null,
    );
    const systemPromptContent = systemPromptItem?.content ?? '';

    expect(systemPromptContent).toContain('引用上下文（来自@）：');
    expect(systemPromptContent).toContain('【大纲节点】节点1');
    expect(systemPromptContent).toContain('kind=node | id=node-1 | frozenAt=2026-01-01T00:00:00.000Z');
    expect(systemPromptContent).not.toContain('【大纲节点】节点6');
    expect(systemPromptContent).toContain('引用上下文告警：');
    expect(systemPromptContent).toContain('引用数量超出上限');
    expect(systemPromptContent).toContain('引用解析失败：detail/第2章');
    expect(systemPromptContent).toContain('…（已截断）');
  });

  it('should render worldbook_entry mention snapshots in prompt section', async () => {
    const store = createOutlineChatStore();
    const session = store.createSession({
      type: 'outline_chat',
      title: 'worldbook_entry 提示词会话',
    });

    generateRawMock.mockResolvedValue('先确认本轮目标。');

    await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '请结合世界书条目调整节点',
      chapterCount: 12,
      mentionSnapshots: [
        {
          kind: 'worldbook_entry',
          id: 'worldbook-entry:main-dict:11',
          label: '帝都（主线词典）',
          frozenAt: '2026-01-01T00:00:00.000Z',
          content: '世界书：主线词典\nUID：11\n条目：帝都\n正文：帝都是联邦首都。',
        },
      ],
    });

    const payload = generateRawMock.mock.calls[0]?.[0] as {
      ordered_prompts?: Array<string | { role?: string; content?: string }>;
    };
    const systemPromptItem = payload.ordered_prompts?.find(
      (item): item is { role?: string; content?: string } => typeof item === 'object' && item !== null,
    );
    const systemPromptContent = systemPromptItem?.content ?? '';

    expect(systemPromptContent).toContain('kind=worldbook_entry | id=worldbook-entry:main-dict:11 | frozenAt=2026-01-01T00:00:00.000Z');
    expect(systemPromptContent).toContain('【世界书条目】帝都（主线词典）');
    expect(systemPromptContent).toContain('世界书：主线词典');
    expect(systemPromptContent).toContain('正文：帝都是联邦首都。');
  });

  it('should apply nodeCommands C/U/D against current master outline', async () => {
    const store = createOutlineChatStore();
    const storyline = store.createStoryline({
      type: 'main',
      title: '命令式主线',
      description: '用于测试 nodeCommands',
    });

    store.appendMasterOutlineNode({
      id: 'node-a',
      storylineId: storyline.id,
      title: '旧节点 A',
      summary: '旧摘要 A',
      chapterStart: 1,
      chapterEnd: 2,
    });
    store.appendMasterOutlineNode({
      id: 'node-b',
      storylineId: storyline.id,
      title: '旧节点 B',
      summary: '旧摘要 B',
      chapterStart: 3,
      chapterEnd: 4,
    });

    const session = store.createSession({
      type: 'outline_chat',
      title: '命令式节点操作会话',
    });

    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "已按命令调整节点。",
  "nodeCommands": [
    { "op": "U", "id": "node-a", "patch": { "summary": "新摘要 A", "chapterEnd": 3 } },
    { "op": "D", "id": "node-b" },
    { "op": "C", "node": { "id": "node-c", "storylineId": "${storyline.id}", "title": "新增节点 C", "summary": "新增摘要 C", "chapterStart": 4, "chapterEnd": 5, "status": "draft" } }
  ]
}\n\`\`\``);

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '请按命令做节点增量调整',
      chapterCount: 12,
    });

    expect(result.parseError).toBeNull();
    expect(result.snapshot).not.toBeNull();

    const nodes = result.snapshot?.masterOutline ?? [];
    expect(nodes.some(node => node.id === 'node-b')).toBe(false);

    const updatedNode = nodes.find(node => node.id === 'node-a');
    expect(updatedNode).toMatchObject({
      summary: '新摘要 A',
      chapterStart: 1,
      chapterEnd: 3,
    });

    const createdNode = nodes.find(node => node.id === 'node-c');
    expect(createdNode).toMatchObject({
      title: '新增节点 C',
      summary: '新增摘要 C',
      chapterStart: 4,
      chapterEnd: 5,
    });
  });

  it('should apply commands with node.create/node.update/node.delete', async () => {
    const store = createOutlineChatStore();
    const storyline = store.createStoryline({
      type: 'main',
      title: '命令总线主线',
      description: '用于测试 commands',
    });

    store.appendMasterOutlineNode({
      id: 'command-node-a',
      storylineId: storyline.id,
      title: '命令旧节点 A',
      summary: '命令旧摘要 A',
      chapterStart: 1,
      chapterEnd: 2,
    });
    store.appendMasterOutlineNode({
      id: 'command-node-b',
      storylineId: storyline.id,
      title: '命令旧节点 B',
      summary: '命令旧摘要 B',
      chapterStart: 3,
      chapterEnd: 4,
    });

    const session = store.createSession({
      type: 'outline_chat',
      title: 'commands 节点操作会话',
    });

    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "已通过 commands 执行节点修改。",
  "commands": [
    { "type": "node.update", "id": "command-node-a", "patch": { "summary": "命令新摘要 A", "chapterEnd": 3 } },
    { "type": "node.delete", "id": "command-node-b" },
    { "type": "node.create", "node": { "id": "command-node-c", "storylineId": "${storyline.id}", "title": "命令新增节点 C", "summary": "命令新增摘要 C", "chapterStart": 4, "chapterEnd": 5, "status": "draft" } }
  ]
}\n\`\`\``);

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '使用 commands 增量修改节点',
      chapterCount: 12,
    });

    expect(result.parseError).toBeNull();
    expect(result.snapshot).not.toBeNull();

    const nodes = result.snapshot?.masterOutline ?? [];
    expect(nodes.some(node => node.id === 'command-node-b')).toBe(false);

    const updatedNode = nodes.find(node => node.id === 'command-node-a');
    expect(updatedNode).toMatchObject({
      summary: '命令新摘要 A',
      chapterStart: 1,
      chapterEnd: 3,
    });

    const createdNode = nodes.find(node => node.id === 'command-node-c');
    expect(createdNode).toMatchObject({
      title: '命令新增节点 C',
      summary: '命令新增摘要 C',
      chapterStart: 4,
      chapterEnd: 5,
    });
  });

  it('should apply node.split command as grouped node refinements', async () => {
    const store = createOutlineChatStore();
    const storyline = store.createStoryline({
      type: 'main',
      title: '拆分测试主线',
      description: '用于测试 node.split',
    });

    store.appendMasterOutlineNode({
      id: 'node-split-root',
      storylineId: storyline.id,
      title: '待拆分总节点',
      summary: '这是一个跨度较大的节点。',
      chapterStart: 1,
      chapterEnd: 120,
      phase: 'confrontation',
    });

    const session = store.createSession({
      type: 'outline_chat',
      title: 'node.split 会话',
    });

    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "已将目标节点细化为上下两段。",
  "commands": [
    {
      "type": "node.split",
      "id": "node-split-root",
      "nodes": [
        { "title": "上半段", "summary": "上半段摘要", "chapterStart": 1, "chapterEnd": 60 },
        { "title": "下半段", "summary": "下半段摘要", "chapterStart": 61, "chapterEnd": 120 }
      ]
    }
  ]
}\n\`\`\``);

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '请将该节点拆分成两个更细节点',
      chapterCount: 200,
    });

    expect(result.parseError).toBeNull();
    const nodes = result.snapshot?.masterOutline ?? [];
    expect(nodes.find(node => node.id === 'node-split-root')).toMatchObject({
      title: '上半段',
      chapterStart: 1,
      chapterEnd: 60,
    });
    expect(nodes.find(node => node.id === 'node-split-root-split-2')).toMatchObject({
      title: '下半段',
      chapterStart: 61,
      chapterEnd: 120,
      storylineId: storyline.id,
    });
  });

  it('should apply storyline commands via commands bus and keep node storyline binding valid', async () => {
    const store = createOutlineChatStore();
    const mainStorylineId = store.storylines[0]?.id ?? '';
    expect(mainStorylineId).not.toBe('');

    store.createStoryline({
      id: 'line-remove',
      type: 'subplot',
      title: '待删除支线',
      description: '将被命令删除',
    });

    store.appendMasterOutlineNode({
      id: 'node-on-removed-line',
      storylineId: 'line-remove',
      title: '待迁移节点',
      summary: '删除支线后需要重绑',
      chapterStart: 2,
      chapterEnd: 3,
    });

    const session = store.createSession({
      type: 'outline_chat',
      title: 'commands 故事线操作会话',
    });

    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "已通过命令总线调整故事线。",
  "commands": [
    { "type": "storyline.update", "id": "${mainStorylineId}", "patch": { "title": "主线-命令更新" } },
    { "target": "storyline", "op": "C", "storyline": { "id": "line-agent", "type": "subplot", "title": "Agent 支线", "description": "命令创建" } },
    { "entity": "storyline", "action": "D", "id": "line-remove" }
  ]
}\n\`\`\``);

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '请通过 commands 调整故事线',
      chapterCount: 12,
    });

    expect(result.parseError).toBeNull();
    expect(result.snapshot).not.toBeNull();

    const storylines = result.snapshot?.storylines ?? [];
    expect(storylines.some(storyline => storyline.id === 'line-remove')).toBe(false);
    expect(storylines.find(storyline => storyline.id === mainStorylineId)?.title).toBe('主线-命令更新');
    expect(storylines.find(storyline => storyline.id === 'line-agent')).toMatchObject({
      title: 'Agent 支线',
      type: 'subplot',
    });

    const migratedNode = result.snapshot?.masterOutline.find(node => node.id === 'node-on-removed-line');
    expect(migratedNode).toBeDefined();
    expect(migratedNode?.storylineId).not.toBe('line-remove');
    expect(
      storylines.some(storyline => storyline.id === (migratedNode?.storylineId ?? '')),
    ).toBe(true);
  });

  it('should apply detail commands via commands bus on top of current details', async () => {
    const store = createOutlineChatStore();
    store.patchChapterDetail(2, {
      title: '旧细纲 2',
      goal: '旧目标 2',
      conflict: '旧冲突 2',
      beats: ['旧节拍 2'],
    });
    store.patchChapterDetail(4, {
      title: '旧细纲 4',
      goal: '旧目标 4',
      conflict: '旧冲突 4',
    });
    store.patchChapterDetail(6, {
      title: '旧细纲 6',
      goal: '旧目标 6',
      conflict: '旧冲突 6',
    });

    const session = store.createSession({
      type: 'outline_chat',
      title: 'commands 细纲操作会话',
    });

    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "已通过命令总线调整细纲。",
  "commands": [
    { "type": "detail.update", "chapter": 2, "patch": { "goal": "新目标 2", "conflict": "新冲突 2", "beats": ["更新节拍 2"] } },
    { "target": "detail", "op": "D", "chapter": 4 },
    { "entity": "detail", "action": "C", "detail": { "chapter": 5, "title": "新增细纲 5", "goal": "新增目标 5", "conflict": "新增冲突 5", "beats": ["新增节拍 5"], "status": "draft" } }
  ]
}\n\`\`\``);

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '请通过 commands 调整细纲',
      chapterCount: 12,
    });

    expect(result.parseError).toBeNull();
    expect(result.snapshot).not.toBeNull();

    const details = result.snapshot?.detailsByChapter ?? {};
    expect(details[2]).toMatchObject({ goal: '新目标 2', conflict: '新冲突 2', beats: ['更新节拍 2'] });
    expect(details[4]).toBeUndefined();
    expect(details[5]).toMatchObject({ title: '新增细纲 5', goal: '新增目标 5', conflict: '新增冲突 5' });
    expect(details[6]).toMatchObject({ title: '旧细纲 6', goal: '旧目标 6', conflict: '旧冲突 6' });
  });

  it('should return foundation patch without auto-applying and keep legacy setup alias compatible', async () => {
    const store = createOutlineChatStore();
    const foundationStore = useFoundationStore();
    foundationStore.applyFoundationPatch({
      positioning: { title: '旧标题' },
      core: { emotionalTone: '旧基调', coreConflict: '旧冲突' },
      protagonist: { name: '黎曜' },
    });

    const session = store.createSession({
      type: 'outline_chat',
      title: 'commands 设定操作会话',
    });

    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "已通过命令更新设定。",
  "commands": [
    { "type": "foundation.patch", "patch": { "core": { "emotionalTone": "新基调" } } },
    { "target": "setup", "op": "U", "setup": { "coreConflict": "新冲突" } }
  ]
}\n\`\`\``);

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '请通过 commands 更新设定',
      chapterCount: 12,
    });

    expect(result.parseError).toBeNull();
    expect(result.foundationPatch).toMatchObject({ core: { emotionalTone: '新基调', coreConflict: '新冲突' } });
    // 自动回写已移除，基底应保持原值
    expect(store.foundation.positioning.title).toBe('旧标题');
    expect(store.foundation.core.emotionalTone).toBe('旧基调');
    expect(store.foundation.core.coreConflict).toBe('旧冲突');
    expect(result.snapshot).not.toBeNull();
  });

  it('should return parseWarnings when commands contain conflicts', async () => {
    const store = createOutlineChatStore();
    const storyline = store.storylines[0];
    expect(storyline).toBeDefined();

    store.appendMasterOutlineNode({
      id: 'conflict-node',
      storylineId: storyline?.id ?? '',
      title: '待删除节点',
      summary: '用于冲突测试',
      chapterStart: 1,
      chapterEnd: 2,
    });

    const session = store.createSession({
      type: 'outline_chat',
      title: 'commands 冲突告警会话',
    });

    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "已执行命令。",
  "commands": [
    { "type": "node.delete", "id": "conflict-node" },
    { "type": "node.update", "id": "conflict-node", "patch": { "summary": "删除后更新" } }
  ]
}\n\`\`\``);

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '执行冲突命令测试',
      chapterCount: 12,
    });

    expect(result.parseError).toBeNull();
    expect(result.parseWarnings.some(item => item.includes('node 命令冲突：id=conflict-node 先删除后更新'))).toBe(true);
    expect(result.snapshot?.masterOutline.some(node => node.id === 'conflict-node')).toBe(false);
  });

  it('should keep parseWarnings even when conflicts make this round non-applicable', async () => {
    const store = createOutlineChatStore();
    const session = store.createSession({
      type: 'outline_chat',
      title: 'commands 冲突无效会话',
    });

    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "命令执行完毕。",
  "commands": [
    { "type": "node.update", "id": "missing-node", "patch": { "summary": "更新不存在节点" } }
  ]
}\n\`\`\``);

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '执行无效冲突命令测试',
      chapterCount: 12,
    });

    expect(result.parseError).toContain('命令未能生效');
    expect(result.snapshot).toBeNull();
    expect(result.parseWarnings.some(item => item.includes('node.update 命令#1 目标不存在（id=missing-node）'))).toBe(true);
  });

  it('should keep conversation text and skip snapshot when json payload is missing', async () => {
    const store = createOutlineChatStore();
    const existingNode = store.appendMasterOutlineNode({
      title: '既有节点',
      chapterStart: 1,
      chapterEnd: 3,
    });
    const session = store.createSession({
      type: 'outline_chat',
      title: '自然语言回复测试',
    });

    generateRawMock.mockResolvedValue('我建议先补充主线冲突，再细化节点节奏。');

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '给我建议',
      chapterCount: 10,
    });

    expect(result.parseError).toContain('未提取到 JSON');
    expect(result.snapshot).toBeNull();

    const latestSession = store.sessions.find(item => item.id === session.id);
    expect(latestSession?.messages).toHaveLength(2);
    expect(latestSession?.snapshots).toHaveLength(0);

    expect(latestSession?.messages[1]).toMatchObject({
      role: 'assistant',
      parseError: expect.stringContaining('未提取到 JSON'),
      rawResponse: '我建议先补充主线冲突，再细化节点节奏。',
    });

    expect(store.masterOutline.some(node => node.id === existingNode.id)).toBe(true);
  });

  it('should report parse warning and avoid overwrite when json has no applicable fields', async () => {
    const store = createOutlineChatStore();
    const foundationStore = useFoundationStore();
    foundationStore.applyFoundationPatch({ positioning: { title: '原始标题' } });

    const existingNode = store.appendMasterOutlineNode({
      title: '原节点',
      chapterStart: 2,
      chapterEnd: 4,
    });

    const session = store.createSession({
      type: 'outline_chat',
      title: '无结构字段测试',
    });

    generateRawMock.mockResolvedValue(`\n\`\`\`json\n{
  "assistantReply": "本轮先讨论方向，不调整结构。"
}\n\`\`\``);

    const result = await runOutlineChatRound({
      store,
      sessionId: session.id,
      userInstruction: '先聊策略',
      chapterCount: 12,
    });

    expect(result.parseError).toContain('缺少可应用字段');
    expect(result.snapshot).toBeNull();

    const latestSession = store.sessions.find(item => item.id === session.id);
    expect(latestSession?.messages).toHaveLength(2);
    expect(latestSession?.snapshots).toHaveLength(0);

    expect(store.foundation.positioning.title).toBe('原始标题');
    expect(store.masterOutline.some(node => node.id === existingNode.id)).toBe(true);
  });

  it('should reject non-outline_chat sessions before calling AI', async () => {
    const store = createOutlineChatStore();
    const session = store.createSession({
      type: 'chapter_detail',
      title: '细纲会话',
    });

    await expect(
      runOutlineChatRound({
        store,
        sessionId: session.id,
        userInstruction: '测试',
        chapterCount: 8,
      }),
    ).rejects.toThrow('仅支持 outline_chat 会话');

    expect(generateRawMock).not.toHaveBeenCalled();

    const latestSession = store.sessions.find(item => item.id === session.id);
    expect(latestSession?.messages).toHaveLength(0);
    expect(latestSession?.snapshots).toHaveLength(0);
  });
});
