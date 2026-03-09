import { mount } from '@vue/test-utils';
import BaseSegmentedSelect from '@/novelToST/ui/base/BaseSegmentedSelect.vue';

type SegmentedSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

describe('BaseSegmentedSelect', () => {
  const options: SegmentedSelectOption[] = [
    { value: 'all', label: '全部' },
    { value: 'setup', label: '设定草案' },
    { value: 'node', label: '大纲节点', disabled: true },
  ];

  it('should render data attrs and avoid duplicate emits on mouse mousedown + click', async () => {
    const wrapper = mount(BaseSegmentedSelect, {
      props: {
        modelValue: 'all',
        options,
        groupDataAttrName: 'data-test-segment-group',
        itemDataAttrName: 'data-test-segment-item',
      },
    });

    expect(wrapper.find('[data-test-segment-group]').exists()).toBe(true);

    const setupButton = wrapper.get('[data-test-segment-item="setup"]');
    await setupButton.trigger('mousedown');
    await setupButton.trigger('click', { detail: 1 });

    expect(wrapper.emitted('update:modelValue')).toEqual([['setup']]);
  });

  it('should keep keyboard click path when click detail is 0', async () => {
    const wrapper = mount(BaseSegmentedSelect, {
      props: {
        modelValue: 'all',
        options,
        itemDataAttrName: 'data-test-segment-item',
      },
    });

    const setupButton = wrapper.get('[data-test-segment-item="setup"]');
    await setupButton.trigger('click', { detail: 0 });

    expect(wrapper.emitted('update:modelValue')).toEqual([['setup']]);
  });

  it('should not emit when selecting the same value or when component is disabled', async () => {
    const wrapper = mount(BaseSegmentedSelect, {
      props: {
        modelValue: 'all',
        options,
        itemDataAttrName: 'data-test-segment-item',
      },
    });

    const allButton = wrapper.get('[data-test-segment-item="all"]');
    await allButton.trigger('mousedown');
    await allButton.trigger('click', { detail: 0 });

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();

    expect(wrapper.get('[data-test-segment-item="node"]').attributes('disabled')).toBeDefined();

    await (wrapper as any).setProps({ disabled: true });

    const setupButton = wrapper.get('[data-test-segment-item="setup"]');
    await setupButton.trigger('mousedown');
    await setupButton.trigger('click', { detail: 0 });

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});
