<template>
  <div class="w-full bg-slate-950 p-1 font-sans text-slate-200 sm:p-2">
    <section class="rounded-xl border border-white/10 bg-slate-900/70 p-3 shadow-lg">
      <h2 class="text-sm font-semibold tracking-[0.1em] text-white uppercase">NovelToST Workbench</h2>
      <p class="mt-2 text-xs text-slate-300">
        主工作流已迁移到主页面悬浮工作台。你可以点击下方按钮立即打开，或通过右下角 FAB 唤起。
      </p>

      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-extension-entry-open="generation"
          class="inline-flex items-center rounded-lg border border-blue-400/60 bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-blue-500/35"
          @click="openWorkbench('generation')"
        >
          打开工作台（生成执行）
        </button>

        <button
          type="button"
          data-extension-entry-open="foundation"
          class="inline-flex items-center rounded-lg border border-cyan-400/60 bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/35"
          @click="openWorkbench('foundation')"
        >
          打开工作台（写作流）
        </button>

        <button
          type="button"
          data-extension-entry-open="llm"
          class="inline-flex items-center rounded-lg border border-amber-400/60 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/35"
          @click="openWorkbench('llm')"
        >
          打开工作台（LLM 配置）
        </button>
      </div>

      <p class="mt-3 text-[11px] text-slate-500">
        扩展页在 v1 阶段保留为入口 + 高级设置；核心写作流在主页面 Workbench 中完成。
      </p>
    </section>

    <ExtensionAdvancedSettings class="mt-3" />
  </div>
</template>

<script setup lang="ts">
import { emitWorkbenchOpen, type WorkbenchTab } from '../app/workbench.events';
import ExtensionAdvancedSettings from './extension/ExtensionAdvancedSettings.vue';

const openWorkbench = (tab: WorkbenchTab) => {
  emitWorkbenchOpen({ tab });
};
</script>

<style>
@import 'tailwindcss';

html,
body {
  margin: 0;
  padding: 0;
  background: transparent;
}
</style>
