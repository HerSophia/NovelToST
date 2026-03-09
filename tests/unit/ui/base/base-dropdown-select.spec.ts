import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import BaseDropdownSelect from '@/novelToST/ui/base/BaseDropdownSelect.vue';

type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

describe('BaseDropdownSelect', () => {
  const options: DropdownOption[] = [
    { value: 'main', label: '主线' },
    { value: 'subplot', label: '支线' },
    { value: 'parallel', label: '平行线', disabled: true },
  ];

  it('should open dropdown and emit update on selecting a different option', async () => {
    const wrapper = mount(BaseDropdownSelect, {
      props: {
        modelValue: 'main',
        options,
        listDataAttrName: 'data-test-list',
        itemDataAttrName: 'data-test-item',
      },
      attrs: {
        'data-test-trigger': '',
      },
    });

    await wrapper.get('[data-test-trigger]').trigger('click');
    expect(wrapper.find('[data-test-list]').exists()).toBe(true);

    await wrapper.get('[data-test-item="subplot"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['subplot']]);
    expect(wrapper.find('[data-test-list]').exists()).toBe(false);
  });

  it('should close dropdown but not emit when selecting current option', async () => {
    const wrapper = mount(BaseDropdownSelect, {
      props: {
        modelValue: 'main',
        options,
        listDataAttrName: 'data-test-list',
        itemDataAttrName: 'data-test-item',
      },
      attrs: {
        'data-test-trigger': '',
      },
    });

    await wrapper.get('[data-test-trigger]').trigger('click');
    await wrapper.get('[data-test-item="main"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.find('[data-test-list]').exists()).toBe(false);
  });

  it('should close dropdown when clicking outside', async () => {
    const wrapper = mount(BaseDropdownSelect, {
      props: {
        modelValue: 'main',
        options,
        listDataAttrName: 'data-test-list',
      },
      attrs: {
        'data-test-trigger': '',
      },
      attachTo: document.body,
    });

    await wrapper.get('[data-test-trigger]').trigger('click');
    expect(wrapper.find('[data-test-list]').exists()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await nextTick();

    expect(wrapper.find('[data-test-list]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('should keep trigger disabled when component is disabled or without options', async () => {
    const disabledWrapper = mount(BaseDropdownSelect, {
      props: {
        modelValue: 'main',
        options,
        disabled: true,
      },
      attrs: {
        'data-test-trigger': '',
      },
    });

    const disabledTrigger = disabledWrapper.get('[data-test-trigger]');
    expect(disabledTrigger.attributes('disabled')).toBeDefined();

    await disabledTrigger.trigger('click');
    expect(disabledWrapper.find('[role="listbox"]').exists()).toBe(false);

    const emptyWrapper = mount(BaseDropdownSelect, {
      props: {
        modelValue: '',
        options: [],
      },
      attrs: {
        'data-test-trigger': '',
      },
    });

    expect(emptyWrapper.get('[data-test-trigger]').attributes('disabled')).toBeDefined();
  });
});
