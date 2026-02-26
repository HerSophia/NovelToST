<template>
  <VueFinalModal
    :model-value="modelValue"
    class="flex items-center justify-center"
    content-class="w-[min(540px,92vw)] rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-xl"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold">搜索替换</h2>
      <button class="text-slate-400 hover:text-white" @click="emit('update:modelValue', false)">✕</button>
    </div>

    <div class="grid gap-3">
      <BaseInput v-model="searchText" label="搜索" placeholder="输入搜索文本..." />
      <BaseInput v-model="replaceText" label="替换为" placeholder="输入替换文本..." />

      <div class="flex items-center gap-3">
        <BaseCheckbox v-model="isRegex">正则表达式</BaseCheckbox>
        <BaseCheckbox v-model="caseSensitive">区分大小写</BaseCheckbox>
      </div>

      <div v-if="searchText" class="text-[11px] text-slate-400">
        找到 {{ matchCount }} 处匹配
      </div>
    </div>

    <div class="mt-4 flex justify-end gap-2">
      <button
        class="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
        @click="emit('update:modelValue', false)"
      >
        取消
      </button>
      <button
        class="rounded bg-cyan-500 px-3 py-1.5 text-sm text-white hover:bg-cyan-400"
        :disabled="!searchText || matchCount === 0"
        @click="handleReplace"
      >
        全部替换
      </button>
    </div>
  </VueFinalModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { VueFinalModal } from 'vue-final-modal';
import { useWorldbookStore } from '../../../stores/worldbook.store';
import BaseCheckbox from '../../base/BaseCheckbox.vue';
import BaseInput from '../../base/BaseInput.vue';

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'replaced': [count: number];
}>();

const wbStore = useWorldbookStore();

const searchText = ref('');
const replaceText = ref('');
const isRegex = ref(false);
const caseSensitive = ref(false);

function buildSearchPattern(): RegExp | null {
  if (!searchText.value) return null;
  try {
    if (isRegex.value) {
      return new RegExp(searchText.value, caseSensitive.value ? 'g' : 'gi');
    }
    const escaped = searchText.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, caseSensitive.value ? 'g' : 'gi');
  } catch {
    return null;
  }
}

const matchCount = computed(() => {
  const pattern = buildSearchPattern();
  if (!pattern) return 0;

  let count = 0;
  for (const entry of wbStore.generatedEntries) {
    const nameMatches = entry.name.match(pattern);
    const contentMatches = entry.content.match(pattern);
    count += (nameMatches?.length ?? 0) + (contentMatches?.length ?? 0);
    for (const kw of entry.keywords) {
      const kwMatches = kw.match(pattern);
      count += kwMatches?.length ?? 0;
    }
  }
  return count;
});

function handleReplace() {
  const pattern = buildSearchPattern();
  if (!pattern || matchCount.value === 0) return;

  const updatedEntries = wbStore.generatedEntries.map((entry) => ({
    ...entry,
    name: entry.name.replace(pattern, replaceText.value),
    content: entry.content.replace(pattern, replaceText.value),
    keywords: entry.keywords.map((kw) => kw.replace(pattern, replaceText.value)),
  }));

  wbStore.replaceGeneratedEntries(updatedEntries);
  emit('replaced', matchCount.value);
  emit('update:modelValue', false);
}
</script>
