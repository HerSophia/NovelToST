<template>
  <div class="grid gap-1.5">
    <label v-if="label" class="text-[11px] tracking-wide text-slate-400 uppercase">
      {{ label }}
    </label>
    <textarea
      v-bind="$attrs"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full border border-white/15 bg-transparent px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-600 focus:border-cyan-400/60 focus:bg-white/[0.03] focus:ring-1 focus:ring-cyan-400/35 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      @input="updateValue"
    ></textarea>
    <div v-if="hint" class="text-[10px] text-slate-500">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
});

withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    rows?: number;
    placeholder?: string;
    disabled?: boolean;
    hint?: string;
  }>(),
  {
    modelValue: '',
    label: '',
    rows: 3,
    placeholder: '',
    disabled: false,
    hint: '',
  },
);

const emit = defineEmits(['update:modelValue']);

const updateValue = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
};
</script>
