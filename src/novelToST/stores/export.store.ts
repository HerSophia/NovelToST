import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ChapterRecord, ExportSnapshot } from '../types';

export const useExportStore = defineStore('novelToST/export', () => {
  const lastSnapshot = ref<ExportSnapshot | null>(null);
  const lastChapters = ref<ChapterRecord[]>([]);
  const latestPreview = ref('');

  const updatePreview = (previewText: string) => {
    latestPreview.value = previewText;
  };

  const recordCollectedChapters = (chapters: ChapterRecord[]) => {
    lastChapters.value = chapters;
  };

  const recordExportSnapshot = (snapshot: ExportSnapshot) => {
    lastSnapshot.value = snapshot;
  };

  const clearExportState = () => {
    lastSnapshot.value = null;
    lastChapters.value = [];
    latestPreview.value = '';
  };

  return {
    lastSnapshot,
    lastChapters,
    latestPreview,
    updatePreview,
    recordCollectedChapters,
    recordExportSnapshot,
    clearExportState,
  };
});
