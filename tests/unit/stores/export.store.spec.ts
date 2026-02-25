import { useExportStore } from '@/novelToST/stores/export.store';
import type { ChapterRecord, ExportSnapshot } from '@/novelToST/types';

describe('export.store', () => {
  it('should track preview chapters and snapshot', () => {
    const store = useExportStore();

    const chapters: ChapterRecord[] = [
      {
        floor: 1,
        index: 1,
        role: 'assistant',
        name: 'AI',
        content: '章节内容',
        message_id: 1,
      },
    ];
    const snapshot: ExportSnapshot = {
      format: 'txt',
      filename: 'novel.txt',
      chapterCount: 1,
      totalCharacters: 4,
      exportedAt: '2026-01-01T00:00:00.000Z',
    };

    store.updatePreview('预览文本');
    store.recordCollectedChapters(chapters);
    store.recordExportSnapshot(snapshot);

    expect(store.latestPreview).toBe('预览文本');
    expect(store.lastChapters).toEqual(chapters);
    expect(store.lastSnapshot).toEqual(snapshot);
  });

  it('should clear export state to defaults', () => {
    const store = useExportStore();

    store.updatePreview('旧预览');
    store.recordCollectedChapters([
      {
        floor: 1,
        index: 1,
        role: 'assistant',
        name: 'AI',
        content: '旧内容',
        message_id: 1,
      },
    ]);
    store.recordExportSnapshot({
      format: 'json',
      filename: 'novel.json',
      chapterCount: 1,
      totalCharacters: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
    });

    store.clearExportState();

    expect(store.latestPreview).toBe('');
    expect(store.lastChapters).toEqual([]);
    expect(store.lastSnapshot).toBeNull();
  });
});
