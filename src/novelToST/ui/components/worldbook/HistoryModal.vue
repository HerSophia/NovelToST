<template>
  <VueFinalModal
    :model-value="modelValue"
    class="flex items-center justify-center"
    content-class="w-[min(640px,94vw)] max-h-[80vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-xl"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold">处理历史</h2>
      <button class="text-slate-400 hover:text-white" @click="emit('update:modelValue', false)">✕</button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="py-8 text-center text-sm text-slate-500">加载中...</div>

      <div v-else-if="historyRecords.length === 0" class="py-8 text-center text-sm text-slate-500">
        暂无历史记录。
      </div>

      <div v-else class="grid gap-2">
        <div
          v-for="record in historyRecords"
          :key="record.id"
          class="rounded border border-white/5 bg-white/[0.02] p-3"
        >
          <div class="mb-1.5 flex items-center justify-between">
            <div>
              <span class="text-xs font-medium text-slate-200">#{{ record.id }}</span>
              <span class="ml-2 text-[11px] text-slate-400">{{ record.memoryTitle }}</span>
            </div>
            <span class="text-[10px] text-slate-500">{{ formatTimestamp(record.timestamp) }}</span>
          </div>

          <div class="mb-2 text-[11px] text-slate-500">
            记忆块索引: {{ record.memoryIndex }}
            <span v-if="record.changedEntries && record.changedEntries.length > 0">
              · {{ record.changedEntries.length }} 项变更
            </span>
          </div>

          <div v-if="record.changedEntries && record.changedEntries.length > 0" class="mb-2 max-h-24 overflow-y-auto">
            <div
              v-for="(change, idx) in record.changedEntries.slice(0, 10)"
              :key="idx"
              class="flex items-center gap-1 text-[10px]"
            >
              <span :class="changeTypeClass(change.type)">{{ changeTypeIcon(change.type) }}</span>
              <span class="text-amber-400">{{ change.category }}</span>
              <span class="text-slate-400">{{ change.entryName }}</span>
            </div>
            <div v-if="record.changedEntries.length > 10" class="mt-1 text-[10px] text-slate-500">
              ... 还有 {{ record.changedEntries.length - 10 }} 项
            </div>
          </div>

          <button
            class="rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/20"
            @click="confirmRollback(record.id)"
          >
            回退到此版本
          </button>
        </div>
      </div>
    </div>
  </VueFinalModal>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { VueFinalModal } from 'vue-final-modal';
import { worldbookHistoryDB } from '../../../core/worldbook/history-db.service';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'rollback': [historyId: number];
}>();

const loading = ref(false);
const historyRecords = ref<any[]>([]);

async function loadHistory() {
  loading.value = true;
  try {
    const records = await worldbookHistoryDB.getAllHistory();
    historyRecords.value = records;
  } catch (error) {
    console.warn('[worldbook] Failed to load history:', error);
    historyRecords.value = [];
  } finally {
    loading.value = false;
  }
}

function confirmRollback(historyId: number) {
  if (confirm('确定回退到此版本？当前未保存的更改将丢失。')) {
    emit('rollback', historyId);
    emit('update:modelValue', false);
  }
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function changeTypeIcon(type: string): string {
  if (type === 'add') return '➕';
  if (type === 'modify') return '✏️';
  if (type === 'delete') return '❌';
  return '?';
}

function changeTypeClass(type: string): string {
  if (type === 'add') return 'text-emerald-400';
  if (type === 'modify') return 'text-blue-400';
  if (type === 'delete') return 'text-rose-400';
  return 'text-slate-400';
}

watch(() => props.modelValue, (open) => {
  if (open) loadHistory();
});

onMounted(() => {
  if (props.modelValue) loadHistory();
});
</script>
