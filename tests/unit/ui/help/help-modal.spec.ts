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

    expect(wrapper.text()).toContain('标签提取说明');
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

  it('should render worldbuilding topic and allow switching to it', async () => {
    const wrapper = mount(HelpModal, {
      props: {
        modelValue: true,
        topic: 'worldbuilding',
      },
    });

    expect(wrapper.text()).toContain('设定工坊使用指南');

    await wrapper.get('[data-help-topic-tab="worldbuilding"]').trigger('click');
    expect(wrapper.emitted('update:topic')).toEqual([['worldbuilding']]);
  });

  it('should render foundation topic and allow switching to it', async () => {
    const wrapper = mount(HelpModal, {
      props: {
        modelValue: true,
        topic: 'foundation',
      },
    });

    expect(wrapper.text()).toContain('故事基底使用说明');

    await wrapper.get('[data-help-topic-tab="foundation"]').trigger('click');
    expect(wrapper.emitted('update:topic')).toEqual([['foundation']]);
  });

  it('should render outline topic and allow switching to it', async () => {
    const wrapper = mount(HelpModal, {
      props: {
        modelValue: true,
        topic: 'outline',
      },
    });

    expect(wrapper.text()).toContain('大纲工坊（v2）指南');

    await wrapper.get('[data-help-topic-tab="outline"]').trigger('click');
    expect(wrapper.emitted('update:topic')).toEqual([['outline']]);
  });

  it('should render llm topic and allow switching to it', async () => {
    const wrapper = mount(HelpModal, {
      props: {
        modelValue: true,
        topic: 'llm',
      },
    });

    expect(wrapper.text()).toContain('LLM 配置中心指南');

    await wrapper.get('[data-help-topic-tab="llm"]').trigger('click');
    expect(wrapper.emitted('update:topic')).toEqual([['llm']]);
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
