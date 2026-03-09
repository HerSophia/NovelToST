import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import { useWorldbookStore } from '@/novelToST/stores/worldbook.store';
import TagExtractPanel from '@/novelToST/ui/components/TagExtractPanel.vue';
import WorldbookResultPanel from '@/novelToST/ui/components/worldbook/WorldbookResultPanel.vue';
import WorldbookSettingsPanel from '@/novelToST/ui/components/worldbook/WorldbookSettingsPanel.vue';

describe('non-workbench dropdown migrations', () => {
  it('should update extract mode and separator via dropdown select', async () => {
    const settingsStore = useNovelSettingsStore();
    const wrapper = mount(TagExtractPanel);

    await wrapper.get('[data-tag-extract-mode-select]').trigger('click');
    await wrapper.get('[data-tag-extract-mode-option="tags"]').trigger('click');

    expect(settingsStore.settings.extractMode).toBe('tags');

    await nextTick();

    await wrapper.get('[data-tag-extract-separator-select]').trigger('click');
    const separatorOptions = wrapper.findAll('[data-tag-extract-separator-option]');

    expect(separatorOptions.length).toBe(3);
    const newlineOption = separatorOptions[1];

    expect(newlineOption).toBeDefined();
    if (!newlineOption) {
      throw new Error('未找到单换行选项');
    }
    await newlineOption.trigger('click');

    expect(settingsStore.settings.tagSeparator).toBe('\n');
  });

  it('should update worldbook setting fields via dropdown select', async () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.settings.worldbook.useTavernApi = false;
    settingsStore.settings.worldbook.parallelEnabled = true;

    const wrapper = mount(WorldbookSettingsPanel, {
      props: {
        modelOptions: ['gemini-2.5-flash', 'gpt-4o-mini'],
      },
    });

    await wrapper.get('[data-worldbook-settings-provider-select]').trigger('click');
    await wrapper.get('[data-worldbook-settings-provider-option="deepseek"]').trigger('click');

    await wrapper.get('[data-worldbook-settings-model-select]').trigger('click');
    await wrapper.get('[data-worldbook-settings-model-option="gpt-4o-mini"]').trigger('click');

    await wrapper.get('[data-worldbook-settings-language-select]').trigger('click');
    await wrapper.get('[data-worldbook-settings-language-option="ja"]').trigger('click');

    await wrapper.get('[data-worldbook-settings-parallel-mode-select]').trigger('click');
    await wrapper.get('[data-worldbook-settings-parallel-mode-option="batch"]').trigger('click');

    expect(settingsStore.settings.worldbook.customApiProvider).toBe('deepseek');
    expect(settingsStore.settings.worldbook.customApiModel).toBe('gpt-4o-mini');
    expect(settingsStore.settings.worldbook.language).toBe('ja');
    expect(settingsStore.settings.worldbook.parallelMode).toBe('batch');
  });

  it('should filter generated entries by category via dropdown select', async () => {
    const wbStore = useWorldbookStore();
    wbStore.replaceGeneratedEntries([
      {
        id: 'entry-1',
        category: '角色',
        name: '林川',
        keywords: ['林川'],
        content: '边境侦察兵。',
        sourceChunkIds: ['chunk-1'],
      },
      {
        id: 'entry-2',
        category: '地点',
        name: '王都',
        keywords: ['王都'],
        content: '帝国首都。',
        sourceChunkIds: ['chunk-2'],
      },
    ]);

    const wrapper = mount(WorldbookResultPanel);

    expect(wrapper.text()).toContain('显示 2 / 2 条目');

    await wrapper.get('[data-worldbook-result-category-filter-select]').trigger('click');
    await wrapper.get('[data-worldbook-result-category-filter-option="角色"]').trigger('click');

    await nextTick();

    expect(wrapper.text()).toContain('显示 1 / 2 条目');
    expect(wrapper.text()).toContain('林川');
    expect(wrapper.text()).not.toContain('王都');
  });
});
