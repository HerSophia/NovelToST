<template>
  <BaseCard title="记忆队列" collapsible :collapsed="collapsed" @update:collapsed="emit('update:collapsed', $event)">
    <template #actions>
      <span class="text-[10px] text-slate-500">
        {{ wbStore.finishedChunks }} / {{ wbStore.totalChunks }}
      </span>
    </template>

    <div v-if="wbStore.totalChunks === 0" class="py-6 text-center text-xs text-slate-500">
      暂无记忆块。请先加载文本并开始处理。
    </div>

    <div v-else class="grid gap-2">
      <!-- Progress bar -->
      <div>
        <div class="mb-1 flex justify-between text-[10px] text-slate-500">
          <span>进度</span>
          <span>{{ wbStore.progressPercent }}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-slate-800/50">
          <div
            class="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
            :style="{ width: `${wbStore.progressPercent}%` }"
          ></div>
        </div>
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-4 gap-2 border-t border-white/5 pt-2 text-center">
        <div>
          <div class="text-[9px] tracking-wider text-slate-500 uppercase">总数</div>
          <div class="text-xs font-medium text-slate-200">{{ wbStore.totalChunks }}</div>
        </div>
        <div>
          <div class="text-[9px] tracking-wider text-slate-500 uppercase">成功</div>
          <div class="text-xs font-medium text-emerald-400">{{ wbStore.successfulChunks }}</div>
        </div>
        <div>
          <div class="text-[9px] tracking-wider text-slate-500 uppercase">失败</div>
          <div class="text-xs font-medium text-rose-400">{{ wbStore.failedChunks }}</div>
        </div>
        <div>
          <div class="text-[9px] tracking-wider text-slate-500 uppercase">剩余</div>
          <div class="text-xs font-medium text-slate-300">{{ wbStore.remainingChunks }}</div>
        </div>
      </div>

      <div
        v-if="failedChunksForRepair.length > 0"
        class="rounded border border-rose-500/30 bg-rose-500/5 p-2"
      >
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <span class="text-[10px] font-medium text-rose-300">
            失败修复队列（{{ failedChunksForRepair.length }}）
          </span>
          <button
            class="text-[10px] text-rose-300 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="wbStore.isActive"
            @click="emit('retry-all-failed')"
          >
            全部重试
          </button>
        </div>

        <div class="grid max-h-32 gap-1.5 overflow-y-auto">
          <div
            v-for="chunk in failedChunksForRepair"
            :key="`failed-${chunk.id}`"
            class="flex items-start justify-between gap-2 rounded border border-white/10 bg-black/10 px-2 py-1.5"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate text-[10px] text-slate-200">
                块 #{{ chunk.index + 1 }} · {{ chunk.title || `块 ${chunk.index + 1}` }}
              </div>
              <div class="mt-0.5 text-[10px] leading-snug break-all text-rose-200/90">
                {{ chunkFailureReason(chunk) }}
              </div>
              <div class="mt-0.5 text-[9px] text-slate-500">失败次数：{{ chunk.retryCount }}</div>
            </div>

            <button
              class="shrink-0 text-[10px] text-violet-300 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="wbStore.isActive || chunk.processing"
              @click="emit('retry-failed-chunk', chunk.index)"
            >
              {{ chunk.processing ? '重试中...' : '重试' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Chunk list -->
      <div class="max-h-64 overflow-y-auto">
        <div
          v-for="chunk in wbStore.chunks"
          :key="chunk.id"
          class="flex items-center justify-between border-b border-white/5 px-1 py-1.5 last:border-0"
        >
          <div class="flex items-center gap-2">
            <!-- Status indicator -->
            <span
              class="inline-flex size-2 rounded-full"
              :class="chunkStatusClass(chunk)"
            ></span>
            <span class="max-w-[180px] truncate text-[11px] text-slate-300">{{ chunk.title || `块 ${chunk.index + 1}` }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-slate-500">~{{ chunk.estimatedTokens }} tok</span>
            <button
              v-if="!wbStore.isActive"
              class="text-[10px] text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              title="向上合并"
              :disabled="chunk.index === 0"
              @click="emit('merge-up', chunk.index)"
            >
              ↑合并
            </button>
            <button
              v-if="!wbStore.isActive"
              class="text-[10px] text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              title="向下合并"
              :disabled="chunk.index >= wbStore.totalChunks - 1"
              @click="emit('merge-down', chunk.index)"
            >
              ↓合并
            </button>
            <button
              v-if="chunk.processed || chunk.failed"
              class="text-[10px] text-violet-400 hover:text-violet-300"
              title="重Roll此记忆块"
              :disabled="wbStore.isActive"
              @click="emit('reroll-chunk', chunk.index)"
            >
              ↻
            </button>
          </div>
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWorldbookStore } from '../../../stores/worldbook.store';
import BaseCard from '../../base/BaseCard.vue';
import type { MemoryChunk } from '../../../types/worldbook';

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  'update:collapsed': [value: boolean];
  'reroll-chunk': [index: number];
  'merge-up': [index: number];
  'merge-down': [index: number];
  'retry-failed-chunk': [index: number];
  'retry-all-failed': [];
}>();

const wbStore = useWorldbookStore();

const failedChunksForRepair = computed(() => wbStore.chunks.filter((chunk) => chunk.failed));

function chunkFailureReason(chunk: MemoryChunk): string {
  if (chunk.errorMessage) {
    return chunk.errorMessage;
  }

  const latestError = [...wbStore.stats.errors]
    .reverse()
    .find((error) => error.chunkId === chunk.id);

  return latestError?.message ?? '未知错误';
}

function chunkStatusClass(chunk: MemoryChunk): string {
  if (chunk.processing) return 'bg-blue-400 animate-pulse';
  if (chunk.processed) return 'bg-emerald-400';
  if (chunk.failed) return 'bg-rose-400';
  return 'bg-slate-600';
}
</script>
