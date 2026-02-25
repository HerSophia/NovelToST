<template>
  <BaseCard>
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-white/90">运行状态</h3>
      <div
        class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm"
        :class="statusClasses"
      >
        <span class="relative flex h-2 w-2">
          <span
            v-if="generation.status === 'running'"
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
          ></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-current"></span>
        </span>
        {{ statusText }}
      </div>
    </div>

    <div class="mt-4">
      <div class="mb-1 flex justify-between text-xs text-slate-400">
        <span>进度</span>
        <span>{{ progress }}%</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-slate-800/50">
        <div
          class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-4 border-t border-white/5 pt-4 text-center sm:grid-cols-4">
      <div>
        <div class="text-[10px] tracking-wider text-slate-500 uppercase">当前章节</div>
        <div class="text-lg font-medium text-slate-200">{{ settings.currentChapter }} / {{ settings.totalChapters }}</div>
      </div>
      <div>
        <div class="text-[10px] tracking-wider text-slate-500 uppercase">重试次数</div>
        <div class="text-lg font-medium text-slate-200">{{ generation.retryCount }}</div>
      </div>
      <div>
        <div class="text-[10px] tracking-wider text-slate-500 uppercase">已生成</div>
        <div class="text-lg font-medium text-emerald-400">{{ generation.stats.chaptersGenerated }}</div>
      </div>
      <div>
        <div class="text-[10px] tracking-wider text-slate-500 uppercase">错误</div>
        <div class="text-lg font-medium text-rose-400">{{ generation.stats.errors.length }}</div>
      </div>
    </div>

    <div v-if="ui.statusMessage" class="mt-3 flex items-center gap-2 rounded bg-white/5 px-3 py-2 text-xs text-slate-300">
      <svg class="size-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {{ ui.statusMessage }}
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useGenerationStore } from '../../stores/generation.store';
import { useNovelSettingsStore } from '../../stores/settings.store';
import { useUiStore } from '../../stores/ui.store';
import BaseCard from '../base/BaseCard.vue';

const generation = useGenerationStore();
const settingsStore = useNovelSettingsStore();
const ui = useUiStore();

const { settings } = storeToRefs(settingsStore);

const progress = computed(() => {
  if (settings.value.totalChapters <= 0) {
    return 0;
  }
  return Math.min(100, Number(((settings.value.currentChapter / settings.value.totalChapters) * 100).toFixed(1)));
});

const statusText = computed(() => {
  switch (generation.status) {
    case 'running':
      return '运行中';
    case 'paused':
      return '已暂停';
    case 'stopping':
      return '停止中';
    case 'completed':
      return '已完成';
    case 'error':
      return '错误';
    default:
      return '空闲';
  }
});

const statusClasses = computed(() => {
  switch (generation.status) {
    case 'running':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'paused':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'stopping':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    case 'completed':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'error':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  }
});
</script>
