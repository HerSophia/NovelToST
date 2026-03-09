import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import FoundationPanel from '@/novelToST/ui/workbench/FoundationPanel.vue';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';

async function flushAsyncUpdates(): Promise<void> {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

describe('FoundationPanel', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();

  beforeEach(() => {
    generateRawMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should edit module fields and update progress summary', async () => {
    const wrapper = mount(FoundationPanel);
    const store = useFoundationStore();

    await wrapper.get('[data-foundation-field="positioning.genre"]').setValue('古风权谋');
    await wrapper.get('[data-foundation-field="positioning.mainType"]').setValue('权谋');
    await flushAsyncUpdates();

    expect(store.foundation.positioning.genre).toBe('古风权谋');
    expect(store.foundation.positioning.mainType).toBe('权谋');
    expect(store.moduleStatuses.positioning).toBe('complete');
    expect(wrapper.get('[data-foundation-progress-label]').text()).toContain('1 / 8');

    await wrapper.get('[data-foundation-help-trigger="overview"]').trigger('click');
    expect(wrapper.emitted('open-help')).toEqual([['foundation']]);
  });

  it('should render left rail, center editor and right rail layout', () => {
    const wrapper = mount(FoundationPanel);

    expect(wrapper.find('[data-foundation-workspace]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-left-rail]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-center-editor]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-right-rail]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-chat]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-progress]').exists()).toBe(true);
  });

  it('should render grouped toolbar controls for mode, filter and view actions', () => {
    const wrapper = mount(FoundationPanel);

    expect(wrapper.find('[data-foundation-toolbar]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-toolbar-group="mode"]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-toolbar-group="filter"]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-toolbar-group="view"]').exists()).toBe(true);
  });

  it('should mark module required fields in form labels', () => {
    const wrapper = mount(FoundationPanel);

    const genreField = wrapper.get('[data-foundation-field="positioning.genre"]');
    const titleField = wrapper.get('[data-foundation-field="positioning.title"]');
    const coreConflictField = wrapper.get('[data-foundation-field="core.coreConflict"]');
    const coreSuspenseField = wrapper.get('[data-foundation-field="core.coreSuspense"]');
    const genreLabel = wrapper.get('[data-foundation-field-label="positioning.genre"]');
    const genreRequiredMarker = wrapper.get('[data-foundation-field-required-marker="positioning.genre"]');
    const coreConflictRequiredMarker = wrapper.get('[data-foundation-field-required-marker="core.coreConflict"]');

    expect(wrapper.get('[data-foundation-required-legend]').text()).toContain('带 * 的字段，是这一块里建议先补的内容');
    expect(genreField.attributes('data-foundation-field-required')).toBe('true');
    expect(coreConflictField.attributes('data-foundation-field-required')).toBe('true');
    expect(titleField.attributes('data-foundation-field-required')).toBeUndefined();
    expect(coreSuspenseField.attributes('data-foundation-field-required')).toBeUndefined();
    expect(genreLabel.text()).toContain('题材');
    expect(genreRequiredMarker.text()).toBe('*');
    expect(coreConflictRequiredMarker.text()).toBe('*');
    expect(genreRequiredMarker.attributes('title')).toBe('这一块里建议先补的字段');
    expect(genreRequiredMarker.classes()).toContain('text-amber-300');
    expect(wrapper.find('[data-foundation-field-required-marker="positioning.title"]').exists()).toBe(false);
    expect(wrapper.find('[data-foundation-field-required-marker="core.coreSuspense"]').exists()).toBe(false);
  });

  it('should default to normal mode and hide advanced modules', () => {
    const wrapper = mount(FoundationPanel);

    expect(wrapper.get('[data-foundation-mode-current]').text()).toContain('常用模式');
    expect(wrapper.find('[data-foundation-module="positioning"]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-module="worldBrief"]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-module="narrativeRules"]').exists()).toBe(false);
    expect(wrapper.find('[data-foundation-module="endgame"]').exists()).toBe(false);
    expect(wrapper.find('[data-foundation-extensions]').exists()).toBe(false);
    expect(wrapper.get('[data-foundation-module-tier="positioning"]').text()).toContain('起步必填');
    expect(wrapper.get('[data-foundation-progress-tier="basic"]').text()).toContain('0 / 3');
    expect(wrapper.get('[data-foundation-progress-tier="advanced"]').text()).toContain('0 / 3');
  });

  it('should switch to advanced mode and render advanced modules with tier badges', async () => {
    const wrapper = mount(FoundationPanel);

    await wrapper.get('[data-foundation-mode="advanced"]').trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.get('[data-foundation-mode-current]').text()).toContain('完整模式');
    expect(wrapper.find('[data-foundation-module="narrativeRules"]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-module="endgame"]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-extensions]').exists()).toBe(true);
    expect(wrapper.get('[data-foundation-module-tier="narrativeRules"]').text()).toContain('精细控制');
    expect(wrapper.get('[data-foundation-progress-tier="intermediate"]').text()).toContain('0 / 3');
  });

  it('should filter module cards and toggle module collapse state', async () => {
    const wrapper = mount(FoundationPanel);

    expect(wrapper.get('[data-foundation-action="toggle-module-positioning"]').text()).toContain('收起');

    await wrapper.get('[data-foundation-action="toggle-module-positioning"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.get('[data-foundation-action="toggle-module-positioning"]').text()).toContain('展开');

    await wrapper.get('[data-foundation-action="toggle-module-positioning"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.get('[data-foundation-action="toggle-module-positioning"]').text()).toContain('收起');

    await wrapper.get('[data-foundation-field="positioning.genre"]').setValue('古风权谋');
    await wrapper.get('[data-foundation-field="positioning.mainType"]').setValue('权谋');
    await flushAsyncUpdates();

    await wrapper.get('[data-foundation-module-filter="complete"]').trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-foundation-module="positioning"]').exists()).toBe(true);
    expect(wrapper.find('[data-foundation-module="core"]').exists()).toBe(false);

    await wrapper.get('[data-foundation-module-filter="empty"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.find('[data-foundation-module="positioning"]').exists()).toBe(false);

    await wrapper.get('[data-foundation-module-filter="all"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.find('[data-foundation-module="core"]').exists()).toBe(true);
  });

  it('should run collaborate and apply parsed foundation patch', async () => {
    const wrapper = mount(FoundationPanel);
    const store = useFoundationStore();

    generateRawMock.mockResolvedValue(
      JSON.stringify({
        assistantReply: '我已补全核心故事句。',
        foundationPatch: {
          core: {
            logline: '失势世子在乱局中以假死反制对手。',
          },
        },
      }),
    );

    await wrapper.get('[data-foundation-input]').setValue('请补全一句话故事');
    await wrapper.get('[data-foundation-action="collaborate"]').trigger('click');
    await flushAsyncUpdates();
    await vi.waitFor(() => {
      expect(store.messages).toHaveLength(2);
    });

    expect(store.foundation.core.logline).toBe('失势世子在乱局中以假死反制对手。');
    expect(wrapper.get('[data-foundation-chat-list]').text()).toContain('请补全一句话故事');
    expect(wrapper.get('[data-foundation-chat-list]').text()).toContain('我已补全核心故事句');
    expect(wrapper.find('[data-foundation-parse-warning]').exists()).toBe(false);
  });

  it('should keep existing data when structured parsing fails', async () => {
    const wrapper = mount(FoundationPanel);
    const store = useFoundationStore();

    store.patchModule('core', {
      logline: '已有核心句',
    });

    generateRawMock.mockResolvedValue('建议先明确主角显性目标与失败代价。');

    await wrapper.get('[data-foundation-input]').setValue('先给建议');
    await wrapper.get('[data-foundation-action="collaborate"]').trigger('click');
    await flushAsyncUpdates();

    expect(store.foundation.core.logline).toBe('已有核心句');
    expect(wrapper.get('[data-foundation-parse-warning]').text()).toContain(
      '本轮有建议，但没有自动写入表单。你已经填写的内容没有变化。可手动参考本轮回复，或再试一次。',
    );
  });

  it('should show advanced content hint in normal mode and keep advanced data after switching mode', async () => {
    const wrapper = mount(FoundationPanel);
    const store = useFoundationStore();

    store.patchModule('narrativeRules', {
      languageQuality: '冷峻克制',
    });
    await flushAsyncUpdates();

    expect(wrapper.get('[data-foundation-advanced-content-hint]').text()).toContain('1 / 3');
    expect(wrapper.find('[data-foundation-module="narrativeRules"]').exists()).toBe(false);

    await wrapper.get('[data-foundation-action="switch-to-advanced-mode"]').trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-foundation-advanced-content-hint]').exists()).toBe(false);
    expect(wrapper.find('[data-foundation-module="narrativeRules"]').exists()).toBe(true);
    expect(wrapper.get('[data-foundation-progress-tier="advanced"]').text()).toContain('1 / 3');
  });

  it('should support module assist and extension CRUD operations', async () => {
    const wrapper = mount(FoundationPanel);
    const store = useFoundationStore();

    generateRawMock.mockResolvedValue(
      JSON.stringify({
        assistantReply: '我已补全主角模块。',
        foundationPatch: {
          protagonist: {
            visibleGoal: '三个月内稳住边军并夺回指挥权',
          },
          core: {
            logline: '不应写入的跨模块字段',
          },
        },
      }),
    );

    await wrapper.get('[data-foundation-action="module-assist-protagonist"]').trigger('click');
    await flushAsyncUpdates();

    expect(store.foundation.protagonist.visibleGoal).toBe('三个月内稳住边军并夺回指挥权');
    expect(store.foundation.core.logline).toBe('');

    await wrapper.get('[data-foundation-mode="advanced"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.find('[data-foundation-extensions]').exists()).toBe(true);

    await wrapper.get('[data-foundation-action="add-extension"]').trigger('click');
    await flushAsyncUpdates();
    expect(store.foundation.extensions).toHaveLength(1);

    const extensionId = store.foundation.extensions[0]?.id;
    expect(extensionId).toBeTruthy();

    if (!extensionId) {
      throw new Error('扩展模块未创建成功');
    }

    await wrapper.get(`[data-foundation-extension-title="${extensionId}"]`).setValue('平台限制');
    await wrapper.get(`[data-foundation-extension-fields="${extensionId}"]`).setValue('{"tone":"冷峻"}');
    await wrapper.get(`[data-foundation-extension-fields="${extensionId}"]`).trigger('blur');
    await flushAsyncUpdates();

    expect(store.foundation.extensions[0]?.title).toBe('平台限制');
    expect(store.foundation.extensions[0]?.fields).toEqual({ tone: '冷峻' });

    await wrapper.get(`[data-foundation-action="remove-extension"][data-foundation-extension-id="${extensionId}"]`).trigger('click');
    await flushAsyncUpdates();

    expect(store.foundation.extensions).toHaveLength(0);
  });
});
