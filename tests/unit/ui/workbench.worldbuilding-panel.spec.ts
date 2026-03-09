import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { useOutlineStore } from '@/novelToST/stores/outline.store';
import { useWorldbuildingStore } from '@/novelToST/stores/worldbuilding.store';
import WorldbuildingPanel from '@/novelToST/ui/workbench/WorldbuildingPanel.vue';
import { stMocks } from '../../setup/st-globals.mock';

async function flushAsyncUpdates(): Promise<void> {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

describe('WorldbuildingPanel', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();

  beforeEach(() => {
    generateRawMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);

    stMocks.getLoadedPresetName.mockReturnValue('世界观写作预设');
    stMocks.getCurrentCharacterName.mockReturnValue('伊芙');
    stMocks.getPreset.mockImplementation(() => ({ prompts: [{ enabled: true }] }));

    stMocks.getWorldbookNames.mockReturnValue(['主世界书']);
    stMocks.getWorldbook.mockResolvedValue([]);
    stMocks.createWorldbookEntries.mockResolvedValue({
      worldbook: [],
      new_entries: [],
    });

    stMocks.getChatWorldbookName.mockReturnValue(null);
    stMocks.rebindChatWorldbook.mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should render step blocks + help triggers and emit open-help event', async () => {
    const wrapper = mount(WorldbuildingPanel);

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-worldbuilding-step="1-session"]').exists()).toBe(true);
    expect(wrapper.find('[data-worldbuilding-step="2-collaboration"]').exists()).toBe(true);
    expect(wrapper.find('[data-worldbuilding-step="3-draft-locks"]').exists()).toBe(true);
    expect(wrapper.find('[data-worldbuilding-step="4-binding-commit"]').exists()).toBe(true);

    await wrapper.get('[data-worldbuilding-help-trigger="2-collaboration"]').trigger('click');

    expect(wrapper.emitted('open-help')).toEqual([['worldbuilding']]);
  });

  it('should support collapsing and expanding every step block', async () => {
    const wrapper = mount(WorldbuildingPanel);

    const step1Content = wrapper.get('[data-worldbuilding-step-content="1-session"]');
    expect((step1Content.element as HTMLElement).style.display).toBe('');

    await wrapper.get('[data-worldbuilding-action="toggle-step-1-session"]').trigger('click');
    expect((step1Content.element as HTMLElement).style.display).toBe('none');

    await wrapper.get('[data-worldbuilding-action="toggle-step-1-session"]').trigger('click');
    expect((step1Content.element as HTMLElement).style.display).toBe('');

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    await flushAsyncUpdates();

    const sessionInfoPanel = wrapper.get('[data-worldbuilding-session-info-panel]');
    expect((sessionInfoPanel.element as HTMLElement).style.display).toBe('');

    await wrapper.get('[data-worldbuilding-action="toggle-step-1-session"]').trigger('click');
    expect((step1Content.element as HTMLElement).style.display).toBe('none');
    expect((sessionInfoPanel.element as HTMLElement).style.display).toBe('none');

    await wrapper.get('[data-worldbuilding-action="toggle-step-1-session"]').trigger('click');
    expect((step1Content.element as HTMLElement).style.display).toBe('');
    expect((sessionInfoPanel.element as HTMLElement).style.display).toBe('');

    const collapsibleSteps = ['2-collaboration', '3-draft-locks', '4-binding-commit'] as const;

    for (const stepId of collapsibleSteps) {
      const content = wrapper.get(`[data-worldbuilding-step-content="${stepId}"]`);
      expect((content.element as HTMLElement).style.display).toBe('');
      await wrapper.get(`[data-worldbuilding-action="toggle-step-${stepId}"]`).trigger('click');
      expect((content.element as HTMLElement).style.display).toBe('none');

      await wrapper.get(`[data-worldbuilding-action="toggle-step-${stepId}"]`).trigger('click');
      expect((content.element as HTMLElement).style.display).toBe('');
    }

    expect(wrapper.find('[data-worldbuilding-chat]').exists()).toBe(true);
    expect(wrapper.find('[data-worldbuilding-draft]').exists()).toBe(true);
    expect(wrapper.find('[data-worldbuilding-commit]').exists()).toBe(true);
  });

  it('should default commit target to current chat worldbook binding', async () => {
    stMocks.getChatWorldbookName.mockReturnValue('主世界书');

    mount(WorldbuildingPanel);
    const store = useWorldbuildingStore();
    await flushAsyncUpdates();

    expect(store.selectedWorldbookName).toBe('主世界书');
  });

  it('should run expand action and render conversation + updated draft', async () => {
    const wrapper = mount(WorldbuildingPanel);
    const store = useWorldbuildingStore();

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    expect(store.sessionCount).toBe(1);

    generateRawMock.mockResolvedValue(
      JSON.stringify({
        assistantReply: '我已补全角色主线。',
        draft: {
          name: '林川',
          aliases: ['边境猎犬'],
          summary: '边境侦察兵，受命潜入王都。',
          facts: ['擅长潜行'],
          constraints: ['不主动泄密'],
          relations: [{ target: '伊芙', relation: '线人' }],
          extra: { age: 24 },
        },
      }),
    );

    await wrapper.get('[data-worldbuilding-input]').setValue('补充角色背景');
    await wrapper.get('[data-worldbuilding-action="expand"]').trigger('click');
    await flushAsyncUpdates();
    await vi.waitFor(() => {
      expect(store.activeSession?.messages).toHaveLength(2);
    });
    await flushAsyncUpdates();

    expect(store.activeSession?.versions).toHaveLength(2);
    expect(wrapper.get('[data-worldbuilding-chat-list]').text()).toContain('补充角色背景');
    expect(wrapper.get('[data-worldbuilding-chat-list]').text()).toContain('我已补全角色主线');
    expect(wrapper.get('[data-worldbuilding-draft]').text()).toContain('林川');
    expect(wrapper.find('[data-worldbuilding-parse-warning]').exists()).toBe(false);
  });

  it('should support @ mention in collaboration input and include mention context in ai request', async () => {
    const wrapper = mount(WorldbuildingPanel);
    const worldbuildingStore = useWorldbuildingStore();
    const foundationStore = useFoundationStore();

    foundationStore.patchModule('positioning', {
      title: '星图设定',
    });


    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    expect(worldbuildingStore.sessionCount).toBe(1);

    generateRawMock.mockResolvedValue(
      JSON.stringify({
        assistantReply: '已补全主角背景。',
        draft: {
          name: '林川',
          aliases: ['边境猎犬'],
          summary: '边境侦察兵，受命潜入王都。',
          facts: ['擅长潜行'],
          constraints: ['不主动泄密'],
          relations: [{ target: '伊芙', relation: '线人' }],
          extra: { age: 24 },
        },
      }),
    );

    const chatInput = wrapper.get('[data-worldbuilding-input]');
    await chatInput.setValue('@星');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-worldbuilding-mention-popup]').exists()).toBe(true);
    expect(wrapper.findAll('[data-worldbuilding-mention-item]').length).toBeGreaterThan(0);

    await chatInput.trigger('keydown', { key: 'Enter' });
    await flushAsyncUpdates();

    expect(wrapper.find('[data-worldbuilding-mention-popup]').exists()).toBe(false);
    expect(wrapper.find('[data-worldbuilding-mention-chip-list]').exists()).toBe(true);

    await chatInput.setValue('请结合引用内容补全背景');
    await wrapper.get('[data-worldbuilding-action="expand"]').trigger('click');
    await flushAsyncUpdates();

    const requestPayload = generateRawMock.mock.calls[0]?.[0];
    expect(requestPayload?.user_input ?? '').toContain('引用上下文（来自@）：');
    expect(requestPayload?.user_input ?? '').toContain('【故事基底】星图设定');
  });

  it('should switch worldbuilding mention source filters and support ArrowLeft/ArrowRight quick switching', async () => {
    const wrapper = mount(WorldbuildingPanel);
    const worldbuildingStore = useWorldbuildingStore();
    const foundationStore = useFoundationStore();
    const outlineStore = useOutlineStore();

    foundationStore.patchModule('positioning', {
      title: '星图设定',
    });

    const storylineId = outlineStore.storylines[0]?.id ?? '';
    outlineStore.appendMasterOutlineNode({
      id: 'node-worldbuilding-source-filter',
      storylineId,
      title: '星序节点',
      summary: '用于筛选测试',
      chapterStart: 1,
      chapterEnd: 2,
      status: 'draft',
    });

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    expect(worldbuildingStore.sessionCount).toBe(1);

    const chatInput = wrapper.get('[data-worldbuilding-input]');
    await chatInput.setValue('@星');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-worldbuilding-mention-source-filter-group]').exists()).toBe(true);

    const readCandidateKinds = () =>
      wrapper.findAll('[data-worldbuilding-mention-item]').map(item => item.attributes('data-worldbuilding-mention-kind'));

    await wrapper.get('[data-worldbuilding-mention-source-filter="node"]').trigger('mousedown');
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

    await chatInput.trigger('keydown', { key: 'ArrowLeft' });
    await flushAsyncUpdates();

    const backToAllKinds = readCandidateKinds();
    expect(backToAllKinds).toContain('node');
  });

  it('should display parse warning when ai response has no structured json', async () => {
    const wrapper = mount(WorldbuildingPanel);
    const store = useWorldbuildingStore();

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');

    generateRawMock.mockResolvedValue('我认为当前设定仍需补齐关键时间线。');

    await wrapper.get('[data-worldbuilding-action="refine"]').trigger('click');
    await flushAsyncUpdates();
    await vi.waitFor(() => {
      expect(store.activeSession?.messages).toHaveLength(2);
    });
    await flushAsyncUpdates();

    expect(store.activeSession?.versions).toHaveLength(1);
    expect(wrapper.get('[data-worldbuilding-parse-warning]').text()).toContain('结构化解析失败');
  });

  it('should require selecting target worldbook before opening commit confirmation', async () => {
    stMocks.getWorldbookNames.mockReturnValue([]);

    const wrapper = mount(WorldbuildingPanel);
    const store = useWorldbuildingStore();

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    store.setCandidates([
      {
        id: 'candidate-1',
        category: '角色',
        name: '林川',
        keywords: ['林川'],
        content: '边境侦察兵。',
        strategy: 'selective',
        checked: true,
      },
    ]);
    await flushAsyncUpdates();

    const commitButton = wrapper.get('[data-worldbuilding-action="open-commit-confirm"]');
    expect(commitButton.attributes('disabled')).toBeDefined();
  });

  it('should support session update and delete operations', async () => {
    const wrapper = mount(WorldbuildingPanel);
    const store = useWorldbuildingStore();

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    expect(store.sessionCount).toBe(1);

    await wrapper.get('[data-worldbuilding-session-edit-title]').setValue('更新后的会话');
    await wrapper.get('[data-worldbuilding-session-edit-type]').trigger('click');
    await wrapper.get('[data-worldbuilding-session-edit-type-option="location"]').trigger('click');
    await wrapper.get('[data-worldbuilding-session-edit-seed]').setValue('更新后的种子');
    await wrapper.get('[data-worldbuilding-action="apply-session-edit"]').trigger('click');
    await flushAsyncUpdates();

    expect(store.activeSession?.title).toBe('更新后的会话');
    expect(store.activeSession?.type).toBe('location');
    expect(store.activeSession?.seed).toBe('更新后的种子');

    await wrapper.get('[data-worldbuilding-action="open-remove-session-confirm"]').trigger('click');
    expect(wrapper.find('[data-worldbuilding-remove-session-confirm-modal]').exists()).toBe(true);

    await wrapper.get('[data-worldbuilding-action="confirm-remove-session"]').trigger('click');
    await flushAsyncUpdates();

    expect(store.sessionCount).toBe(0);
    expect(wrapper.find('[data-worldbuilding-empty]').exists()).toBe(true);
  });

  it('should build preview and commit candidates with receipt', async () => {
    stMocks.getWorldbook.mockResolvedValue([
      {
        name: '灰港',
        strategy: {
          keys: ['灰港'],
        },
      },
    ]);

    stMocks.createWorldbookEntries.mockResolvedValue({
      worldbook: [],
      new_entries: [{ name: '灰港 (2)' }, { name: '影盟' }],
    });

    const wrapper = mount(WorldbuildingPanel);
    const store = useWorldbuildingStore();

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    store.setCandidates([
      {
        id: 'candidate-1',
        category: '地点',
        name: '灰港',
        keywords: ['灰港'],
        content: '边境港口。',
        strategy: 'selective',
        checked: true,
      },
      {
        id: 'candidate-2',
        category: '势力',
        name: '影盟',
        keywords: ['影盟'],
        content: '地下情报组织。',
        strategy: 'constant',
        checked: true,
      },
    ]);

    await flushAsyncUpdates();

    await wrapper.get('[data-worldbuilding-worldbook-select]').trigger('click');
    await wrapper.get('[data-worldbuilding-worldbook-option="主世界书"]').trigger('click');
    await wrapper.get('[data-worldbuilding-action="build-commit-preview"]').trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.get('[data-worldbuilding-commit-preview]').text()).toContain('同名 1 条');

    await wrapper.get('[data-worldbuilding-action="open-commit-confirm"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.find('[data-worldbuilding-commit-confirm-modal]').exists()).toBe(true);

    await wrapper.get('[data-worldbuilding-action="confirm-commit"]').trigger('click');
    await flushAsyncUpdates();

    expect(stMocks.createWorldbookEntries).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-worldbuilding-commit-receipt]').text()).toContain('成功 2 条');
    expect(wrapper.get('[data-worldbuilding-commit-receipt]').text()).toContain('重命名 1 条');
  });

  it('should sync committed candidates to foundation when enabled', async () => {
    stMocks.createWorldbookEntries.mockResolvedValue({
      worldbook: [],
      new_entries: [{ name: '林川' }, { name: '边境法则' }],
    });

    const wrapper = mount(WorldbuildingPanel);
    const store = useWorldbuildingStore();
    const foundationStore = useFoundationStore();

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    store.setCandidates([
      {
        id: 'candidate-1',
        category: '角色',
        name: '林川',
        keywords: ['林川'],
        content: '边境侦察兵。',
        strategy: 'selective',
        checked: true,
      },
      {
        id: 'candidate-2',
        category: '规则体系',
        name: '边境法则',
        keywords: ['边境法则'],
        content: '夜间宵禁。',
        strategy: 'constant',
        checked: true,
      },
    ]);

    await flushAsyncUpdates();

    await wrapper.get('[data-worldbuilding-worldbook-select]').trigger('click');
    await wrapper.get('[data-worldbuilding-worldbook-option="主世界书"]').trigger('click');
    await wrapper.get('[data-worldbuilding-outline-sync-toggle]').setValue(true);

    await wrapper.get('[data-worldbuilding-action="open-commit-confirm"]').trigger('click');
    await flushAsyncUpdates();
    await wrapper.get('[data-worldbuilding-action="confirm-commit"]').trigger('click');
    await flushAsyncUpdates();

    expect(
      foundationStore.foundation.keyRelations.keyCharacters.some(character => character.name === '林川'),
    ).toBe(true);
    expect(foundationStore.foundation.worldBrief.requiredRules).toContain('边境法则：夜间宵禁。');
    expect(wrapper.find('[data-worldbuilding-outline-sync-receipt]').exists()).toBe(true);
  });

  it('should render locked fields in Chinese labels only', async () => {
    const wrapper = mount(WorldbuildingPanel);

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    await flushAsyncUpdates();

    const lockedFieldText = wrapper.get('[data-worldbuilding-locked-fields]').text();
    expect(lockedFieldText).toContain('名称');
    expect(lockedFieldText).toContain('别名');
    expect(lockedFieldText).toContain('摘要');
    expect(lockedFieldText).toContain('事实要点');
    expect(lockedFieldText).toContain('约束');
    expect(lockedFieldText).toContain('关系');
    expect(lockedFieldText).toContain('扩展字段');
    expect(lockedFieldText).not.toContain('aliases');
  });

  it('should bind selected target worldbook to current chat by one click', async () => {
    stMocks.getChatWorldbookName.mockReturnValue(null);
    stMocks.rebindChatWorldbook.mockImplementation(async (_chatName, worldbookName) => {
      stMocks.getChatWorldbookName.mockReturnValue(worldbookName);
    });

    const wrapper = mount(WorldbuildingPanel);
    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    await flushAsyncUpdates();

    await wrapper.get('[data-worldbuilding-worldbook-select]').trigger('click');
    await wrapper.get('[data-worldbuilding-worldbook-option="主世界书"]').trigger('click');
    await wrapper.get('[data-worldbuilding-action="bind-chat-worldbook"]').trigger('click');
    await flushAsyncUpdates();

    expect(stMocks.rebindChatWorldbook).toHaveBeenCalledWith('current', '主世界书');
    expect(wrapper.get('[data-worldbuilding-chat-binding-name]').text()).toContain('主世界书');
  });
});
