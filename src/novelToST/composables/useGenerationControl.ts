import { buildTagPreview, collectChapters } from '../core/extract.service';
import { exportJSON, exportTXT } from '../core/export.service';
import { normalizeError, ensureCanStartGeneration, ensureChatReady } from '../core/guard.service';
import { startLoop } from '../core/generation.service';
import { useExportStore } from '../stores/export.store';
import { useGenerationStore } from '../stores/generation.store';
import { useNovelSettingsStore } from '../stores/settings.store';
import { useUiStore } from '../stores/ui.store';

export function useGenerationControl() {
  const settingsStore = useNovelSettingsStore();
  const generationStore = useGenerationStore();
  const exportStore = useExportStore();
  const uiStore = useUiStore();

  const collectAndTrackChapters = () => {
    const chapters = collectChapters(settingsStore.settings);
    exportStore.recordCollectedChapters(chapters);
    return chapters;
  };

  const refreshPreview = () => {
    const preview = buildTagPreview(settingsStore.settings);
    exportStore.updatePreview(preview);
  };

  const doExportTXT = (options: { silent?: boolean } = {}) => {
    const chapters = collectAndTrackChapters();
    if (chapters.length === 0) {
      if (!options.silent) {
        toastr.warning('没有可导出的内容');
      }
      return null;
    }

    const snapshot = exportTXT(chapters, options);
    exportStore.recordExportSnapshot(snapshot);
    return snapshot;
  };

  const doExportJSON = (options: { silent?: boolean } = {}) => {
    const chapters = collectAndTrackChapters();
    if (chapters.length === 0) {
      if (!options.silent) {
        toastr.warning('没有可导出的内容');
      }
      return null;
    }

    const snapshot = exportJSON(chapters, options);
    exportStore.recordExportSnapshot(snapshot);
    return snapshot;
  };

  const start = async () => {
    try {
      ensureCanStartGeneration();
      ensureChatReady();

      generationStore.start({
        targetChapters: settingsStore.settings.totalChapters,
        currentChapter: settingsStore.settings.currentChapter,
      });
      uiStore.setStatusMessage('运行中');
      generationStore.touchRuntimeNow();

      const loopResult = await startLoop({
        onAutoSave: async () => {
          doExportTXT({ silent: true });
        },
        onChapterFailed: async (chapter, retry, message) => {
          console.warn(`[novelToST] 第 ${chapter} 章失败（第 ${retry} 次）: ${message}`);
        },
      });

      if (loopResult.stoppedByUser) {
        generationStore.markIdle();
        uiStore.setStatusMessage('已停止');
        generationStore.touchRuntimeNow();
        toastr.warning('任务已停止');
        return;
      }

      if (loopResult.completed) {
        generationStore.markCompleted();
        uiStore.setStatusMessage('已完成');
        toastr.success('自动续写完成');
        generationStore.touchRuntimeNow();
        doExportTXT({ silent: false });
        return;
      }

      generationStore.markIdle();
      uiStore.setStatusMessage('已结束');
      generationStore.touchRuntimeNow();
    } catch (error) {
      const message = normalizeError(error);
      generationStore.markError(message, settingsStore.settings.currentChapter + 1);
      uiStore.openErrorModal(message);
      uiStore.setStatusMessage('执行失败');
      toastr.error(message, 'NovelToST 运行失败');
    }
    generationStore.touchRuntimeNow();
  };

  const pause = () => {
    generationStore.pause();
    uiStore.setStatusMessage('已暂停');
    toastr.info('已暂停生成');
    generationStore.touchRuntimeNow();
  };

  const resume = () => {
    generationStore.resume();
    uiStore.setStatusMessage('运行中');
    toastr.info('已恢复生成');
    generationStore.touchRuntimeNow();
  };

  const stop = () => {
    generationStore.requestStop();
    uiStore.setStatusMessage('停止中');
    toastr.warning('已请求停止，等待当前步骤结束');
    generationStore.touchRuntimeNow();
  };

  const reset = () => {
    if (generationStore.isRunning) {
      toastr.warning('请先停止任务后再重置');
      return;
    }

    settingsStore.patch({ currentChapter: 0 });
    generationStore.resetProgress();
    exportStore.clearExportState();
    uiStore.setStatusMessage('进度已重置');
    toastr.info('已重置生成进度');
    generationStore.touchRuntimeNow();
  };

  return {
    start,
    pause,
    resume,
    stop,
    reset,
    doExportTXT,
    doExportJSON,
    refreshPreview,
  };
}
