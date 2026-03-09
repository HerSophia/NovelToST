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
        <template v-if="useOptionsMode">
          <option v-if="placeholder" value="">
            {{ placeholder }}
          </option>
          <option
            v-for="option in normalizedOptions"
            :key="option.key"
            :value="option.value"
            :disabled="option.disabled"
          >
            {{ option.label }}
          </option>
          <option v-if="normalizedOptions.length === 0 && emptyText" value="" disabled>
            {{ emptyText }}
          </option>
        </template>
        <slot v-else />
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
import { computed } from 'vue';

defineOptions({
  inheritAttrs: false,
});

type BaseSelectOption = string | number | Record<string, unknown>;

type NormalizedBaseSelectOption = {
  key: string;
  value: string | number;
  label: string;
  disabled: boolean;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    label?: string;
    disabled?: boolean;
    hint?: string;
    options?: BaseSelectOption[];
    optionLabelKey?: string;
    optionValueKey?: string;
    optionDisabledKey?: string;
    placeholder?: string;
    emptyText?: string;
  }>(),
  {
    modelValue: '',
    label: '',
    disabled: false,
    options: undefined,
    hint: '',
    optionLabelKey: 'label',
    optionValueKey: 'value',
    optionDisabledKey: 'disabled',
    placeholder: '',
    emptyText: '暂无可选项',
  },
);

const emit = defineEmits(['update:modelValue']);

const useOptionsMode = computed(() => Array.isArray(props.options));

const normalizedOptions = computed<NormalizedBaseSelectOption[]>(() => {
  if (!Array.isArray(props.options)) {
    return [];
  }

  return props.options.map((option, index) => {
    if (typeof option === 'string' || typeof option === 'number') {
      return {
        key: `${option}-${index}`,
        value: option,
        label: String(option),
        disabled: false,
      };
    }

    const rawValue = option[props.optionValueKey];
    const normalizedValue = typeof rawValue === 'number' || typeof rawValue === 'string' ? rawValue : String(index);

    const rawLabel = option[props.optionLabelKey];
    const normalizedLabel =
      typeof rawLabel === 'string' || typeof rawLabel === 'number' ? String(rawLabel) : String(normalizedValue);

    const rawDisabled = option[props.optionDisabledKey];

    return {
      key: `${normalizedValue}-${index}`,
      value: normalizedValue,
      label: normalizedLabel,
      disabled: rawDisabled === true,
    };
  });
});

const updateValue = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
};
</script>
