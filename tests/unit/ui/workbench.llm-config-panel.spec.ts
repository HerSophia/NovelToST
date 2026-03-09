import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { useOutlineStore } from '@/novelToST/stores/outline.store';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import LLMConfigPanel from '@/novelToST/ui/workbench/LLMConfigPanel.vue';

describe('LLMConfigPanel', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save/apply/delete llm presets', async () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({
      worldbook: {
        useTavernApi: false,
        apiTimeout: 150000,
        customApiProvider: 'openai',
        customApiEndpoint: 'https://example.com/v1/chat/completions',
        customApiModel: 'gpt-4.1',
        customApiKey: 'sk-test',
      },
    });

    const wrapper = mount(LLMConfigPanel);

    await wrapper.get('[data-llm-preset="name-input"]').setValue('本地 OpenAI');
    await wrapper.get('[data-llm-action="save-preset"]').trigger('click');
    await nextTick();

    expect(settingsStore.settings.worldbook.llmPresets).toHaveLength(1);
    expect(settingsStore.settings.worldbook.llmPresets[0]?.name).toBe('本地 OpenAI');

    settingsStore.patch({
      worldbook: {
        customApiModel: 'gpt-4.1-mini',
      },
    });

    await wrapper.get('[data-llm-action="apply-preset"]').trigger('click');
    expect(settingsStore.settings.worldbook.customApiModel).toBe('gpt-4.1');

    await wrapper.get('[data-llm-action="delete-preset"]').trigger('click');
    expect(settingsStore.settings.worldbook.llmPresets).toHaveLength(0);
    expect(settingsStore.settings.worldbook.activeLLMPresetId).toBeNull();
  });

  it('should update outline ai settings in current chat scope', async () => {
    const outlineStore = useOutlineStore();
    const wrapper = mount(LLMConfigPanel);

    await wrapper.get('[data-llm-outline-setting="provider"]').trigger('click');
    await wrapper.get('[data-llm-outline-setting-provider-option="custom"]').trigger('click');
    await wrapper.get('[data-llm-outline-setting="model"]').setValue('gpt-4.1');
    await wrapper.get('[data-llm-outline-setting="temperature"]').setValue('1.4');

    await wrapper.get('[data-llm-outline-mention-setting="include-worldbook-name"] input').setValue(false);
    await wrapper.get('[data-llm-outline-mention-setting="include-trigger-keywords"] input').setValue(true);
    await wrapper.get('[data-llm-outline-mention-setting="include-strategy-type"] input').setValue(true);

    expect(outlineStore.ai.provider).toBe('custom');
    expect(outlineStore.ai.model).toBe('gpt-4.1');
    expect(outlineStore.ai.temperature).toBe(1.4);
    expect(outlineStore.mentionConfig.worldbookEntryLabel.includeWorldbookName).toBe(false);
    expect(outlineStore.mentionConfig.worldbookEntryLabel.includeTriggerKeywords).toBe(true);
    expect(outlineStore.mentionConfig.worldbookEntryLabel.includeStrategyType).toBe(true);
  });

  it('should hide custom api actions in tavern mode and show them in custom mode', async () => {
    const wrapper = mount(LLMConfigPanel);

    expect(wrapper.find('[data-llm-action="fetch-models"]').exists()).toBe(false);

    await wrapper.get('[data-llm-setting="use-tavern-api"] input').setValue(false);
    await nextTick();
    expect(wrapper.find('[data-llm-action="fetch-models"]').exists()).toBe(true);
  });

  it('should emit llm help event', async () => {
    const wrapper = mount(LLMConfigPanel);

    await wrapper.get('[data-llm-help-trigger="overview"]').trigger('click');
    expect(wrapper.emitted('open-help')).toEqual([['llm']]);
  });
});
