import { useGenerationControl } from '@/novelToST/composables/useGenerationControl';
import { useExportStore } from '@/novelToST/stores/export.store';
import { useGenerationStore } from '@/novelToST/stores/generation.store';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import { useUiStore } from '@/novelToST/stores/ui.store';
import type { ChapterRecord, ExportSnapshot } from '@/novelToST/types';
import { stMocks } from '../../setup/st-globals.mock';

const mocked = vi.hoisted(() => ({
  collectChapters: vi.fn(),
  buildTagPreview: vi.fn(),
  exportTXT: vi.fn(),
  exportJSON: vi.fn(),
  ensureCanStartGeneration: vi.fn(),
  ensureChatReady: vi.fn(),
  normalizeError: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
  startLoop: vi.fn(),
}));

vi.mock('@/novelToST/core/extract.service', () => ({
  collectChapters: mocked.collectChapters,
  buildTagPreview: mocked.buildTagPreview,
}));

vi.mock('@/novelToST/core/export.service', () => ({
  exportTXT: mocked.exportTXT,
  exportJSON: mocked.exportJSON,
}));

vi.mock('@/novelToST/core/guard.service', () => ({
  ensureCanStartGeneration: mocked.ensureCanStartGeneration,
  ensureChatReady: mocked.ensureChatReady,
  normalizeError: mocked.normalizeError,
}));

vi.mock('@/novelToST/core/generation.service', () => ({
  startLoop: mocked.startLoop,
}));

const sampleChapters: ChapterRecord[] = [
  {
    floor: 1,
    index: 1,
    role: 'assistant',
    name: 'AI',
    content: '章节内容',
    message_id: 1,
  },
];

describe('useGenerationControl integration', () => {
  beforeEach(() => {
    mocked.collectChapters.mockReset();
    mocked.collectChapters.mockReturnValue([]);

    mocked.buildTagPreview.mockReset();
    mocked.buildTagPreview.mockReturnValue('默认预览');

    mocked.exportTXT.mockReset();
    mocked.exportTXT.mockImplementation((chapters: ChapterRecord[]) => ({
      format: 'txt',
      filename: 'mock.txt',
      chapterCount: chapters.length,
      totalCharacters: chapters.reduce((sum, chapter) => sum + chapter.content.length, 0),
      exportedAt: '2026-01-01T00:00:00.000Z',
    }));

    mocked.exportJSON.mockReset();
    mocked.exportJSON.mockImplementation((chapters: ChapterRecord[]) => ({
      format: 'json',
      filename: 'mock.json',
      chapterCount: chapters.length,
      totalCharacters: chapters.reduce((sum, chapter) => sum + chapter.content.length, 0),
      exportedAt: '2026-01-01T00:00:00.000Z',
    }));

    mocked.ensureCanStartGeneration.mockReset();
    mocked.ensureChatReady.mockReset();

    mocked.normalizeError.mockReset();
    mocked.normalizeError.mockImplementation((error: unknown) => (error instanceof Error ? error.message : String(error)));

    mocked.startLoop.mockReset();
    mocked.startLoop.mockResolvedValue({ stoppedByUser: false, completed: false });
  });

  it('should warn and return null when exporting TXT with empty chapters', () => {
    const control = useGenerationControl();
    const snapshot = control.doExportTXT();

    expect(snapshot).toBeNull();
    expect(stMocks.toastr.warning).toHaveBeenCalledWith('没有可导出的内容');
    expect(useExportStore().lastChapters).toEqual([]);
  });

  it('should export JSON and record snapshot when chapters exist', () => {
    const expectedSnapshot: ExportSnapshot = {
      format: 'json',
      filename: 'chapter.json',
      chapterCount: 1,
      totalCharacters: 4,
      exportedAt: '2026-01-01T00:00:00.000Z',
    };
    mocked.collectChapters.mockReturnValue(sampleChapters);
    mocked.exportJSON.mockReturnValue(expectedSnapshot);

    const control = useGenerationControl();
    const snapshot = control.doExportJSON();

    const exportStore = useExportStore();
    expect(snapshot).toEqual(expectedSnapshot);
    expect(exportStore.lastChapters).toEqual(sampleChapters);
    expect(exportStore.lastSnapshot).toEqual(expectedSnapshot);
    expect(mocked.exportJSON).toHaveBeenCalledWith(sampleChapters, {});
  });

  it('should refresh preview into export store', () => {
    mocked.buildTagPreview.mockReturnValue('新的预览');

    const control = useGenerationControl();
    control.refreshPreview();

    expect(useExportStore().latestPreview).toBe('新的预览');
  });

  it('should mark stopped status and show warning when loop stopped by user', async () => {
    mocked.startLoop.mockResolvedValue({ stoppedByUser: true, completed: false });

    const control = useGenerationControl();
    await control.start();

    const generationStore = useGenerationStore();
    const uiStore = useUiStore();

    expect(generationStore.status).toBe('idle');
    expect(uiStore.statusMessage).toBe('已停止');
    expect(stMocks.toastr.warning).toHaveBeenCalledWith('任务已停止');
  });

  it('should mark completed and trigger final export when loop completed', async () => {
    mocked.startLoop.mockResolvedValue({ stoppedByUser: false, completed: true });
    mocked.collectChapters.mockReturnValue(sampleChapters);

    const control = useGenerationControl();
    await control.start();

    const generationStore = useGenerationStore();
    const uiStore = useUiStore();

    expect(generationStore.status).toBe('completed');
    expect(uiStore.statusMessage).toBe('已完成');
    expect(mocked.exportTXT).toHaveBeenCalledWith(sampleChapters, { silent: false });
    expect(stMocks.toastr.success).toHaveBeenCalledWith('自动续写完成');
  });

  it('should update status and toast when pause resume and stop called', () => {
    const generationStore = useGenerationStore();
    generationStore.start({ targetChapters: 10, currentChapter: 1 });

    const control = useGenerationControl();
    control.pause();
    expect(generationStore.status).toBe('paused');
    expect(useUiStore().statusMessage).toBe('已暂停');

    control.resume();
    expect(generationStore.status).toBe('running');
    expect(useUiStore().statusMessage).toBe('运行中');

    control.stop();
    expect(generationStore.status).toBe('stopping');
    expect(generationStore.abortRequested).toBe(true);
    expect(useUiStore().statusMessage).toBe('停止中');
    expect(stMocks.toastr.info).toHaveBeenCalledWith('已暂停生成');
    expect(stMocks.toastr.info).toHaveBeenCalledWith('已恢复生成');
    expect(stMocks.toastr.warning).toHaveBeenCalledWith('已请求停止，等待当前步骤结束');
  });

  it('should block reset while generation is running', () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({ currentChapter: 5 });

    const generationStore = useGenerationStore();
    generationStore.start({ targetChapters: 10, currentChapter: 5 });

    const control = useGenerationControl();
    control.reset();

    expect(settingsStore.settings.currentChapter).toBe(5);
    expect(stMocks.toastr.warning).toHaveBeenCalledWith('请先停止任务后再重置');
  });

  it('should reset progress and export state when idle', () => {
    const settingsStore = useNovelSettingsStore();
    settingsStore.patch({ currentChapter: 6 });

    const generationStore = useGenerationStore();
    generationStore.setCurrentChapter(6);
    generationStore.recordGeneratedChapter(120);

    const exportStore = useExportStore();
    exportStore.recordCollectedChapters(sampleChapters);
    exportStore.updatePreview('旧预览');

    const control = useGenerationControl();
    control.reset();

    expect(settingsStore.settings.currentChapter).toBe(0);
    expect(generationStore.currentChapter).toBe(0);
    expect(generationStore.stats.chaptersGenerated).toBe(0);
    expect(exportStore.lastChapters).toEqual([]);
    expect(exportStore.latestPreview).toBe('');
    expect(useUiStore().statusMessage).toBe('进度已重置');
    expect(stMocks.toastr.info).toHaveBeenCalledWith('已重置生成进度');
  });

  it('should mark error and open modal when start throws', async () => {
    mocked.ensureCanStartGeneration.mockImplementation(() => {
      throw new Error('启动失败');
    });

    const control = useGenerationControl();
    await control.start();

    const generationStore = useGenerationStore();
    const uiStore = useUiStore();

    expect(generationStore.status).toBe('error');
    expect(uiStore.showErrorModal).toBe(true);
    expect(uiStore.errorDetail).toBe('启动失败');
    expect(stMocks.toastr.error).toHaveBeenCalledWith('启动失败', 'NovelToST 运行失败');
  });
});
