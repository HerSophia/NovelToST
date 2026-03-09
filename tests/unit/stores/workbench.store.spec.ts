import { useWorkbenchStore } from '@/novelToST/stores/workbench.store';

describe('workbench.store', () => {
  it('should keep foundation tab as default writing state', () => {
    const store = useWorkbenchStore();

    expect(store.open).toBe(false);
    expect(store.activeTab).toBe('foundation');
    expect(store.primaryTab).toBe('writing');
    expect(store.targetChapter).toBeNull();
    expect(store.writingTab).toBe('foundation');
  });

  it('should open on detail tab and normalize chapter from open detail payload', () => {
    const store = useWorkbenchStore();

    store.openWithDetail({ tab: 'detail', chapter: 12.8 });

    expect(store.open).toBe(true);
    expect(store.activeTab).toBe('detail');
    expect(store.primaryTab).toBe('writing');
    expect(store.writingTab).toBe('detail');
    expect(store.targetChapter).toBe(12);
  });

  it('should switch to detail tab when chapter is provided without tab', () => {
    const store = useWorkbenchStore();

    store.openWithDetail({ chapter: 3 });

    expect(store.activeTab).toBe('detail');
    expect(store.targetChapter).toBe(3);
  });

  it('should support switching by primary tab and reset to defaults', () => {
    const store = useWorkbenchStore();

    expect(store.activeTab).toBe('foundation');

    store.setPrimaryTab('writing');
    expect(store.activeTab).toBe('foundation');
    expect(store.writingTab).toBe('foundation');

    store.setWritingTab('foundation');
    expect(store.activeTab).toBe('foundation');

    store.setWritingTab('worldbuilding');

    store.setWritingTab('detail');
    expect(store.activeTab).toBe('detail');

    store.setWritingTab('llm');
    expect(store.activeTab).toBe('llm');

    store.setPrimaryTab('generation');
    expect(store.activeTab).toBe('generation');

    store.setPrimaryTab('writing');
    expect(store.activeTab).toBe('foundation');
    expect(store.writingTab).toBe('foundation');

    store.reset();
    expect(store.open).toBe(false);
    expect(store.activeTab).toBe('foundation');
    expect(store.primaryTab).toBe('writing');
    expect(store.targetChapter).toBeNull();
  });
});
