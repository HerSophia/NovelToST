<template>
  <BaseCard title="生成结果" collapsible :collapsed="collapsed" @update:collapsed="emit('update:collapsed', $event)">
    <template #actions>
      <span class="text-[10px] text-slate-500">
        {{ wbStore.generatedEntries.length }} 条目
      </span>
    </template>

    <div v-if="wbStore.generatedEntries.length === 0" class="py-6 text-center text-xs text-slate-500">
      暂无生成结果。
    </div>

    <div v-else class="grid gap-2">
      <!-- Filter -->
      <div class="flex items-center gap-2">
        <BaseInput
          v-model="searchQuery"
          placeholder="搜索条目..."
          class="flex-1"
        />
        <BaseSelect v-model="filterCategory" class="w-32">
          <option value="">全部分类</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </BaseSelect>
      </div>

      <!-- Entry count -->
      <div class="text-[10px] text-slate-500">
        显示 {{ filteredEntries.length }} / {{ wbStore.generatedEntries.length }} 条目
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 rounded border border-white/5 bg-white/[0.01] px-2 py-1.5">
        <div class="flex items-center gap-2">
          <BaseCheckbox
            :model-value="allFilteredSelected"
            label="全选当前筛选"
            @update:model-value="toggleSelectFiltered"
          />
          <button
            class="text-[10px] text-slate-500 hover:text-slate-300"
            :disabled="selectedEntryIds.length === 0"
            @click="clearSelection"
          >
            清空选择
          </button>
        </div>
        <span class="text-[10px] text-slate-500">已选 {{ selectedEntryIds.length }} 条</span>
      </div>

      <!-- Entries list -->
      <div class="max-h-80 overflow-y-auto">
        <div
          v-for="entry in filteredEntries"
          :key="entry.id"
          class="mb-2 rounded border bg-white/[0.02] p-2"
          :class="isSelected(entry.id) ? 'border-cyan-400/40' : 'border-white/5'"
        >
          <div class="mb-1.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <BaseCheckbox
                :model-value="isSelected(entry.id)"
                @update:model-value="toggleEntrySelection(entry.id, $event)"
              />
              <span class="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300">
                {{ entry.category }}
              </span>
              <span class="text-xs font-medium text-slate-200">{{ entry.name }}</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                class="p-1 text-[10px] text-cyan-400 hover:text-cyan-300"
                title="重Roll此条目"
                @click="emit('reroll-entry', entry)"
              >
                ↻
              </button>
              <button
                class="p-1 text-[10px] text-rose-400 hover:text-rose-300"
                title="删除此条目"
                @click="emit('remove-entry', entry.id)"
              >
                ✕
              </button>
            </div>
          </div>

          <div v-if="entry.keywords.length > 0" class="mb-1 flex flex-wrap gap-1">
            <span
              v-for="kw in entry.keywords"
              :key="kw"
              class="rounded bg-slate-700/50 px-1 py-0.5 text-[10px] text-slate-400"
            >
              {{ kw }}
            </span>
          </div>

          <div class="text-[11px] leading-relaxed text-slate-400">
            {{ truncateContent(entry.content) }}
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 border-t border-white/5 pt-2">
        <BaseButton variant="ghost" size="sm" @click="emit('open-search-replace')">
          搜索替换
        </BaseButton>
        <BaseButton variant="ghost" size="sm" @click="emit('export-entries')">
          导出条目
        </BaseButton>
        <BaseButton variant="ghost" size="sm" @click="emit('import-entries')">
          导入条目
        </BaseButton>
        <BaseButton variant="danger" :disabled="selectedEntryIds.length === 0" @click="removeSelectedEntries">
          删除选中（{{ selectedEntryIds.length }}）
        </BaseButton>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useWorldbookStore } from '../../../stores/worldbook.store';
import BaseButton from '../../base/BaseButton.vue';
import BaseCard from '../../base/BaseCard.vue';
import BaseCheckbox from '../../base/BaseCheckbox.vue';
import BaseInput from '../../base/BaseInput.vue';
import BaseSelect from '../../base/BaseSelect.vue';
import type { WorldbookEntry } from '../../../types/worldbook';

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  'update:collapsed': [value: boolean];
  'reroll-entry': [entry: WorldbookEntry];
  'remove-entry': [entryId: string];
  'open-search-replace': [];
  'remove-entries': [entryIds: string[]];
  'export-entries': [];
  'import-entries': [];
}>();

const wbStore = useWorldbookStore();

const searchQuery = ref('');
const filterCategory = ref('');
const selectedEntryIds = ref<string[]>([]);

const categories = computed(() => {
  const set = new Set<string>();
  for (const entry of wbStore.generatedEntries) {
    if (entry.category) set.add(entry.category);
  }
  return Array.from(set).sort();
});

const filteredEntries = computed(() => {
  let entries = wbStore.generatedEntries;

  if (filterCategory.value) {
    entries = entries.filter((e) => e.category === filterCategory.value);
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase();
    entries = entries.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        e.content.toLowerCase().includes(query) ||
        e.keywords.some((kw) => kw.toLowerCase().includes(query)),
    );
  }

  return entries;
});

const allFilteredSelected = computed(() => {
  if (filteredEntries.value.length === 0) {
    return false;
  }

  const selectedSet = new Set(selectedEntryIds.value);
  return filteredEntries.value.every(entry => selectedSet.has(entry.id));
});

function isSelected(entryId: string): boolean {
  return selectedEntryIds.value.includes(entryId);
}

function toggleEntrySelection(entryId: string, checked: boolean): void {
  if (checked) {
    selectedEntryIds.value = Array.from(new Set([...selectedEntryIds.value, entryId]));
    return;
  }

  selectedEntryIds.value = selectedEntryIds.value.filter(id => id !== entryId);
}

function toggleSelectFiltered(checked: boolean): void {
  if (!checked) {
    clearSelection();
    return;
  }

  const nextIds = new Set(selectedEntryIds.value);
  for (const entry of filteredEntries.value) {
    nextIds.add(entry.id);
  }
  selectedEntryIds.value = Array.from(nextIds);
}

function clearSelection(): void {
  selectedEntryIds.value = [];
}

function removeSelectedEntries(): void {
  if (selectedEntryIds.value.length === 0) return;
  emit('remove-entries', [...selectedEntryIds.value]);
  selectedEntryIds.value = [];
}

function truncateContent(content: string, maxLen = 200): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + '...';
}

watch(
  () => wbStore.generatedEntries.map(entry => entry.id),
  (currentIds) => {
    const valid = new Set(currentIds);
    selectedEntryIds.value = selectedEntryIds.value.filter(id => valid.has(id));
  },
  { immediate: true },
);
</script>
