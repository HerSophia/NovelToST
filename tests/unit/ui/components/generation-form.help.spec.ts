import { mount } from '@vue/test-utils';
import GenerationForm from '@/novelToST/ui/components/GenerationForm.vue';

describe('GenerationForm help triggers', () => {
  it('should emit help event and keep panel state when clicking help button', async () => {
    const wrapper = mount(GenerationForm, {
      props: {
        collapsed: false,
      },
    });

    await wrapper.get('[data-help-topic="generate"]').trigger('click');

    expect(wrapper.emitted('open-help')).toEqual([['generate']]);
    expect(wrapper.emitted('update:collapsed')).toBeUndefined();
  });

  it('should still collapse when header is clicked', async () => {
    const wrapper = mount(GenerationForm, {
      props: {
        collapsed: false,
      },
    });

    await wrapper.get('.cursor-pointer').trigger('click');

    expect(wrapper.emitted('update:collapsed')).toEqual([[true]]);
  });
});
