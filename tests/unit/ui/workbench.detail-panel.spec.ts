import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { rewriteChapterDetailByAI } from '@/novelToST/core/outline-ai.service';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { useOutlineStore } from '@/novelToST/stores/outline.store';
import WritingDetailPanel from '@/novelToST/ui/workbench/WritingDetailPanel.vue';

vi.mock('@/novelToST/core/outline-ai.service', async () => {
  const actual = await vi.importActual<typeof import('@/novelToST/core/outline-ai.service')>(
    '@/novelToST/core/outline-ai.service',
  );

  return {
    ...actual,
    rewriteChapterDetailByAI: vi.fn(),
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

describe('WritingDetailPanel', () => {
  const rewriteChapterDetailByAIMock = vi.mocked(rewriteChapterDetailByAI);

  beforeEach(() => {
    rewriteChapterDetailByAIMock.mockReset();
  });

  it('should pre-disable rewrite action until foundation minimum readiness is met', async () => {
    const wrapper = mount(WritingDetailPanel, {
      props: {
        chapter: 2,
      },
    });

    expect(wrapper.get('[data-workbench-detail-action="rewrite"]').attributes('disabled')).toBeDefined();
    satisfyMinimumFoundationReadiness();
    await flushAsyncUpdates();
    expect(wrapper.get('[data-workbench-detail-action="rewrite"]').attributes('disabled')).toBeUndefined();
  });

  it('should render generation reminder modal before rewriting detail and continue only after confirmation', async () => {
    const wrapper = mount(WritingDetailPanel, {
      props: {
        chapter: 2,
      },
    });
    const outlineStore = useOutlineStore();

    outlineStore.setAIConfig({ enabled: true });
    satisfyMinimumFoundationReadiness();
    await flushAsyncUpdates();
    rewriteChapterDetailByAIMock.mockResolvedValue({
      chapter: 2,
      parentNodeId: '',
      title: '第二章重写结果',
      goal: '验证确认弹窗后继续执行',
      conflict: '主角必须立刻作出决定',
      beats: ['发现线索', '决定行动'],
      mustInclude: [],
      mustAvoid: [],
      status: 'draft',
    });

    await wrapper.get('[data-workbench-detail-action="rewrite"]').trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.find('[data-foundation-generation-reminder-modal]').exists()).toBe(true);
    expect(wrapper.get('[data-foundation-generation-reminder-modal]').text()).toContain('继续重写细纲');

    await wrapper.get('[data-foundation-generation-action="cancel-reminder"]').trigger('click');
    await flushAsyncUpdates();
    expect(rewriteChapterDetailByAIMock).not.toHaveBeenCalled();

    await wrapper.get('[data-workbench-detail-action="rewrite"]').trigger('click');
    await flushAsyncUpdates();
    await wrapper.get('[data-foundation-generation-action="confirm-reminder"]').trigger('click');
    await flushAsyncUpdates();

    expect(rewriteChapterDetailByAIMock).toHaveBeenCalledTimes(1);
    expect(outlineStore.getChapterDetail(2)?.title).toBe('第二章重写结果');
  });
});
