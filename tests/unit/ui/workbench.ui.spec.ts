
import { mount } from '@vue/test-utils';
import { WORKBENCH_CLOSE_EVENT } from '@/novelToST/app/workbench.events';
import { useWorkbenchStore } from '@/novelToST/stores/workbench.store';
import WorkbenchRoot from '@/novelToST/ui/workbench/WorkbenchRoot.vue';

const generationControlMock = vi.hoisted(() => ({
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
  refreshPreview: vi.fn(),
}));

vi.mock('@/novelToST/composables/useGenerationControl', () => ({
  useGenerationControl: () => generationControlMock,
}));

describe('WorkbenchRoot', () => {
  beforeEach(() => {
    generationControlMock.start.mockClear();
    generationControlMock.pause.mockClear();
    generationControlMock.resume.mockClear();
    generationControlMock.stop.mockClear();
    generationControlMock.reset.mockClear();
    generationControlMock.refreshPreview.mockClear();
  });

  it('should switch between writing and generation primary tabs', async () => {
    const store = useWorkbenchStore();
    const wrapper = mount(WorkbenchRoot, { shallow: true });

    expect(store.primaryTab).toBe('writing');

    await wrapper.get('[data-workbench-primary-tab="generation"]').trigger('click');
    expect(store.primaryTab).toBe('generation');

    await wrapper.get('[data-workbench-primary-tab="writing"]').trigger('click');
    expect(store.primaryTab).toBe('writing');
  });

  it('should switch writing subtabs and expose foundation/worldbuilding panel slots', async () => {
    const store = useWorkbenchStore();
    const wrapper = mount(WorkbenchRoot, { shallow: true });

    await wrapper.get('[data-workbench-primary-tab="writing"]').trigger('click');

    expect(store.writingTab).toBe('foundation');
    expect(wrapper.find('[data-workbench-view="foundation"]').exists()).toBe(true);
    expect(wrapper.get('[data-workbench-writing-hint]').text()).toContain('先把故事基底写清楚');

    await wrapper.get('[data-workbench-writing-tab="worldbuilding"]').trigger('click');
    expect(store.writingTab).toBe('worldbuilding');
    expect(wrapper.find('[data-workbench-view="worldbuilding"]').exists()).toBe(true);
    expect(wrapper.get('[data-workbench-writing-hint]').text()).toContain('与故事基底保持一致');

    await wrapper.get('[data-workbench-writing-tab="outline"]').trigger('click');
    expect(store.writingTab).toBe('outline');
    expect(wrapper.get('[data-workbench-writing-hint]').text()).toContain('构建你的故事骨架');
    expect(wrapper.find('[data-workbench-view="outline"]').exists()).toBe(true);

    await wrapper.get('[data-workbench-writing-tab="detail"]').trigger('click');
    expect(store.writingTab).toBe('detail');
    expect(wrapper.get('[data-workbench-writing-hint]').text()).toContain('详细细纲');
    expect(wrapper.find('[data-workbench-detail-chapter]').exists()).toBe(true);

    await wrapper.get('[data-workbench-writing-tab="llm"]').trigger('click');
    expect(store.writingTab).toBe('llm');
    expect(wrapper.get('[data-workbench-writing-hint]').text()).toContain('配置 AI 连接');
    expect(wrapper.find('[data-workbench-view="llm"]').exists()).toBe(true);
  });

  it('should render detail chapter placeholder when opened with detail tab payload', () => {
    const store = useWorkbenchStore();
    store.openWithDetail({ tab: 'detail', chapter: 18 });

    const wrapper = mount(WorkbenchRoot, { shallow: true });

    expect(wrapper.find('[data-workbench-view="writing"]').exists()).toBe(true);
    expect(wrapper.get('[data-workbench-detail-chapter]').text()).toContain('第 18 章');
  });

  it('should dispatch close event when clicking close action', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const wrapper = mount(WorkbenchRoot, { shallow: true });

    await wrapper.get('[data-workbench-action="close"]').trigger('click');

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls[0]?.[0]?.type).toBe(WORKBENCH_CLOSE_EVENT);
  });

  it('should refresh preview on mounted', () => {
    mount(WorkbenchRoot, { shallow: true });

    expect(generationControlMock.refreshPreview).toHaveBeenCalledTimes(1);
  });

  it('should open help modal when foundation panel emits help event', async () => {
    const wrapper = mount(WorkbenchRoot, { shallow: true });

    await wrapper.get('[data-workbench-primary-tab="writing"]').trigger('click');

    wrapper.findComponent({ name: 'FoundationPanel' }).vm.$emit('open-help', 'foundation');
    await wrapper.vm.$nextTick();

    const helpModal = wrapper.findComponent({ name: 'HelpModal' });
    expect(helpModal.props('modelValue')).toBe(true);
    expect(helpModal.props('topic')).toBe('foundation');
    expect(helpModal.props('teleportTo')).toBe(false);
  });

  it('should open help modal when worldbuilding panel emits help event', async () => {
    const wrapper = mount(WorkbenchRoot, { shallow: true });

    await wrapper.get('[data-workbench-primary-tab="writing"]').trigger('click');
    await wrapper.get('[data-workbench-writing-tab="worldbuilding"]').trigger('click');

    wrapper.findComponent({ name: 'WorldbuildingPanel' }).vm.$emit('open-help', 'worldbuilding');
    await wrapper.vm.$nextTick();

    const helpModal = wrapper.findComponent({ name: 'HelpModal' });
    expect(helpModal.props('modelValue')).toBe(true);
    expect(helpModal.props('topic')).toBe('worldbuilding');
    expect(helpModal.props('teleportTo')).toBe(false);
  });

  it('should open help modal when outline panel emits help event', async () => {
    const wrapper = mount(WorkbenchRoot, { shallow: true });

    await wrapper.get('[data-workbench-primary-tab="writing"]').trigger('click');
    await wrapper.get('[data-workbench-writing-tab="outline"]').trigger('click');

    wrapper.findComponent({ name: 'WritingOutlinePanel' }).vm.$emit('open-help', 'outline');
    await wrapper.vm.$nextTick();

    const helpModal = wrapper.findComponent({ name: 'HelpModal' });
    expect(helpModal.props('modelValue')).toBe(true);
    expect(helpModal.props('topic')).toBe('outline');
  });

  it('should open help modal when llm panel emits help event', async () => {
    const wrapper = mount(WorkbenchRoot, { shallow: true });

    await wrapper.get('[data-workbench-primary-tab="writing"]').trigger('click');
    await wrapper.get('[data-workbench-writing-tab="llm"]').trigger('click');

    wrapper.findComponent({ name: 'LLMConfigPanel' }).vm.$emit('open-help', 'llm');
    await wrapper.vm.$nextTick();

    const helpModal = wrapper.findComponent({ name: 'HelpModal' });
    expect(helpModal.props('modelValue')).toBe(true);
    expect(helpModal.props('topic')).toBe('llm');
  });

  it('should open help modal when detail panel emits help event', async () => {
    const wrapper = mount(WorkbenchRoot, { shallow: true });

    await wrapper.get('[data-workbench-primary-tab="writing"]').trigger('click');
    await wrapper.get('[data-workbench-writing-tab="detail"]').trigger('click');

    wrapper.findComponent({ name: 'WritingDetailPanel' }).vm.$emit('open-help', 'outline');
    await wrapper.vm.$nextTick();

    const helpModal = wrapper.findComponent({ name: 'HelpModal' });
    expect(helpModal.props('modelValue')).toBe(true);
    expect(helpModal.props('topic')).toBe('outline');
  });
});
