import { mount } from '@vue/test-utils';
import { WORKBENCH_OPEN_EVENT } from '@/novelToST/app/workbench.events';
import ExtensionEntryApp from '@/novelToST/ui/ExtensionEntryApp.vue';

describe('ExtensionEntryApp', () => {
  it('should open writing flow with foundation tab', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const wrapper = mount(ExtensionEntryApp, { shallow: true });

    await wrapper.get('[data-extension-entry-open="foundation"]').trigger('click');

    expect(dispatchSpy).toHaveBeenCalledTimes(1);

    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent<{ tab?: string }>;
    expect(event.type).toBe(WORKBENCH_OPEN_EVENT);
    expect(event.detail).toEqual({ tab: 'foundation' });
  });
});
