import { mount } from '@vue/test-utils';
import HelpModal from '@/novelToST/ui/components/help/HelpModal.vue';

vi.mock('vue-final-modal', () => ({
  VueFinalModal: {
    name: 'VueFinalModal',
    props: {
      modelValue: {
        type: Boolean,
        default: false,
      },
    },
    emits: ['update:model-value'],
    template: '<div v-if="modelValue" data-testid="mock-vfm"><slot /></div>',
  },
}));

describe('HelpModal', () => {
  it('should render content of selected topic', () => {
    const wrapper = mount(HelpModal, {
      props: {
        modelValue: true,
        topic: 'extract',
      },
    });

    expect(wrapper.text()).toContain('标签提取帮助');
    expect(wrapper.text()).toContain('调试命令速查');
  });

  it('should emit topic update when switching tabs', async () => {
    const wrapper = mount(HelpModal, {
      props: {
        modelValue: true,
        topic: 'generate',
      },
    });

    await wrapper.get('[data-help-topic-tab="advanced"]').trigger('click');

    expect(wrapper.emitted('update:topic')).toEqual([['advanced']]);
  });

  it('should emit close event when close button is clicked', async () => {
    const wrapper = mount(HelpModal, {
      props: {
        modelValue: true,
        topic: 'worldbook',
      },
    });

    await wrapper.get('button[title="关闭帮助"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });
});
