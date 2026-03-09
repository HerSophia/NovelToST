<template>
  <div ref="rootRef" class="grid gap-1.5">
    <label v-if="label" class="text-[11px] tracking-wide text-slate-400 uppercase">
      {{ label }}
    </label>

    <div class="relative" @keydown.esc.prevent="closeDropdown">
      <button
        v-bind="$attrs"
        type="button"
        :disabled="triggerDisabled"
        :aria-expanded="isOpen"
        aria-haspopup="listbox"
        class="flex w-full items-center justify-between border border-white/15 bg-transparent px-3 py-2 text-left text-sm text-slate-100 transition-colors focus:border-cyan-400/60 focus:bg-white/[0.03] focus:ring-1 focus:ring-cyan-400/35 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        :class="isOpen ? 'border-cyan-400/60 bg-white/[0.03]' : ''"
        @click="toggleDropdown"
      >
        <span class="truncate" :class="selectedOption ? 'text-slate-100' : 'text-slate-500'">
          {{ displayLabel }}
        </span>

        <svg
          class="size-4 shrink-0 text-slate-500 transition-transform"
          :class="isOpen ? 'rotate-180 text-cyan-200' : ''"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        v-if="isOpen"
        v-bind="listDataAttrs"
        role="listbox"
        class="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-white/15 bg-slate-900 shadow-lg"
      >
        <p v-if="normalizedOptions.length === 0" class="px-3 py-2 text-xs text-slate-500">
          {{ emptyText }}
        </p>

        <button
          v-for="option in normalizedOptions"
          :key="option.key"
          v-bind="buildItemDataAttrs(option.value)"
          type="button"
          role="option"
          :aria-selected="modelValue === option.value"
          :disabled="option.disabled"
          class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
          :class="
            modelValue === option.value
              ? 'bg-cyan-500/20 text-cyan-100'
              : 'text-slate-200 hover:bg-white/10 hover:text-white'
          "
          @click="selectOption(option.value)"
        >
          <span class="truncate">{{ option.label }}</span>
          <span v-if="modelValue === option.value" class="text-[10px] text-cyan-200">✓</span>
        </button>
      </div>
    </div>

    <div v-if="hint" class="text-[10px] text-slate-500">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

defineOptions({
  inheritAttrs: false,
});

export type BaseDropdownSelectOption = string | number | Record<string, unknown>;

type NormalizedBaseDropdownSelectOption = {
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
    options?: BaseDropdownSelectOption[];
    optionLabelKey?: string;
    optionValueKey?: string;
    optionDisabledKey?: string;
    placeholder?: string;
    emptyText?: string;
    listDataAttrName?: string;
    itemDataAttrName?: string;
  }>(),
  {
    modelValue: '',
    label: '',
    disabled: false,
    hint: '',
    options: () => [],
    optionLabelKey: 'label',
    optionValueKey: 'value',
    optionDisabledKey: 'disabled',
    placeholder: '请选择',
    emptyText: '暂无可选项',
    listDataAttrName: '',
    itemDataAttrName: '',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const rootRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);

const normalizedOptions = computed<NormalizedBaseDropdownSelectOption[]>(() => {
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

const selectedOption = computed(() => {
  return normalizedOptions.value.find(option => option.value === props.modelValue) ?? null;
});

const displayLabel = computed(() => {
  if (selectedOption.value) {
    return selectedOption.value.label;
  }

  if (normalizedOptions.value.length === 0) {
    return props.emptyText;
  }

  return props.placeholder;
});

const triggerDisabled = computed(() => {
  return props.disabled || normalizedOptions.value.length === 0;
});

const listDataAttrs = computed(() => {
  if (!props.listDataAttrName) {
    return {};
  }

  return {
    [props.listDataAttrName]: '',
  };
});

const buildItemDataAttrs = (value: string | number) => {
  if (!props.itemDataAttrName) {
    return {};
  }

  return {
    [props.itemDataAttrName]: String(value),
  };
};

const closeDropdown = () => {
  isOpen.value = false;
};

const toggleDropdown = () => {
  if (triggerDisabled.value) {
    return;
  }

  isOpen.value = !isOpen.value;
};

const selectOption = (value: string | number) => {
  const option = normalizedOptions.value.find(item => item.value === value);
  if (!option || option.disabled) {
    return;
  }

  if (props.modelValue !== value) {
    emit('update:modelValue', value);
  }

  closeDropdown();
};

const handleDocumentPointerDown = (event: Event) => {
  if (!isOpen.value) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (rootRef.value?.contains(target)) {
    return;
  }

  closeDropdown();
};

watch(
  () => props.disabled,
  disabled => {
    if (disabled) {
      closeDropdown();
    }
  },
);

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
});
</script>
