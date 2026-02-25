<template>
  <VueFinalModal
    :model-value="modelValue"
    class="flex items-center justify-center"
    content-class="w-[min(540px,92vw)] rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-xl"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <div class="mb-2 text-base font-semibold">{{ title }}</div>
    <div class="mb-4 text-sm whitespace-pre-wrap text-slate-300">{{ description }}</div>

    <div class="flex justify-end gap-2">
      <button
        v-if="!hideCancel"
        class="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
        @click="emit('update:modelValue', false)"
      >
        取消
      </button>
      <button class="rounded bg-rose-500 px-3 py-1.5 text-sm text-white hover:bg-rose-400" @click="emit('confirm')">
        {{ confirmText }}
      </button>
    </div>
  </VueFinalModal>
</template>

<script setup lang="ts">
import { VueFinalModal } from 'vue-final-modal';

withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    description: string;
    confirmText?: string;
    hideCancel?: boolean;
  }>(),
  {
    confirmText: '确认',
    hideCancel: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
}>();
</script>
