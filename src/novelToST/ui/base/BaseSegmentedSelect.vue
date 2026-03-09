<template>
  <div class="grid gap-1.5">
    <label v-if="label" class="text-[11px] tracking-wide text-slate-400 uppercase">
      {{ label }}
    </label>

    <div v-bind="groupDataAttrs" class="inline-flex w-fit items-center gap-1 rounded-md border border-white/10 bg-black/15 p-1">
      <button
        v-for="option in options"
        :key="option.value"
        v-bind="buildItemDataAttrs(option.value)"
        type="button"
        class="rounded border transition"
        :class="[
          sizeClasses,
          modelValue === option.value
            ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
          disabled || option.disabled ? 'cursor-not-allowed opacity-50' : '',
        ]"
        :disabled="disabled || option.disabled"
        :aria-pressed="modelValue === option.value"
        @mousedown.prevent="handleOptionMouseDown(option.value)"
        @click="handleOptionClick(option.value, $event)"
      >
        {{ option.label }}
      </button>
    </div>

    <p v-if="hint" class="text-[10px] text-slate-500">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export type BaseSegmentedSelectOptionValue = string | number;

export type BaseSegmentedSelectOption = {
  value: BaseSegmentedSelectOptionValue;
  label: string;
  disabled?: boolean;
};

const props = withDefaults(
  defineProps<{
    modelValue?: BaseSegmentedSelectOptionValue;
    options: BaseSegmentedSelectOption[];
    label?: string;
    hint?: string;
    disabled?: boolean;
    size?: 'sm' | 'md';
    groupDataAttrName?: string;
    itemDataAttrName?: string;
  }>(),
  {
    modelValue: '',
    label: '',
    hint: '',
    disabled: false,
    size: 'md',
    groupDataAttrName: '',
    itemDataAttrName: '',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: BaseSegmentedSelectOptionValue];
}>();

const sizeClasses = computed(() => {
  if (props.size === 'sm') {
    return 'px-1.5 py-0.5 text-[10px]';
  }

  return 'px-2 py-1 text-xs';
});

const groupDataAttrs = computed(() => {
  if (!props.groupDataAttrName) {
    return {};
  }

  return {
    [props.groupDataAttrName]: '',
  };
});

const buildItemDataAttrs = (value: BaseSegmentedSelectOptionValue) => {
  if (!props.itemDataAttrName) {
    return {};
  }

  return {
    [props.itemDataAttrName]: String(value),
  };
};

const handleOptionMouseDown = (value: BaseSegmentedSelectOptionValue) => {
  selectOption(value);
};

const handleOptionClick = (value: BaseSegmentedSelectOptionValue, event: MouseEvent) => {
  /**
   * 鼠标点击会先触发 mousedown，并在 mousedown 阶段完成选择。
   * click 只保留键盘触发路径（detail === 0），避免重复触发 update:modelValue。
   */
  if (event.detail > 0) {
    return;
  }

  selectOption(value);
};
const selectOption = (value: BaseSegmentedSelectOptionValue) => {
  if (props.disabled || value === props.modelValue) {
    return;
  }

  emit('update:modelValue', value);
};
</script>
