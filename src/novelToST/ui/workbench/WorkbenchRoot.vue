<template>
  <div class="flex h-full w-full flex-col bg-slate-950 text-slate-200">
    <header class="flex items-center justify-between border-b border-white/10 bg-slate-900/85 px-3 py-2.5 backdrop-blur">
      <div>
        <h1 class="text-sm font-semibold tracking-[0.12em] text-white uppercase">NovelToST Workbench</h1>
        <p class="text-[11px] text-slate-500 uppercase">小说创作 · 自动续写</p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          data-workbench-primary-tab="writing"
          class="rounded-lg border px-2.5 py-1 text-xs transition"
          :class="
            workbenchStore.primaryTab === 'writing'
              ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-100'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          "
          @click="workbenchStore.setPrimaryTab('writing')"
        >
          ✍️ 写作准备
        </button>

        <button
          type="button"
          data-workbench-primary-tab="generation"
          class="rounded-lg border px-2.5 py-1 text-xs transition"
          :class="
            workbenchStore.primaryTab === 'generation'
              ? 'border-blue-400/70 bg-blue-500/20 text-blue-100'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          "
          @click="workbenchStore.setPrimaryTab('generation')"
        >
          ▶️ 开始续写
        </button>

        <button
          type="button"
          data-workbench-action="close"
          class="rounded-lg border border-white/15 bg-black/20 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/10"
          @click="closeWorkbench"
        >
          关闭
        </button>
      </div>
    </header>

    <main class="flex-1 p-3" :class="isFoundationWritingView ? 'overflow-hidden' : 'overflow-y-auto'">
      <section v-if="workbenchStore.primaryTab === 'writing'" data-workbench-view="writing" :class="isFoundationWritingView ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-3'">
        <div class="flex items-center gap-2">
          <button
            type="button"
            data-workbench-writing-tab="foundation"
            class="rounded-md border px-2 py-1 text-xs transition"
            :class="
              workbenchStore.writingTab === 'foundation'
                ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            "
            @click="workbenchStore.setWritingTab('foundation')"
          >
            📋 故事基底
          </button>

          <button
            type="button"
            data-workbench-writing-tab="worldbuilding"
            class="rounded-md border px-2 py-1 text-xs transition"
            :class="
              workbenchStore.writingTab === 'worldbuilding'
                ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            "
            @click="workbenchStore.setWritingTab('worldbuilding')"
          >
            🌍 设定工坊
          </button>

          <button
            type="button"
            data-workbench-writing-tab="outline"
            class="rounded-md border px-2 py-1 text-xs transition"
            :class="
              workbenchStore.writingTab === 'outline'
                ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            "
            @click="workbenchStore.setWritingTab('outline')"
          >
            📖 大纲工坊
          </button>

          <button
            type="button"
            data-workbench-writing-tab="detail"
            class="rounded-md border px-2 py-1 text-xs transition"
            :class="
              workbenchStore.writingTab === 'detail'
                ? 'border-violet-400/70 bg-violet-500/20 text-violet-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            "
            @click="workbenchStore.setWritingTab('detail')"
          >
            📝 细纲编辑
          </button>

          <button
            type="button"
            data-workbench-writing-tab="llm"
            class="ml-auto rounded-md border px-2 py-1 text-xs transition"
            :class="
              workbenchStore.writingTab === 'llm'
                ? 'border-amber-400/70 bg-amber-500/20 text-amber-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            "
            @click="workbenchStore.setWritingTab('llm')"
          >
            ⚙️ 设置
          </button>
        </div>

        <p data-workbench-writing-hint class="text-[11px] text-slate-400">
          {{ writingFlowHint }}
        </p>

        <div
          v-if="workbenchStore.writingTab === 'foundation'"
          data-workbench-view="foundation"
          class="rounded-xl border border-white/10 bg-slate-900/55 p-3"
          :class="isFoundationWritingView ? 'min-h-0 flex-1 overflow-hidden' : ''"
        >
          <FoundationPanel @open-help="openHelp" />
        </div>

        <div v-else-if="workbenchStore.writingTab === 'worldbuilding'" data-workbench-view="worldbuilding" class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
          <WorldbuildingPanel @open-help="openHelp" />
        </div>

        <div
          v-else-if="workbenchStore.writingTab === 'outline'"
          data-workbench-view="outline"
          class="rounded-xl border border-white/10 bg-slate-900/55 p-3"
        >
          <WritingOutlinePanel @open-help="openHelp" />
        </div>

        <div
          v-else-if="workbenchStore.writingTab === 'llm'"
          data-workbench-view="llm"
          class="rounded-xl border border-white/10 bg-slate-900/55 p-3"
        >
          <LLMConfigPanel @open-help="openHelp" />
        </div>

        <div v-else class="space-y-3 rounded-xl border border-white/10 bg-slate-900/55 p-3 text-sm text-slate-300">
          <p data-workbench-detail-chapter class="text-xs text-slate-400">
            {{ detailChapterLabel }}
          </p>

          <WritingDetailPanel :chapter="workbenchStore.targetChapter" @open-help="openHelp" />
        </div>
      </section>

      <section v-else data-workbench-view="generation" class="space-y-3">
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

        <GenerationForm v-model:collapsed="panelCollapsed.generation" @open-help="openHelp" />
      </section>
    </main>
  </div>

  <HelpModal v-model="showHelpModal" v-model:topic="activeHelpTopic" :teleport-to="false" />

  <ConfirmStopModal
    v-model="uiStore.showStopConfirmModal"
    title="确认停止"
    description="将请求停止自动续写，当前章节会在安全点结束。"
    :teleport-to="false"
    @confirm="handleStopConfirm"
  />

  <ConfirmStopModal
    v-model="uiStore.showResetConfirmModal"
    title="确认重置"
    description="将清空当前进度与导出快照，该操作不可撤销。"
    :teleport-to="false"
    @confirm="handleResetConfirm"
  />

  <ConfirmStopModal
    v-model="uiStore.showErrorModal"
    :teleport-to="false"
    title="错误详情"
    :description="uiStore.errorDetail || '未知错误'"
    confirm-text="我知道了"
    :hide-cancel="true"
    @confirm="uiStore.closeErrorModal"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { emitWorkbenchClose } from '../../app/workbench.events';
import { useGenerationControl } from '../../composables/useGenerationControl';
import { useGenerationStore } from '../../stores/generation.store';
import { useUiStore } from '../../stores/ui.store';
import { useWorkbenchStore } from '../../stores/workbench.store';
import ConfirmStopModal from '../components/ConfirmStopModal.vue';
import ControlToolbar from '../components/ControlToolbar.vue';
import GenerationForm from '../components/GenerationForm.vue';
import StatusBar from '../components/StatusBar.vue';
import HelpModal from '../components/help/HelpModal.vue';
import type { HelpTopicId } from '../help/help-topics';
import WritingDetailPanel from './WritingDetailPanel.vue';
import LLMConfigPanel from './LLMConfigPanel.vue';
import WritingOutlinePanel from './WritingOutlinePanel.vue';
import FoundationPanel from './FoundationPanel.vue';
import WorldbuildingPanel from './WorldbuildingPanel.vue';

const STORAGE_PREFIX = 'novelToST.workbench';

const generationStore = useGenerationStore();
const uiStore = useUiStore();
const workbenchStore = useWorkbenchStore();

const { start, pause, resume, stop, reset, refreshPreview } = useGenerationControl();

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

const panelCollapsed = reactive({
  generation: readBooleanPreference(`${STORAGE_PREFIX}.panel.generation`, false),
});

const showHelpModal = ref(false);
const activeHelpTopic = ref<HelpTopicId>('generate');

const detailChapterLabel = computed(() => {
  if (workbenchStore.targetChapter === null) {
    return '当前未指定章节，可从外部事件携带 chapter 参数打开。';
  }

  return `当前定位章节：第 ${workbenchStore.targetChapter} 章`;
});

const isFoundationWritingView = computed(() => {
  return workbenchStore.primaryTab === 'writing' && workbenchStore.writingTab === 'foundation';
});

const writingFlowHint = computed(() => {
  if (workbenchStore.writingTab === 'foundation') {
    return '先把故事基底写清楚，定好题材、主角和冲突，再进入设定与大纲。';
  }

  if (workbenchStore.writingTab === 'outline') {
    return '在大纲工坊中与 AI 对话，构建你的故事骨架。';
  }

  if (workbenchStore.writingTab === 'llm') {
    return '配置 AI 连接和参数，让大纲工坊和续写功能正常工作。';
  }

  if (workbenchStore.writingTab === 'detail') {
    return '查看和编辑单章的详细细纲。完整的细纲生成功能正在开发中。';
  }

  return '在设定工坊沉淀世界观设定，并与故事基底保持一致，再进入大纲工坊规划故事结构。';
});

watch(
  () => panelCollapsed.generation,
  value => {
    saveBooleanPreference(`${STORAGE_PREFIX}.panel.generation`, value);
  },
);

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

const closeWorkbench = () => {
  emitWorkbenchClose();
};

onMounted(() => {
  refreshPreview();
});
</script>

<style>
@import 'tailwindcss';

html,
body {
  margin: 0;
  padding: 0;
  background: #020617;
  height: 800px;
}

/* Vue Final Modal base classes (Workbench 在 iframe 中运行，需显式提供样式) */
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

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgb(255 255 255 / 5%);
}

::-webkit-scrollbar-thumb {
  background: rgb(255 255 255 / 25%);
  border-radius: 4px;
}
</style>
