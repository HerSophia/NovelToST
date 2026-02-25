<template>
  <div class="grid gap-1.5">
    <label v-if="label" class="text-[11px] tracking-wide text-slate-400 uppercase">
      {{ label }}
    </label>
    <div class="relative">
      <select
        v-bind="$attrs"
        :value="modelValue"
        :disabled="disabled"
        class="w-full appearance-none border border-white/15 bg-transparent px-3 py-2 pr-8 text-sm text-slate-100 transition-colors focus:border-cyan-400/60 focus:bg-white/[0.03] focus:ring-1 focus:ring-cyan-400/35 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        @change="updateValue"
      >
        <slot />
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
    <div v-if="hint" class="text-[10px] text-slate-500">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
});

withDefaults(
  defineProps<{
    modelValue?: string | number;
    label?: string;
    disabled?: boolean;
    hint?: string;
  }>(),
  {
    modelValue: '',
    label: '',
    disabled: false,
    hint: '',
  },
);

const emit = defineEmits(['update:modelValue']);

const updateValue = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
};
</script>
