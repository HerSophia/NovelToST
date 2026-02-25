<template>
  <label :class="['inline-flex cursor-pointer items-center gap-2', disabled ? 'cursor-not-allowed opacity-50' : '']">
    <div class="relative flex items-center">
      <input
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        class="peer size-4 appearance-none border border-white/25 bg-transparent transition-all checked:border-cyan-400 checked:bg-cyan-500/20 hover:border-cyan-300 focus:ring-1 focus:ring-cyan-400/40 focus:outline-none"
        @change="updateValue"
      />
      <svg
        class="pointer-events-none absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 text-cyan-300 opacity-0 peer-checked:opacity-100"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <span class="text-xs text-slate-300">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: boolean;
    label?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: false,
    label: '',
    disabled: false,
  },
);

const emit = defineEmits(['update:modelValue']);

const updateValue = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.checked);
};
</script>
