<template>
  <VueFinalModal
    :model-value="modelValue"
    class="flex items-center justify-center"
    content-class="w-[min(480px,92vw)] rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-xl"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold">确认重Roll</h2>
      <button class="text-slate-400 hover:text-white" @click="emit('update:modelValue', false)">✕</button>
    </div>

    <div class="mb-4 text-sm text-slate-300">
      <template v-if="mode === 'chunk'">
        <p>将重新处理记忆块 <strong class="text-violet-300">#{{ targetIndex + 1 }}</strong>，</p>
        <p class="mt-1 text-[11px] text-slate-400">该块已有的条目将被替换为新生成的结果。</p>
      </template>
      <template v-else>
        <p>将重新生成条目 <strong class="text-cyan-300">"{{ targetEntryName }}"</strong>，</p>
        <p class="mt-1 text-[11px] text-slate-400">原条目内容将被替换。</p>
      </template>
    </div>

    <div class="flex justify-end gap-2">
      <button
        class="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
        @click="emit('update:modelValue', false)"
      >
        取消
      </button>
      <button
        class="rounded bg-violet-500 px-3 py-1.5 text-sm text-white hover:bg-violet-400"
        @click="handleConfirm"
      >
        确认重Roll
      </button>
    </div>
  </VueFinalModal>
</template>

<script setup lang="ts">
import { VueFinalModal } from 'vue-final-modal';

defineProps<{
  modelValue: boolean;
  mode: 'chunk' | 'entry';
  targetIndex: number;
  targetEntryName: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'confirm': [];
}>();

function handleConfirm() {
  emit('confirm');
  emit('update:modelValue', false);
}
</script>
