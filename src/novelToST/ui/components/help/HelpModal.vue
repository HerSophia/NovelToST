<template>
  <VueFinalModal
    :model-value="modelValue"
    class="flex items-center justify-center"
    content-class="w-[min(760px,95vw)] max-h-[86vh] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-xl"
    :click-to-close="true"
    :esc-to-close="true"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <div class="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3">
      <div>
        <h3 class="text-base font-semibold">{{ activeTopic.title }}</h3>
        <p class="mt-1 text-xs leading-relaxed text-slate-300">{{ activeTopic.summary }}</p>
      </div>
      <button
        type="button"
        class="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
        title="关闭帮助"
        @click="emit('update:modelValue', false)"
      >
        关闭
      </button>
    </div>

    <div class="border-b border-white/10 px-4 py-2">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="topicId in topicOrder"
          :key="topicId"
          type="button"
          class="rounded border px-2 py-1 text-[11px] transition"
          :class="topicId === topic ? 'border-blue-400/40 bg-blue-500/15 text-blue-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'"
          :data-help-topic-tab="topicId"
          @click="emit('update:topic', topicId)"
        >
          {{ HELP_TOPICS[topicId].title }}
        </button>
      </div>
    </div>

    <div class="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-4">
      <section
        v-for="section in activeTopic.sections"
        :key="section.heading"
        class="space-y-2 rounded border border-white/8 bg-white/[0.02] p-3"
      >
        <h4 class="text-xs font-semibold tracking-[0.12em] text-slate-300 uppercase">
          {{ section.heading }}
        </h4>

        <div v-if="section.paragraphs" class="space-y-1.5 text-sm leading-relaxed text-slate-200">
          <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
        </div>

        <ul v-if="section.bullets" class="list-disc space-y-1 pl-4 text-sm text-slate-200">
          <li v-for="bullet in section.bullets" :key="bullet">{{ bullet }}</li>
        </ul>

        <pre v-if="section.codeBlock" class="overflow-x-auto rounded border border-white/10 bg-black/35 p-2 text-xs text-slate-200"><code>{{ section.codeBlock }}</code></pre>
      </section>
    </div>
  </VueFinalModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { VueFinalModal } from 'vue-final-modal';
import { HELP_TOPICS, HELP_TOPIC_ORDER, type HelpTopicId } from '../../help/help-topics';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    topic?: HelpTopicId;
  }>(),
  {
    topic: 'generate',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:topic': [value: HelpTopicId];
}>();

const topicOrder = HELP_TOPIC_ORDER;

const activeTopic = computed(() => HELP_TOPICS[props.topic]);
</script>
