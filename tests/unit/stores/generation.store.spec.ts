import { useGenerationStore } from '@/novelToST/stores/generation.store';

describe('generation.store', () => {
  it('should initialize running state when start called', () => {
    const store = useGenerationStore();

    store.start({ targetChapters: 12, currentChapter: 3 });

    expect(store.status).toBe('running');
    expect(store.targetChapters).toBe(12);
    expect(store.currentChapter).toBe(3);
    expect(store.retryCount).toBe(0);
    expect(store.abortRequested).toBe(false);
    expect(store.stats.startTime).not.toBeNull();
  });

  it('should pause and resume only in valid state', () => {
    const store = useGenerationStore();

    store.pause();
    expect(store.status).toBe('idle');

    store.start({ targetChapters: 5, currentChapter: 0 });
    store.pause();
    expect(store.status).toBe('paused');

    store.resume();
    expect(store.status).toBe('running');
  });

  it('should update stats when recording generated chapter', () => {
    const store = useGenerationStore();

    store.start({ targetChapters: 5, currentChapter: 0 });
    store.recordGeneratedChapter(233);
    store.recordGeneratedChapter(-1);

    expect(store.lastGeneratedLength).toBe(0);
    expect(store.stats.chaptersGenerated).toBe(2);
    expect(store.stats.totalCharacters).toBe(233);
  });

  it('should mark stopping and then idle when requested', () => {
    const store = useGenerationStore();

    store.start({ targetChapters: 5, currentChapter: 0 });
    store.requestStop();

    expect(store.status).toBe('stopping');
    expect(store.abortRequested).toBe(true);

    store.markIdle();
    expect(store.status).toBe('idle');
    expect(store.abortRequested).toBe(false);
    expect(store.stats.endTime).not.toBeNull();
  });
});
