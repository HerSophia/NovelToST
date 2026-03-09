<template>
  <section data-foundation-progress class="space-y-2 rounded-lg border border-indigo-500/25 bg-indigo-500/10 p-3">
    <div class="flex items-center justify-between gap-2">
      <div>
        <p class="text-xs font-semibold tracking-[0.08em] text-indigo-100 uppercase">当前完成情况</p>
        <p data-foundation-progress-label class="mt-1 text-xs text-indigo-100/90">{{ props.completedCount }} / {{ props.totalModuleCount }} 个模块已完成</p>
        <p class="mt-1 text-[11px] text-indigo-100/75">{{ progressSummary }}</p>
      </div>

      <span class="rounded-full border border-indigo-300/30 bg-indigo-400/20 px-2 py-0.5 text-xs text-indigo-50">{{ progressPercent }}%</span>
    </div>

    <div class="h-2 overflow-hidden rounded-full border border-white/10 bg-slate-900/60">
      <div data-foundation-progress-fill class="h-full bg-indigo-400/70 transition-all" :style="{ width: `${progressPercent}%` }"></div>
    </div>

    <div class="grid gap-1.5 sm:grid-cols-3">
      <div
        v-for="item in tierItems"
        :key="item.id"
        :data-foundation-progress-tier="item.id"
        class="rounded border px-2 py-2 text-[11px]"
        :class="item.className"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium">{{ item.label }}</span>
          <span class="opacity-90">{{ item.value }}</span>
        </div>

        <p class="mt-1 opacity-80">
          {{ item.hint }}
        </p>
      </div>
    </div>

    <div class="flex flex-wrap gap-1.5 text-[11px]">
      <span class="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-100">已完成 {{ statusCounts.complete }}</span>
      <span class="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-amber-100">部分完成 {{ statusCounts.partial }}</span>
      <span class="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-slate-300">未填写 {{ statusCounts.empty }}</span>
      <span
        v-if="nextPendingModuleLabel"
        class="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-cyan-100"
      >
        建议先补 → {{ nextPendingModuleLabel }}
      </span>
    </div>

    <div class="grid gap-1.5 sm:grid-cols-2">
      <div
        v-for="item in moduleItems"
        :key="item.id"
        :data-foundation-module-status="item.id"
        class="rounded border px-2 py-1 text-[11px]"
        :class="getStatusClass(item.status)"
      >
        <span>{{ item.label }}</span>
        <span class="ml-1 opacity-80">{{ getStatusLabel(item.status) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FoundationTierSummary } from '../../../core/foundation-tier';
import type { FoundationModuleId, FoundationModuleStatus } from '../../../types/foundation';
import { FOUNDATION_MODULE_IDS } from '../../../types/foundation';

const MODULE_LABELS: Record<FoundationModuleId, string> = {
  positioning: '作品定位',
  core: '故事核心',
  protagonist: '主角档案',
  keyRelations: '关键关系',
  conflictFramework: '冲突结构',
  narrativeRules: '叙事规则',
  worldBrief: '世界需求',
  endgame: '终局方向',
};

const props = defineProps<{
  completedCount: number;
  totalModuleCount: number;
  tierSummary: FoundationTierSummary;
  moduleStatuses: Record<FoundationModuleId, FoundationModuleStatus>;
}>();

const progressPercent = computed(() => {
  if (props.totalModuleCount <= 0) {
    return 0;
  }

  const rawPercent = Math.round((props.completedCount / props.totalModuleCount) * 100);
  return Math.max(0, Math.min(100, rawPercent));
});

const moduleItems = computed(() => {
  return FOUNDATION_MODULE_IDS.map(moduleId => ({
    id: moduleId,
    label: MODULE_LABELS[moduleId],
    status: props.moduleStatuses[moduleId],
  }));
});

const statusCounts = computed(() => {
  return moduleItems.value.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    {
      empty: 0,
      partial: 0,
      complete: 0,
    } as Record<FoundationModuleStatus, number>,
  );
});

const tierItems = computed(() => {
  return [
    {
      id: 'basic',
      label: '起步必填',
      value: `${props.tierSummary.basic.filled} / ${props.tierSummary.basic.total}`,
      hint: props.tierSummary.basic.ready ? '已经可以开始生成' : '先把这一层补到能开始',
      className: props.tierSummary.basic.ready ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' : 'border-rose-400/35 bg-rose-500/10 text-rose-100',
    },
    {
      id: 'intermediate',
      label: '建议补充',
      value: `${props.tierSummary.intermediate.filled} / ${props.tierSummary.intermediate.total}`,
      hint:
        props.tierSummary.intermediate.filled === props.tierSummary.intermediate.total
          ? '人物关系、冲突和世界信息已经较完整'
          : '建议继续补人物关系、冲突和世界信息',
      className: 'border-sky-400/35 bg-sky-500/10 text-sky-100',
    },
    {
      id: 'advanced',
      label: '精细控制',
      value: `${props.tierSummary.advanced.filled} / ${props.tierSummary.advanced.total}`,
      hint: props.tierSummary.advanced.hasContent ? '已经补了一部分写法和收束方向' : '按需补写法、风格和终局方向',
      className: props.tierSummary.advanced.hasContent ? 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100' : 'border-white/10 bg-black/20 text-slate-300',
    },
  ] as const;
});

const nextPendingModuleLabel = computed(() => {
  const nextModule = moduleItems.value.find(item => item.status !== 'complete');
  return nextModule ? nextModule.label : '';
});

const progressSummary = computed(() => {
  if (props.completedCount === props.totalModuleCount && props.totalModuleCount > 0) {
    return '八个模块都已经写好。现在可以去设定工坊补世界细节，也可以去大纲工坊安排剧情。';
  }

  if (!props.tierSummary.basic.ready) {
    return '现在还不能开始生成。请先补题材、故事核心，以及主角的关键信息。';
  }

  if (props.tierSummary.intermediate.filled < props.tierSummary.intermediate.total) {
    return '现在已经可以开始生成。若先补完关键关系、冲突结构和世界需求，后面会更稳。';
  }

  if (props.tierSummary.advanced.hasContent) {
    return '起步内容已经比较完整，也写了一部分精细控制项。可以继续细化，也可以进入下一步。';
  }

  return nextPendingModuleLabel.value
    ? `现在已经可以开始生成。下一步建议补「${nextPendingModuleLabel.value}」。`
    : '各模块已经有基础内容，还可以继续补细。';
});

const getStatusLabel = (status: FoundationModuleStatus): string => {
  if (status === 'complete') {
    return '已完成';
  }

  if (status === 'partial') {
    return '部分完成';
  }

  return '未填写';
};

const getStatusClass = (status: FoundationModuleStatus): string => {
  if (status === 'complete') {
    return 'border-emerald-400/45 bg-emerald-500/15 text-emerald-100';
  }

  if (status === 'partial') {
    return 'border-amber-400/45 bg-amber-500/15 text-amber-100';
  }

  return 'border-white/10 bg-black/20 text-slate-400';
};
</script>
