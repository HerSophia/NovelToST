import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { generateMasterOutlineByAI } from '@/novelToST/core/outline-ai.service';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { useOutlineStore } from '@/novelToST/stores/outline.store';
import WritingOutlinePanel from '@/novelToST/ui/workbench/WritingOutlinePanel.vue';
import { stMocks } from '../../setup/st-globals.mock';

vi.mock('@/novelToST/core/outline-ai.service', async () => {
  const actual = await vi.importActual<typeof import('@/novelToST/core/outline-ai.service')>(
    '@/novelToST/core/outline-ai.service',
  );

  return {
    ...actual,
    generateMasterOutlineByAI: vi.fn(),
  };
});

async function flushAsyncUpdates(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
  await Promise.resolve();
  await nextTick();
}

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
    id: 'node-outline-panel-readiness',
    storylineId,
    title: '第一幕节点',
    summary: '用于按钮可用态测试',
    chapterStart: 1,
    chapterEnd: 2,
    turningPoints: [],
    phase: 'setup',
    status: 'draft',
  });
}


describe('WritingOutlinePanel', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();
  const generateMasterOutlineByAIMock = vi.mocked(generateMasterOutlineByAI);

  beforeEach(() => {
    generateRawMock.mockReset();
    generateMasterOutlineByAIMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create outline session and run chat round to produce snapshot', async () => {
    const wrapper = mount(WritingOutlinePanel);
    const store = useOutlineStore();

    store.setAIConfig({ enabled: true });

    await wrapper.get('[data-outline-action="create-session"]').trigger('click');
    expect(store.sessions).toHaveLength(1);

    generateRawMock.mockResolvedValue(`已按要求重排第一幕结构。\n\n\`\`\`json
{
  "storylines": [
    {
      "id": "line-main",
      "type": "main",
      "title": "主线",
      "description": "追查失控航线",
      "status": "draft"
    }
  ],
  "nodes": [
    {
      "id": "node-1",
      "storylineId": "line-main",
      "title": "失控航线",
      "summary": "主角接管舰桥并发现异常信号",
      "chapterStart": 1,
      "chapterEnd": 3,
      "phase": "setup",
      "status": "draft"
    }
  ]
}
\`\`\``);

    await wrapper.get('[data-outline-chat-input]').setValue('请重排第一幕节点');
    await wrapper.get('[data-outline-action="send-chat"]').trigger('click');
    await flushAsyncUpdates();

    expect(store.activeSession?.messages).toHaveLength(2);
    expect(store.activeSession?.snapshots).toHaveLength(1);
    expect(wrapper.find('[data-outline-parse-warning]').exists()).toBe(false);
    expect(wrapper.get('[data-outline-snapshot-list]').text()).toContain('草案 #1');

    await wrapper.get('[data-outline-chat-message]').trigger('click');
    expect(wrapper.find('[data-outline-message-preview-modal]').exists()).toBe(true);
    expect(wrapper.get('[data-outline-message-preview-modal]').text()).toContain('请重排第一幕节点');

    await wrapper.get('[data-outline-action="close-message-preview"]').trigger('click');
    expect(wrapper.find('[data-outline-message-preview-modal]').exists()).toBe(false);

    await wrapper.get('[data-outline-snapshot-item]').trigger('click');
    expect(wrapper.find('[data-outline-snapshot-structured-modal]').exists()).toBe(true);
    expect(wrapper.get('[data-outline-snapshot-structured-modal]').text()).toContain('故事线');
    expect(wrapper.get('[data-outline-snapshot-structured-modal]').text()).toContain('大纲节点');
  });

  it('should trigger @ mention popup and add selected mention chip in outline chat input', async () => {
    const wrapper = mount(WritingOutlinePanel);
    const store = useOutlineStore();

    store.setAIConfig({ enabled: true });
    await wrapper.get('[data-outline-action="create-session"]').trigger('click');

    const chatInput = wrapper.get('[data-outline-chat-input]');
    await chatInput.setValue('@主');
    await flushAsyncUpdates();

    const mentionPopup = wrapper.find('[data-outline-mention-popup]');
    expect(mentionPopup.exists()).toBe(true);

    const mentionItems = wrapper.findAll('[data-outline-mention-item]');
    expect(mentionItems.length).toBeGreaterThan(0);

    await chatInput.trigger('keydown', { key: 'Enter' });
    await flushAsyncUpdates();

    expect(wrapper.find('[data-outline-mention-popup]').exists()).toBe(false);

    const chipList = wrapper.find('[data-outline-mention-chip-list]');
    expect(chipList.exists()).toBe(true);
    expect(chipList.text()).toContain('本轮引用');

    const textareaElement = chatInput.element as HTMLTextAreaElement;
    expect(textareaElement.value).not.toContain('@主');

    await wrapper.get('[data-outline-action="remove-outline-mention"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.find('[data-outline-mention-chip-list]').exists()).toBe(false);
  });

  it('should switch mention source filters and support ArrowLeft/ArrowRight quick switching', async () => {
    const wrapper = mount(WritingOutlinePanel);
    const store = useOutlineStore();
    const foundationStore = useFoundationStore();

    foundationStore.patchModule('positioning', {
      title: '星图设定',
    });
    const storylineId = store.storylines[0]?.id ?? '';
    store.appendMasterOutlineNode({
      id: 'node-source-filter',
      storylineId,
      title: '星序节点',
      summary: '用于筛选测试',
      chapterStart: 1,
      chapterEnd: 2,
      status: 'draft',
    });

    store.setAIConfig({ enabled: true });
    await wrapper.get('[data-outline-action="create-session"]').trigger('click');

    const chatInput = wrapper.get('[data-outline-chat-input]');
    await chatInput.setValue('@星');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-outline-mention-source-filter-group]').exists()).toBe(true);

    const readCandidateKinds = () => wrapper.findAll('[data-outline-mention-item]').map(item => item.attributes('data-outline-mention-source-kind'));

    await wrapper.get('[data-outline-mention-source-filter="node"]').trigger('mousedown');
    await flushAsyncUpdates();

    const nodeKinds = readCandidateKinds();
    expect(nodeKinds.length).toBeGreaterThan(0);
    expect(nodeKinds.every(kind => kind === 'node')).toBe(true);

    await chatInput.trigger('keydown', { key: 'ArrowRight' });
    await flushAsyncUpdates();

    const allKinds = readCandidateKinds();
    expect(allKinds).toContain('foundation');

    await chatInput.trigger('keydown', { key: 'ArrowRight' });
    await flushAsyncUpdates();

    const foundationKinds = readCandidateKinds();
    expect(foundationKinds.length).toBeGreaterThan(0);
    expect(foundationKinds.every(kind => kind === 'foundation')).toBe(true);
  });

  it('should support selecting worldbook_entry mention candidates from enabled worldbooks', async () => {
    const wrapper = mount(WritingOutlinePanel);
    const store = useOutlineStore();

    store.setAIConfig({ enabled: true });
    await wrapper.get('[data-outline-action="create-session"]').trigger('click');

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

    const chatInput = wrapper.get('[data-outline-chat-input]');
    await chatInput.setValue('@帝都');
    await flushAsyncUpdates();

    const mentionPopup = wrapper.find('[data-outline-mention-popup]');
    expect(mentionPopup.exists()).toBe(true);
    expect(mentionPopup.text()).toContain('世界书条目');

    const entryCandidate = wrapper.findAll('[data-outline-mention-item]').find(item => item.text().includes('帝都（主线词典）'));
    expect(entryCandidate).toBeTruthy();

    await entryCandidate!.trigger('mousedown');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-outline-mention-popup]').exists()).toBe(false);
    expect(wrapper.get('[data-outline-mention-chip-list]').text()).toContain('帝都（主线词典）');

    generateRawMock.mockResolvedValue('先确认范围。');
    await chatInput.setValue('请参考该条目给建议');
    await wrapper.get('[data-outline-action="send-chat"]').trigger('click');
    await flushAsyncUpdates();

    const userMessage = store.activeSession?.messages[0];
    expect(userMessage?.mentions).toEqual([
      {
        kind: 'worldbook_entry',
        id: 'worldbook-entry:%E4%B8%BB%E7%BA%BF%E8%AF%8D%E5%85%B8:11',
        label: '帝都（主线词典）',
      },
    ]);
    expect((userMessage?.mentionSnapshots ?? []).some(snapshot => snapshot.kind === 'worldbook_entry')).toBe(true);
  });

  it('should freeze @ mention snapshots at send time and persist on user message metadata', async () => {
    const wrapper = mount(WritingOutlinePanel);
    const store = useOutlineStore();

    store.setAIConfig({ enabled: true });
    await wrapper.get('[data-outline-action="create-session"]').trigger('click');

    generateRawMock.mockResolvedValue('先确认范围。');

    const chatInput = wrapper.get('[data-outline-chat-input]');
    await chatInput.setValue('@主');
    await flushAsyncUpdates();
    await chatInput.trigger('keydown', { key: 'Enter' });
    await flushAsyncUpdates();

    await chatInput.setValue('请结合引用内容给建议');

    await wrapper.get('[data-outline-action="send-chat"]').trigger('click');
    await flushAsyncUpdates();

    const userMessage = store.activeSession?.messages[0];
    expect((userMessage?.mentions?.length ?? 0) > 0).toBe(true);
    expect((userMessage?.mentionSnapshots?.length ?? 0) > 0).toBe(true);
    expect(userMessage?.mentionWarnings).toBeUndefined();
  });

  it('should support retrying and deleting the last chat request through workbench confirm modal', async () => {
    const wrapper = mount(WritingOutlinePanel);
    const store = useOutlineStore();

    store.setAIConfig({ enabled: true });
    await wrapper.get('[data-outline-action="create-session"]').trigger('click');

    expect(wrapper.get('[data-outline-action="retry-last-chat-request"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-outline-action="delete-last-chat-request"]').attributes('disabled')).toBeDefined();

    generateRawMock
      .mockResolvedValueOnce(`已生成第一版结构。\n\n\`\`\`json
{
  "storylines": [{ "id": "line-main", "type": "main", "title": "主线", "description": "初版", "status": "draft" }],
  "nodes": [{ "id": "node-old", "storylineId": "line-main", "title": "旧节点", "summary": "旧", "chapterStart": 1, "chapterEnd": 2, "phase": "setup", "status": "draft" }]
}
\`\`\``)
      .mockResolvedValueOnce(`已按同一请求重试并优化。\n\n\`\`\`json
{
  "storylines": [{ "id": "line-main", "type": "main", "title": "主线", "description": "重试版", "status": "draft" }],
  "nodes": [{ "id": "node-new", "storylineId": "line-main", "title": "新节点", "summary": "新", "chapterStart": 1, "chapterEnd": 3, "phase": "setup", "status": "draft" }]
}
\`\`\``);

    await wrapper.get('[data-outline-chat-input]').setValue('请给我第一幕节点');
    await wrapper.get('[data-outline-action="send-chat"]').trigger('click');
    await flushAsyncUpdates();

    expect(store.activeSession?.messages).toHaveLength(2);
    expect(store.activeSession?.snapshots).toHaveLength(1);

    await wrapper.get('[data-outline-action="retry-last-chat-request"]').trigger('click');
    await flushAsyncUpdates();
    await flushAsyncUpdates();

    expect(store.activeSession?.messages).toHaveLength(2);
    expect(store.activeSession?.messages[0]?.text).toBe('请给我第一幕节点');
    expect(store.activeSession?.messages[1]?.text).toContain('优化');
    expect(store.activeSession?.snapshots).toHaveLength(1);
    expect(store.activeSession?.snapshots[0]?.masterOutline[0]?.title).toBe('新节点');
    expect(generateRawMock).toHaveBeenCalledTimes(2);

    await wrapper.get('[data-outline-action="delete-last-chat-request"]').trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-outline-delete-request-modal]').exists()).toBe(true);
    await wrapper.get('[data-outline-delete-request-action="cancel"]').trigger('click');
    await flushAsyncUpdates();

    expect(store.activeSession?.messages).toHaveLength(2);
    expect(store.activeSession?.snapshots).toHaveLength(1);

    await wrapper.get('[data-outline-action="delete-last-chat-request"]').trigger('click');
    await flushAsyncUpdates();
    await wrapper.get('[data-outline-delete-request-action="confirm"]').trigger('click');
    await flushAsyncUpdates();

    expect(store.activeSession?.messages).toHaveLength(0);
    expect(store.activeSession?.snapshots).toHaveLength(0);
    expect(wrapper.get('[data-outline-action="retry-last-chat-request"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-outline-action="delete-last-chat-request"]').attributes('disabled')).toBeDefined();
  });

  it('should pre-disable compatibility generation buttons until foundation minimum readiness is met', async () => {
    const wrapper = mount(WritingOutlinePanel);

    expect(wrapper.get('[data-workbench-outline-action="generate-master"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-workbench-outline-action="derive-details"]').attributes('disabled')).toBeDefined();

    satisfyMinimumFoundationReadiness();
    await flushAsyncUpdates();

    expect(wrapper.get('[data-workbench-outline-action="generate-master"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[data-workbench-outline-action="derive-details"]').attributes('disabled')).toBeDefined();

    seedMasterOutlineNode();
    await flushAsyncUpdates();

    expect(wrapper.get('[data-workbench-outline-action="derive-details"]').attributes('disabled')).toBeUndefined();
  });

  it('should render generation reminder modal and continue master generation only after explicit confirmation', async () => {
    const wrapper = mount(WritingOutlinePanel);
    const store = useOutlineStore();
    const storylineId = store.storylines[0]?.id ?? '';

    store.setAIConfig({ enabled: true });
    satisfyMinimumFoundationReadiness();
    await flushAsyncUpdates();
    generateMasterOutlineByAIMock.mockResolvedValue([
      {
        id: 'node-panel-generated',
        storylineId,
        title: '面板生成节点',
        summary: '通过正式弹窗确认后执行',
        chapterStart: 1,
        chapterEnd: 3,
        turningPoints: [],
        phase: 'setup',
        status: 'draft',
      },
    ]);

    await wrapper.get('[data-workbench-outline-action="generate-master"]').trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-foundation-generation-reminder-modal]').exists()).toBe(true);
    expect(wrapper.get('[data-foundation-generation-reminder-modal]').text()).toContain('继续生成总纲');

    await wrapper.get('[data-foundation-generation-action="cancel-reminder"]').trigger('click');
    await flushAsyncUpdates();
    expect(generateMasterOutlineByAIMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-foundation-generation-reminder-modal]').exists()).toBe(false);

    await wrapper.get('[data-workbench-outline-action="generate-master"]').trigger('click');
    await flushAsyncUpdates();
    await wrapper.get('[data-foundation-generation-action="confirm-reminder"]').trigger('click');
    await flushAsyncUpdates();

    expect(generateMasterOutlineByAIMock).toHaveBeenCalledTimes(1);
    expect(store.masterOutline[0]?.title).toBe('面板生成节点');
  });

  it('should keep details when applying snapshot safely and show applied badge with disabled button', async () => {
    const wrapper = mount(WritingOutlinePanel);
    const store = useOutlineStore();

    store.setChapterDetail({
      chapter: 2,
      parentNodeId: '',
      title: '旧细纲',
      goal: '旧目标',
      conflict: '旧冲突',
      beats: ['旧节拍'],
      mustInclude: [],
      mustAvoid: [],
      status: 'draft',
    });

    const session = store.createSession({
      type: 'outline_chat',
      title: '快照应用测试',
    });

    store.appendSnapshot(session.id, {
      detailsByChapter: {
        2: {
          chapter: 2,
          parentNodeId: '',
          title: '新细纲',
          goal: '新目标',
          conflict: '新冲突',
          beats: ['新节拍'],
          mustInclude: [],
          mustAvoid: [],
          status: 'draft',
        },
      },
    });

    await flushAsyncUpdates();

    // 默认应用不覆盖细纲
    await wrapper.get('[data-outline-action="apply-snapshot-safe"]').trigger('click');
    expect(store.getChapterDetail(2)?.title).toBe('旧细纲');

    // 页面上不再出现 apply-with-details 按钮和确认框
    expect(wrapper.find('[data-outline-action="apply-snapshot-with-details"]').exists()).toBe(false);
    expect(wrapper.find('[data-outline-apply-details-confirm]').exists()).toBe(false);

    await flushAsyncUpdates();

    // 应用后显示已应用标识
    expect(wrapper.find('[data-outline-snapshot-applied-badge]').exists()).toBe(true);

    // 应用按钮应被禁用
    const applyButton = wrapper.get('[data-outline-action="apply-snapshot-safe"]');
    expect(applyButton.attributes('disabled')).toBeDefined();
    expect(applyButton.text()).toContain('已应用');
  });

  it('should collapse and expand step panels', async () => {
    const wrapper = mount(WritingOutlinePanel);

    expect(wrapper.get('[data-outline-step-content="4-node-edit"]').attributes('style') ?? '').not.toContain('display: none');

    await wrapper.get('[data-outline-action="toggle-step-4-node-edit"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.get('[data-outline-action="toggle-step-4-node-edit"]').text()).toContain('展开');
    expect(wrapper.get('[data-outline-step-content="4-node-edit"]').attributes('style') ?? '').toContain('display: none');

    await wrapper.get('[data-outline-action="toggle-step-4-node-edit"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.get('[data-outline-action="toggle-step-4-node-edit"]').text()).toContain('收起');
    expect(wrapper.get('[data-outline-step-content="4-node-edit"]').attributes('style') ?? '').not.toContain('display: none');

    await wrapper.get('[data-outline-action="create-session"]').trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.get('[data-outline-step-content="2-chat"]').attributes('style') ?? '').not.toContain('display: none');
    await wrapper.get('[data-outline-action="toggle-step-2-chat"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.get('[data-outline-action="toggle-step-2-chat"]').text()).toContain('展开');
    expect(wrapper.get('[data-outline-step-content="2-chat"]').attributes('style') ?? '').toContain('display: none');
  });

  it('should show node tips before selecting storyline and filter nodes after selecting storyline card', async () => {
    const store = useOutlineStore();
    const lineA = store.createStoryline({ title: '__line_A__', type: 'main', status: 'draft' });
    const lineB = store.createStoryline({ title: '__line_B__', type: 'subplot', status: 'draft' });

    store.appendMasterOutlineNode({
      title: '__node_A__',
      chapterStart: 1,
      chapterEnd: 1,
      summary: 'A',
      turningPoints: [],
      storylineId: lineA.id,
      phase: 'setup',
      status: 'draft',
    });

    store.appendMasterOutlineNode({
      title: '__node_B__',
      chapterStart: 2,
      chapterEnd: 2,
      summary: 'B',
      turningPoints: [],
      storylineId: lineB.id,
      phase: 'confrontation',
      status: 'draft',
    });

    const wrapper = mount(WritingOutlinePanel);

    expect(wrapper.find('[data-outline-node-tip]').exists()).toBe(true);

    const targetCard = wrapper.findAll('[data-outline-storyline-card]').find(card => card.text().includes('__line_B__'));
    expect(targetCard).toBeTruthy();

    await targetCard!.trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-outline-node-tip]').exists()).toBe(false);
    const filteredList = wrapper.get('[data-outline-filtered-node-list]');
    expect(filteredList.find('input[value="__node_B__"]').exists()).toBe(true);
    expect(filteredList.find('input[value="__node_A__"]').exists()).toBe(false);
    expect(filteredList.find('input[value="2"]').exists()).toBe(true);
  });

  it('should update storyline and node enums via dropdown selects', async () => {
    const store = useOutlineStore();
    const line = store.createStoryline({ title: '__dropdown_line__', type: 'main', status: 'draft' });

    store.appendMasterOutlineNode({
      id: 'node-dropdown-select',
      title: '__node_dropdown__',
      chapterStart: 4,
      chapterEnd: 5,
      summary: 'dropdown test',
      turningPoints: [],
      storylineId: line.id,
      phase: 'setup',
      status: 'draft',
    });

    const wrapper = mount(WritingOutlinePanel);

    const targetCard = wrapper.findAll('[data-outline-storyline-card]').find(card => card.text().includes('__dropdown_line__'));
    expect(targetCard).toBeTruthy();

    await targetCard!.trigger('click');
    await flushAsyncUpdates();

    await wrapper.get('[data-outline-storyline-type-select]').trigger('click');
    await wrapper.get('[data-outline-storyline-type-option="parallel"]').trigger('click');
    await flushAsyncUpdates();

    await wrapper.get('[data-outline-storyline-status-select]').trigger('click');
    await wrapper.get('[data-outline-storyline-status-option="approved"]').trigger('click');
    await flushAsyncUpdates();

    await wrapper.get('[data-outline-node-status-select]').trigger('click');
    await wrapper.get('[data-outline-node-status-option="approved"]').trigger('click');
    await flushAsyncUpdates();

    await wrapper.get('[data-outline-node-phase-select]').trigger('click');
    await wrapper.get('[data-outline-node-phase-option="climax"]').trigger('click');
    await flushAsyncUpdates();

    expect(store.storylines.find(storyline => storyline.id === line.id)?.type).toBe('parallel');
    expect(store.storylines.find(storyline => storyline.id === line.id)?.status).toBe('approved');
    expect(store.masterOutline.find(node => node.id === 'node-dropdown-select')?.status).toBe('approved');
    expect(store.masterOutline.find(node => node.id === 'node-dropdown-select')?.phase).toBe('climax');
  });

  it('should emit outline help event when clicking help trigger', async () => {
    const wrapper = mount(WritingOutlinePanel);

    await wrapper.get('[data-outline-help-trigger="overview"]').trigger('click');
    await wrapper.get('[data-outline-help-trigger="4-node-edit"]').trigger('click');

    expect(wrapper.emitted('open-help')).toEqual([['outline'], ['outline']]);
  });
});
