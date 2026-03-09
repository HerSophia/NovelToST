import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { WorkbenchOpenDetail, WorkbenchTab } from '../app/workbench.events';

export type WorkbenchPrimaryTab = 'writing' | 'generation';
export type WorkbenchWritingTab = Exclude<WorkbenchTab, 'generation'>;

const DEFAULT_WORKBENCH_TAB: WorkbenchTab = 'foundation';

function normalizeChapter(chapter: number | null | undefined): number | null {
  if (chapter === null || chapter === undefined || !Number.isFinite(chapter)) {
    return null;
  }

  const normalized = Math.trunc(chapter);
  if (normalized < 1) {
    return null;
  }

  return normalized;
}

export const useWorkbenchStore = defineStore('novelToST/workbench', () => {
  const open = ref(false);
  const activeTab = ref<WorkbenchTab>(DEFAULT_WORKBENCH_TAB);
  const targetChapter = ref<number | null>(null);
  const lastFocusedAt = ref(0);

  const primaryTab = computed<WorkbenchPrimaryTab>(() => (activeTab.value === 'generation' ? 'generation' : 'writing'));
  const writingTab = computed<WorkbenchWritingTab>(() => {
    if (activeTab.value === 'foundation' || activeTab.value === 'detail' || activeTab.value === 'outline' || activeTab.value === 'llm' || activeTab.value === 'worldbuilding') {
      return activeTab.value;
    }
    return 'foundation';
  });

  const setOpen = (value: boolean) => {
    open.value = value;
  };

  const setActiveTab = (tab: WorkbenchTab) => {
    activeTab.value = tab;
  };

  const setPrimaryTab = (tab: WorkbenchPrimaryTab) => {
    if (tab === 'generation') {
      setActiveTab('generation');
      return;
    }

    if (activeTab.value === 'generation') {
      setActiveTab('foundation');
    }
  };

  const setWritingTab = (tab: WorkbenchWritingTab) => {
    setActiveTab(tab);
  };

  const setTargetChapter = (chapter: number | null | undefined) => {
    targetChapter.value = normalizeChapter(chapter);
  };

  const openWithDetail = (detail: WorkbenchOpenDetail = {}) => {
    setOpen(true);

    if (detail.tab !== undefined) {
      setActiveTab(detail.tab);
    }

    if (detail.chapter !== undefined) {
      const normalizedChapter = normalizeChapter(detail.chapter);
      targetChapter.value = normalizedChapter;

      if (detail.tab === undefined && normalizedChapter !== null) {
        setActiveTab('detail');
      }
    }
  };

  const markFocused = () => {
    lastFocusedAt.value = Date.now();
  };

  const reset = () => {
    open.value = false;
    activeTab.value = DEFAULT_WORKBENCH_TAB;
    targetChapter.value = null;
    lastFocusedAt.value = 0;
  };

  return {
    open,
    activeTab,
    targetChapter,
    primaryTab,
    writingTab,
    lastFocusedAt,
    setOpen,
    setActiveTab,
    setPrimaryTab,
    setWritingTab,
    setTargetChapter,
    openWithDetail,
    markFocused,
    reset,
  };
});
