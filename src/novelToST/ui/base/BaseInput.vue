<template>
  <div class="grid gap-1.5">
    <label v-if="label" class="text-[11px] tracking-wide text-slate-400 uppercase">
      {{ label }}
    </label>
    <input
      v-bind="$attrs"
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :min="min"
      :max="max"
      class="w-full border border-white/15 bg-transparent px-3 py-2 text-sm text-slate-100 transition-colors placeholder:text-slate-600 focus:border-cyan-400/60 focus:bg-white/[0.03] focus:ring-1 focus:ring-cyan-400/35 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      @input="updateValue"
    />
    <div v-if="hint" class="text-[10px] text-slate-500">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    label?: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    hint?: string;
    min?: string | number;
    max?: string | number;
  }>(),
  {
    modelValue: '',
    label: '',
    type: 'text',
    placeholder: '',
    disabled: false,
    hint: '',
    min: undefined,
    max: undefined,
  },
);

const emit = defineEmits(['update:modelValue']);

const updateValue = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = props.type === 'number' ? (target.value === '' ? undefined : Number(target.value)) : target.value;
  emit('update:modelValue', value);
};
</script>
