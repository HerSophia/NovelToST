<template>
  <BaseTextarea
    :model-value="props.modelValue"
    data-conversation-composer
    :rows="props.rows"
    :label="props.label"
    :placeholder="props.placeholder"
    :hint="props.hint"
    :disabled="props.disabled"
    @update:model-value="(value: string) => emit('update:modelValue', value)"
    @keydown="handleKeydown"
    @input="(e: Event) => emit('input', e)"
    @click="(e: Event) => emit('caret-change', e)"
    @keyup="(e: Event) => emit('caret-change', e)"
    @focus="(e: Event) => emit('caret-change', e)"
    @compositionstart="() => emit('composition-start')"
    @compositionend="(e: CompositionEvent) => emit('composition-end', e)"
  />
</template>

<script setup lang="ts">
import BaseTextarea from '../../base/BaseTextarea.vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    placeholder?: string;
    hint?: string;
    disabled?: boolean;
    rows?: number;
  }>(),
  {
    modelValue: '',
    label: '',
    placeholder: '输入你的指令…',
    hint: '快捷键：Ctrl + Enter（Mac 为 Command + Enter）可直接发送。',
    disabled: false,
    rows: 3,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'submit': [];
  'keydown': [event: KeyboardEvent];
  'input': [event: Event];
  'caret-change': [event: Event];
  'composition-start': [];
  'composition-end': [event: CompositionEvent];
}>();

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    emit('submit');
    return;
  }

  emit('keydown', event);
};
</script>
