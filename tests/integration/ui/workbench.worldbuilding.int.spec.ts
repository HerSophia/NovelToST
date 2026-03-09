import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { useWorldbuildingStore } from '@/novelToST/stores/worldbuilding.store';
import WorldbuildingPanel from '@/novelToST/ui/workbench/WorldbuildingPanel.vue';
import { stMocks } from '../../setup/st-globals.mock';

async function flushAsyncUpdates(): Promise<void> {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

describe('workbench worldbuilding integration', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();

  beforeEach(() => {
    generateRawMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);

    stMocks.getWorldbookNames.mockReturnValue(['主世界书']);
    stMocks.getWorldbook.mockResolvedValue([]);
    stMocks.createWorldbookEntries.mockResolvedValue({
      worldbook: [],
      new_entries: [{ name: '林川' }, { name: '边境法则' }],
    });

    stMocks.getChatWorldbookName.mockReturnValue('主世界书');
    stMocks.rebindChatWorldbook.mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should complete candidate generation -> commit confirmation -> outline sync flow', async () => {
    generateRawMock.mockResolvedValue(JSON.stringify({
      assistantReply: '我已拆解为候选条目。',
      candidates: [
        {
          category: '角色',
          name: '林川',
          keywords: ['林川'],
          content: '边境侦察兵。',
          strategy: 'selective',
        },
        {
          category: '规则体系',
          name: '边境法则',
          keywords: ['边境法则'],
          content: '夜间宵禁。',
          strategy: 'constant',
        },
      ],
    }));

    const wrapper = mount(WorldbuildingPanel);
    const worldbuildingStore = useWorldbuildingStore();
    const foundationStore = useFoundationStore();

    await wrapper.get('[data-worldbuilding-action="create-session"]').trigger('click');
    expect(worldbuildingStore.sessionCount).toBe(1);

    expect(wrapper.find('[data-worldbuilding-step="1-session"]').exists()).toBe(true);
    expect(wrapper.find('[data-worldbuilding-step="2-collaboration"]').exists()).toBe(true);
    expect(wrapper.find('[data-worldbuilding-step="3-draft-locks"]').exists()).toBe(true);
    expect(wrapper.find('[data-worldbuilding-step="4-binding-commit"]').exists()).toBe(true);

    await flushAsyncUpdates();
    expect(worldbuildingStore.selectedWorldbookName).toBe('主世界书');

    await wrapper.get('[data-worldbuilding-action="generate-candidates"]').trigger('click');
    await vi.waitFor(() => {
      expect(worldbuildingStore.candidates).toHaveLength(2);
    });
    await flushAsyncUpdates();

    expect(worldbuildingStore.checkedCandidateCount).toBe(2);
    expect(worldbuildingStore.candidates[0]?.name).toBe('林川');
    expect(worldbuildingStore.candidates[1]?.name).toBe('边境法则');

    await wrapper.get('[data-worldbuilding-worldbook-select]').trigger('click');
    await wrapper.get('[data-worldbuilding-worldbook-option="主世界书"]').trigger('click');
    await wrapper.get('[data-worldbuilding-outline-sync-toggle]').setValue(true);

    await wrapper.get('[data-worldbuilding-action="open-commit-confirm"]').trigger('click');
    await flushAsyncUpdates();
    expect(wrapper.find('[data-worldbuilding-commit-confirm-modal]').exists()).toBe(true);

    await wrapper.get('[data-worldbuilding-action="confirm-commit"]').trigger('click');
    await flushAsyncUpdates();

    expect(stMocks.createWorldbookEntries).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-worldbuilding-commit-receipt]').exists()).toBe(true);
    expect(wrapper.find('[data-worldbuilding-outline-sync-receipt]').exists()).toBe(true);
    expect(
      foundationStore.foundation.keyRelations.keyCharacters.some(character => character.name === '林川'),
    ).toBe(true);
    expect(foundationStore.foundation.worldBrief.requiredRules).toContain('边境法则：夜间宵禁。');
  });
});
