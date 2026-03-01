<template>
  <button
    type="button"
    class="inline-flex size-6 items-center justify-center rounded border border-white/10 bg-white/[0.03] text-[13px] leading-none text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
    :title="title"
    :aria-label="title"
    :data-help-topic="topic"
    @click.stop.prevent="emit('trigger')"
  >
    ❓
  </button>
</template>

<script setup lang="ts">
import type { HelpTopicId } from '../../help/help-topics';

withDefaults(
  defineProps<{
    title?: string;
    topic: HelpTopicId;
  }>(),
  {
    title: '查看帮助',
  },
);

const emit = defineEmits<{
  trigger: [];
}>();
</script>
