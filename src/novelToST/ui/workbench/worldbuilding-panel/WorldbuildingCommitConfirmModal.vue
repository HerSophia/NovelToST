<template>
  <div
    v-if="props.visible"
    data-worldbuilding-commit-confirm-modal
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
  >
    <div class="w-full max-w-lg rounded-lg border border-white/15 bg-slate-900 p-4 text-slate-100 shadow-xl">
      <h3 class="text-sm font-semibold">确认提交世界书条目</h3>
      <p class="mt-2 text-xs text-slate-300">目标世界书：{{ props.selectedWorldbookName || '（未选择）' }}</p>
      <p class="mt-1 text-xs text-slate-300">已勾选候选：{{ props.checkedCandidateCount }} 条</p>
      <p v-if="props.commitPreview" class="mt-1 text-xs text-slate-300">
        预计重命名：{{ props.commitPreview.renameCount }} 条；冲突：同名
        {{ props.commitPreview.conflictCountByKind.name }} 条、关键词重叠
        {{ props.commitPreview.conflictCountByKind.keyword_overlap }} 条。
      </p>
      <p class="mt-1 text-xs text-slate-300">
        大纲同步：{{ props.syncOutlineAfterCommit ? '开启（提交后自动追加去重）' : '关闭' }}
      </p>

      <div class="mt-4 flex justify-end gap-2">
        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="cancel-commit-confirm"
          class="rounded-md border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
          @click="emit('close')"
        >
          取消
        </BaseButton>
        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="confirm-commit"
          class="rounded-md border border-cyan-400/60 bg-cyan-500/20 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-500/30"
          :disabled="props.committing"
          @click="emit('confirm')"
        >
          {{ props.committing ? '提交中...' : '确认提交' }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '../../base/BaseButton.vue';
import type { WorldbookCommitPreview } from '../../../core/worldbook-commit.service';

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    selectedWorldbookName?: string | null;
    checkedCandidateCount?: number;
    commitPreview?: WorldbookCommitPreview | null;
    syncOutlineAfterCommit?: boolean;
    committing?: boolean;
  }>(),
  {
    visible: false,
    selectedWorldbookName: null,
    checkedCandidateCount: 0,
    commitPreview: null,
    syncOutlineAfterCommit: false,
    committing: false,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();
</script>
