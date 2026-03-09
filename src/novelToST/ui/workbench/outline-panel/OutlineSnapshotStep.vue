<template>
  <div data-outline-step="3-snapshot" class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
    <div class="mb-2 flex items-start justify-between gap-2">
      <div>
        <h3 class="text-sm font-medium text-white">📋 草案版本</h3>
        <p class="mt-0.5 text-[11px] text-slate-400">AI 每次成功产出都会保存为草案，你可以预览后选择应用</p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          data-outline-action="toggle-step-3-snapshot"
          class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
          :aria-expanded="!props.collapsed"
          aria-controls="outline-step-panel-3-snapshot"
          @click="emit('toggle-collapse')"
        >
          {{ props.collapsed ? '展开' : '收起' }}
        </button>
      </div>
    </div>

    <div
      v-show="!props.collapsed"
      id="outline-step-panel-3-snapshot"
      data-outline-step-content="3-snapshot"
      class="space-y-2"
    >
      <div v-if="props.snapshots.length === 0" class="text-xs text-slate-500">
        还没有草案。发送消息后，AI 成功生成的大纲会自动出现在这里。
      </div>

      <div v-else class="space-y-1.5" data-outline-snapshot-list>
        <button
          v-for="snapshot in props.snapshots"
          :key="snapshot.id"
          data-outline-snapshot-item
          type="button"
          class="w-full rounded-md border px-2 py-1.5 text-left text-xs transition"
          :class="
            props.activeSnapshotId === snapshot.id
              ? 'border-violet-400/70 bg-violet-500/20 text-violet-100'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          "
          @click="emit('select-snapshot', snapshot)"
        >
          <p class="font-medium">
            草案 #{{ snapshot.version }}
            <span
              v-if="snapshot.id === props.appliedSnapshotId"
              data-outline-snapshot-applied-badge
              class="ml-1 text-[10px] text-emerald-400"
            >✅ 已应用</span>
          </p>
          <p class="text-[11px] text-slate-400">
            {{ snapshot.storylines.length }} 条故事线 · {{ snapshot.masterOutline.length }} 个节点
            <span v-if="props.activeSnapshotDetailChapterCount > 0"> · {{ props.activeSnapshotDetailChapterCount }} 章细纲</span>
          </p>
          <p class="text-[10px] text-slate-500">{{ snapshot.createdAt }}</p>
        </button>
      </div>

      <div v-if="props.activeSnapshot" data-outline-snapshot-preview class="rounded-md border border-white/10 bg-black/15 p-2.5">
        <p class="text-xs font-medium text-slate-300">
          预览：{{ props.activeSnapshot.storylines.length }} 条故事线，{{ props.activeSnapshot.masterOutline.length }} 个节点，
          {{ props.activeSnapshotDetailChapterCount }}章细纲
        </p>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <BaseButton
            variant="success"
            data-outline-action="apply-snapshot-safe"
            :disabled="isCurrentSnapshotApplied"
            @click="!isCurrentSnapshotApplied && emit('apply-snapshot-safe')"
          >
            {{ isCurrentSnapshotApplied ? '✅ 已应用' : '✅ 应用到大纲' }}
          </BaseButton>
        </div>

        <p class="mt-1.5 text-[11px] text-slate-500">应用后会更新故事线和大纲节点，已锁定的内容不受影响。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseButton from '../../base/BaseButton.vue';
import type { OutlineSnapshot } from '../../../types/outline';

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
    snapshots?: OutlineSnapshot[];
    activeSnapshotId?: string | null;
    activeSnapshot?: OutlineSnapshot | null;
    activeSnapshotDetailChapterCount?: number;
    appliedSnapshotId?: string | null;
  }>(),
  {
    collapsed: false,
    snapshots: () => [],
    activeSnapshotId: null,
    activeSnapshot: null,
    activeSnapshotDetailChapterCount: 0,
    appliedSnapshotId: null,
  },
);

const emit = defineEmits<{
  'toggle-collapse': [];
  'select-snapshot': [snapshot: OutlineSnapshot];
  'apply-snapshot-safe': [];
}>();

const isCurrentSnapshotApplied = computed(() => {
  if (!props.activeSnapshot || !props.appliedSnapshotId) {
    return false;
  }
  return props.activeSnapshot.id === props.appliedSnapshotId;
});
</script>
