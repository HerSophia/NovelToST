<template>
  <button
    :class="[
      'inline-flex items-center justify-center gap-2 border px-3 py-2 text-sm font-medium transition-colors duration-200 focus:ring-1 focus:outline-none',
      variantClasses,
      disabled ? 'cursor-not-allowed opacity-45' : '',
      block ? 'w-full' : '',
    ]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot name="icon" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';
    disabled?: boolean;
    block?: boolean;
  }>(),
  {
    variant: 'primary',
    disabled: false,
    block: false,
  },
);

defineEmits(['click']);

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'border-blue-400/35 bg-blue-500/12 text-blue-200 hover:bg-blue-500/20 focus:ring-blue-400/50';
    case 'secondary':
      return 'border-white/15 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08] focus:ring-white/30';
    case 'success':
      return 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20 focus:ring-emerald-400/50';
    case 'warning':
      return 'border-amber-400/35 bg-amber-500/12 text-amber-200 hover:bg-amber-500/20 focus:ring-amber-400/50';
    case 'danger':
      return 'border-rose-400/35 bg-rose-500/12 text-rose-200 hover:bg-rose-500/20 focus:ring-rose-400/50';
    case 'ghost':
      return 'border-white/10 bg-transparent text-slate-300 hover:bg-white/[0.06] hover:text-white focus:ring-white/25';
    default:
      return 'border-white/15 bg-white/[0.03] text-slate-200';
  }
});
</script>
