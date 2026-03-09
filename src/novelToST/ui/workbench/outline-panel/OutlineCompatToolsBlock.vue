<template>
  <details class="rounded-xl border border-white/10 bg-slate-900/55">
    <summary class="cursor-pointer p-3 text-xs text-slate-400 transition hover:text-slate-300">
      🔧 兼容工具（旧版快捷操作）
    </summary>
    <div class="border-t border-white/10 p-3">
      <p class="text-[11px] text-slate-500">以下是早期版本的快捷操作入口。推荐使用上方的对话功能来构建大纲。</p>

      <div class="mt-2 flex flex-wrap items-center gap-2">
        <BaseButton variant="ghost" data-workbench-outline-action="generate-master" :disabled="!props.canGenerateMasterOutline" @click="emit('generate-master')">
          {{ props.aiBusyAction === 'master' ? '生成中…' : '一键生成总纲' }}
        </BaseButton>

        <BaseButton variant="ghost" data-workbench-outline-action="derive-details" :disabled="!props.canDeriveDetails" @click="emit('derive-details')">
          {{ props.aiBusyAction === 'detail' ? '派生中…' : '从总纲派生细纲' }}
        </BaseButton>

        <HelpTriggerButton topic="outline" title="查看兼容操作说明" data-outline-help-trigger="compat" @trigger="emit('open-help')" />
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import BaseButton from '../../base/BaseButton.vue';
import HelpTriggerButton from '../../components/help/HelpTriggerButton.vue';

const props = withDefaults(
  defineProps<{
    aiBusyAction?: string | null;
    canGenerateMasterOutline?: boolean;
    canDeriveDetails?: boolean;
  }>(),
  {
    aiBusyAction: null,
    canGenerateMasterOutline: false,
    canDeriveDetails: false,
  },
);

const emit = defineEmits<{
  'generate-master': [];
  'derive-details': [];
  'open-help': [];
}>();
</script>
