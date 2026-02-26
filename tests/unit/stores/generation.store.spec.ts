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

  it('should compute elapsed time, average chapter duration and eta without counting paused duration', () => {
    vi.useFakeTimers();

    const base = new Date('2026-01-01T00:00:00.000Z').getTime();
    vi.setSystemTime(base);

    const store = useGenerationStore();
    store.start({ targetChapters: 4, currentChapter: 0 });

    vi.setSystemTime(base + 2000);
    store.touchRuntimeNow(base + 2000);
    store.recordGeneratedChapter(200);
    store.setCurrentChapter(1);

    expect(store.elapsedMs).toBe(2000);
    expect(store.averageChapterDurationMs).toBe(2000);
    expect(store.estimatedRemainingMs).toBe(6000);

    store.pause();

    vi.setSystemTime(base + 5000);
    store.touchRuntimeNow(base + 5000);
    expect(store.elapsedMs).toBe(2000);

    store.resume();

    vi.setSystemTime(base + 7000);
    store.touchRuntimeNow(base + 7000);
    expect(store.elapsedMs).toBe(4000);
    expect(store.averageChapterDurationMs).toBe(4000);
    expect(store.estimatedRemainingMs).toBe(12000);

    vi.useRealTimers();
  });
});
