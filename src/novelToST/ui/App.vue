<template>
  <div class="w-full bg-slate-950 p-1 font-sans text-slate-200 selection:bg-blue-500/30 selection:text-blue-100 sm:p-2">
    <!-- Background Decoration -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden">
      <div class="absolute -top-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-blue-500/5 blur-[120px]"></div>
      <div class="absolute -right-1/4 -bottom-1/4 h-1/2 w-1/2 rounded-full bg-emerald-500/5 blur-[120px]"></div>
    </div>

    <div class="relative flex w-full flex-col gap-3 border border-white/[0.06] bg-slate-900/35 p-2 transition-all duration-500 ease-in-out sm:gap-4 sm:p-3">
      <div class="sticky top-0 z-30 -mx-2 flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-3 py-2.5 backdrop-blur-md sm:-mx-3 sm:px-4">
        <div>
          <h1 class="text-sm font-semibold tracking-[0.18em] text-white">NovelToST</h1>
          <p class="text-[11px] text-slate-500 uppercase">续写 · 导出 · 控制台</p>
        </div>
        <button
          class="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          :title="isGlobalCollapsed ? '展开完整界面' : '折叠为精简界面'"
          @click="toggleGlobalCollapse"
        >
          <span>{{ isGlobalCollapsed ? '展开' : '折叠' }}</span>
          <svg
            class="size-4 transition-transform duration-300"
            :class="isGlobalCollapsed ? 'rotate-180' : 'rotate-0'"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      <div
        class="overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-in-out"
        :class="isGlobalCollapsed ? 'grid grid-rows-[0fr] opacity-0' : 'grid grid-rows-[1fr] opacity-100'"
      >
        <div class="overflow-hidden">
          <!-- Header / Status Area -->
          <header class="grid gap-3 sm:gap-4 lg:grid-cols-[2fr,1fr]">
            <div class="space-y-3 sm:space-y-4">
              <StatusBar />

              <ControlToolbar
                :can-start="!generationStore.isRunning"
                :can-pause="generationStore.status === 'running'"
                :can-resume="generationStore.status === 'paused'"
                :can-stop="generationStore.isRunning"
                :can-reset="!generationStore.isRunning"
                @start="start"
                @pause="pause"
                @resume="resume"
                @stop="uiStore.openStopConfirmModal"
                @reset="uiStore.openResetConfirmModal"
              />
            </div>

            <!-- Quick Actions Panel -->
            <div class="hidden overflow-hidden lg:block">
              <div class="h-full border border-white/[0.06] bg-transparent p-3">
                <h3 class="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">快速操作</h3>
                <div class="mt-3 grid gap-2">
                  <button
                    class="flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                    @click="refreshPreview"
                  >
                    <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    刷新预览
                  </button>
                  <button
                    class="flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                    @click="doExportTXT()"
                  >
                    <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    快速导出 TXT
                  </button>
                </div>
              </div>
            </div>
          </header>

          <!-- Main Content Grid -->
          <div class="overflow-hidden border-t border-white/[0.06] bg-transparent pt-2 sm:pt-3">
            <main class="grid gap-3 sm:gap-4 lg:grid-cols-2">
              <!-- Worldbook Panel - Full width above the grid -->
              <WorldbookPanel
                v-model:collapsed="panelCollapsed.worldbook"
                class="lg:col-span-2"
                data-panel="worldbook"
                @open-help="openHelp"
              />

              <GenerationForm v-model:collapsed="panelCollapsed.generation" @open-help="openHelp" />
              <div class="flex flex-col gap-3 sm:gap-4">
                <ExportPanel
                  v-model:collapsed="panelCollapsed.export"
                  @export-txt="doExportTXT()"
                  @export-json="doExportJSON()"
                  @open-help="openHelp"
                />
                <TagExtractPanel v-model:collapsed="panelCollapsed.tags" @refresh-preview="refreshPreview" @open-help="openHelp" />
                <HelpPanel v-model:collapsed="panelCollapsed.help" />
              </div>
            </main>
          </div>

        </div>
      </div>
    </div>
  </div>

  <!-- Modals -->
  <HelpModal v-model="showHelpModal" v-model:topic="activeHelpTopic" />

  <ConfirmStopModal
    v-model="uiStore.showStopConfirmModal"
    title="确认停止"
    description="将请求停止自动续写，当前章节会在安全点结束。"
    @confirm="handleStopConfirm"
  />

  <ConfirmStopModal
    v-model="uiStore.showResetConfirmModal"
    title="确认重置"
    description="将清空当前进度与导出快照，该操作不可撤销。"
    @confirm="handleResetConfirm"
  />

  <ConfirmStopModal
    v-model="uiStore.showErrorModal"
    title="错误详情"
    :description="uiStore.errorDetail || '未知错误'"
    confirm-text="我知道了"
    :hide-cancel="true"
    @confirm="uiStore.closeErrorModal"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useGenerationControl } from '../composables/useGenerationControl';
import { useGenerationStore } from '../stores/generation.store';
import { useUiStore } from '../stores/ui.store';
import ConfirmStopModal from './components/ConfirmStopModal.vue';
import ControlToolbar from './components/ControlToolbar.vue';
import ExportPanel from './components/ExportPanel.vue';
import GenerationForm from './components/GenerationForm.vue';
import StatusBar from './components/StatusBar.vue';
import HelpPanel from './components/HelpPanel.vue';
import TagExtractPanel from './components/TagExtractPanel.vue';
import HelpModal from './components/help/HelpModal.vue';
import WorldbookPanel from './components/worldbook/WorldbookPanel.vue';
import type { HelpTopicId } from './help/help-topics';

const generationStore = useGenerationStore();
const uiStore = useUiStore();

const { start, pause, resume, stop, reset, doExportTXT, doExportJSON, refreshPreview } = useGenerationControl();

const STORAGE_PREFIX = 'novelToST.ui';

const readBooleanPreference = (key: string, fallback: boolean): boolean => {
  try {
    const value = window.localStorage.getItem(key);
    if (value === null) {
      return fallback;
    }
    return value === '1';
  } catch {
    return fallback;
  }
};

const saveBooleanPreference = (key: string, value: boolean) => {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore persistence error
  }
};

const isGlobalCollapsed = ref(readBooleanPreference(`${STORAGE_PREFIX}.globalCollapsed`, false));

const panelCollapsed = reactive({
  generation: readBooleanPreference(`${STORAGE_PREFIX}.panel.generation`, false),
  export: readBooleanPreference(`${STORAGE_PREFIX}.panel.export`, true),
  worldbook: readBooleanPreference(`${STORAGE_PREFIX}.panel.worldbook`, true),
  tags: readBooleanPreference(`${STORAGE_PREFIX}.panel.tags`, true),
  help: readBooleanPreference(`${STORAGE_PREFIX}.panel.help`, true),
});

const showHelpModal = ref(false);
const activeHelpTopic = ref<HelpTopicId>('generate');

watch(isGlobalCollapsed, value => {
  saveBooleanPreference(`${STORAGE_PREFIX}.globalCollapsed`, value);
});

watch(
  () => panelCollapsed.generation,
  value => {
    saveBooleanPreference(`${STORAGE_PREFIX}.panel.generation`, value);
  },
);

watch(
  () => panelCollapsed.export,
  value => {
    saveBooleanPreference(`${STORAGE_PREFIX}.panel.export`, value);
  },
);

watch(
  () => panelCollapsed.worldbook,
  value => {
    saveBooleanPreference(`${STORAGE_PREFIX}.panel.worldbook`, value);
  },
);

watch(
  () => panelCollapsed.tags,
  value => {
    saveBooleanPreference(`${STORAGE_PREFIX}.panel.tags`, value);
  },
);

watch(
  () => panelCollapsed.help,
  value => {
    saveBooleanPreference(`${STORAGE_PREFIX}.panel.help`, value);
  },
);

const toggleGlobalCollapse = () => {
  isGlobalCollapsed.value = !isGlobalCollapsed.value;
};

const openHelp = (topic: HelpTopicId) => {
  activeHelpTopic.value = topic;
  showHelpModal.value = true;
};

const handleStopConfirm = () => {
  uiStore.closeStopConfirmModal();
  stop();
};

const handleResetConfirm = () => {
  uiStore.closeResetConfirmModal();
  reset();
};

onMounted(() => {
  refreshPreview();

  // Listen for the worldbook expand event from buttons/index.ts
  window.addEventListener('novelToST:expandWorldbook', expandWorldbookHandler);
});

const expandWorldbookHandler = () => {
  panelCollapsed.worldbook = false;
};

onUnmounted(() => {
  window.removeEventListener('novelToST:expandWorldbook', expandWorldbookHandler);
});
</script>

<style>
@import 'tailwindcss';

html,
body {
  margin: 0;
  padding: 0;
  background-color: #020617;
}

/* Vue Final Modal Overrides */
.vfm--fixed {
  position: fixed;
  z-index: 1000;
}

.vfm--absolute {
  position: absolute;
}

.vfm--inset {
  inset: 0;
}

.vfm--overlay {
  z-index: -1;
  background-color: rgb(0 0 0 / 70%);
  backdrop-filter: blur(4px);
}

.vfm--prevent-none {
  pointer-events: none;
}

.vfm--prevent-auto {
  pointer-events: auto;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
