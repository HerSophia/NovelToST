<template>
  <div
    v-if="props.state"
    data-foundation-generation-reminder-modal
    class="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 p-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-lg rounded-xl border border-amber-400/20 bg-slate-900 p-4 text-slate-100 shadow-2xl">
      <div class="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p class="text-sm font-semibold text-amber-50">{{ props.state.title }}</p>
          <p class="mt-1 text-xs whitespace-pre-wrap text-slate-300">{{ props.state.description }}</p>
        </div>
        <BaseButton variant="ghost" data-foundation-generation-action="close-reminder" @click="emit('close')">关闭</BaseButton>
      </div>

      <section class="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <p class="text-xs text-slate-300">建议补充后再{{ props.state.actionLabel }}：</p>
        <ul class="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-100/90">
          <li v-for="item in props.state.recommendedItems" :key="item" data-foundation-generation-reminder-item>
            {{ item }}
          </li>
        </ul>
      </section>

      <p class="mt-3 text-[11px] text-slate-400">你也可以直接继续。系统不会改动当前故事基底内容。</p>

      <div class="mt-4 flex justify-end gap-2">
        <BaseButton variant="ghost" data-foundation-generation-action="cancel-reminder" @click="emit('close')">
          {{ props.state.cancelText }}
        </BaseButton>
        <BaseButton variant="ghost" data-foundation-generation-action="confirm-reminder" class="border border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25" @click="emit('confirm')">
          {{ props.state.confirmText }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '../../base/BaseButton.vue';
import type { FoundationGenerationReminderState } from '../../../composables/useOutlineControl';

const props = withDefaults(
  defineProps<{
    state?: FoundationGenerationReminderState | null;
  }>(),
  {
    state: null,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();
</script>
