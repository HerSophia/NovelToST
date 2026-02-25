import { useUiStore } from '@/novelToST/stores/ui.store';

describe('ui.store', () => {
  it('should update mounted busy and status message', () => {
    const store = useUiStore();

    store.setMounted(true);
    store.setBusy(true);
    store.setStatusMessage('运行中');

    expect(store.mounted).toBe(true);
    expect(store.busy).toBe(true);
    expect(store.statusMessage).toBe('运行中');
  });

  it('should open and close confirm modals', () => {
    const store = useUiStore();

    store.openStopConfirmModal();
    store.openResetConfirmModal();
    expect(store.showStopConfirmModal).toBe(true);
    expect(store.showResetConfirmModal).toBe(true);

    store.closeStopConfirmModal();
    store.closeResetConfirmModal();
    expect(store.showStopConfirmModal).toBe(false);
    expect(store.showResetConfirmModal).toBe(false);
  });

  it('should open and close error modal with detail', () => {
    const store = useUiStore();

    store.openErrorModal('执行失败');
    expect(store.showErrorModal).toBe(true);
    expect(store.errorDetail).toBe('执行失败');

    store.closeErrorModal();
    expect(store.showErrorModal).toBe(false);
    expect(store.errorDetail).toBe('执行失败');
  });
});
