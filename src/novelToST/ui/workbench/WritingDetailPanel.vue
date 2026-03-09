<template>
  <section data-workbench-detail-panel class="space-y-3">
    <div class="rounded-xl border border-violet-400/30 bg-violet-500/10 p-3 text-xs text-violet-100">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="font-semibold">细纲编辑（兼容入口）</p>
          <p class="mt-1 text-violet-100/90">v2 主流程在“大纲工坊”。此处用于手动补齐或局部修订章节细纲。</p>
        </div>

        <HelpTriggerButton
          topic="outline"
          title="查看大纲工坊帮助"
          data-detail-help-trigger="outline"
          @trigger="openOutlineHelp"
        />
      </div>
    </div>

    <div class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
      <div class="grid gap-3 sm:grid-cols-[180px,1fr] sm:items-end">
        <BaseInput
          :model-value="activeChapter"
          type="number"
          :min="1"
          label="当前章节"
          @update:model-value="handleChapterInput"
        />

        <div class="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400" data-workbench-detail-chapter>
          {{ chapterLabel }}
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <BaseButton variant="ghost" @click="ensureCurrentDetail">创建本章细纲</BaseButton>
        <BaseButton
          variant="primary"
          data-workbench-detail-action="rewrite"
          :disabled="!canRewriteDetail"
          @click="rewriteCurrentChapter"
        >
          {{ aiBusyAction === 'rewrite' ? '重写中...' : 'AI 重写本章细纲' }}
        </BaseButton>
        <BaseButton variant="danger" :disabled="!currentDetail" @click="removeCurrentDetail">删除本章细纲</BaseButton>
      </div>
    </div>

    <div class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
      <div v-if="!currentDetail" class="rounded-md border border-dashed border-white/15 p-4 text-xs text-slate-400">
        当前章节暂无细纲。可点击“创建/恢复当前章细纲”后编辑，或直接使用 AI 重写。
      </div>

      <div v-else class="space-y-2">
        <div class="grid gap-2 sm:grid-cols-[1fr,180px,140px]">
          <BaseInput :model-value="currentDetail.title" label="章节标题" @update:model-value="value => patchText('title', value)" />

          <BaseDropdownSelect
            :model-value="currentDetail.parentNodeId"
            :options="parentNodeOptions"
            label="所属总纲节点"
            data-workbench-detail-parent-node-select
            list-data-attr-name="data-workbench-detail-parent-node-list"
            item-data-attr-name="data-workbench-detail-parent-node-option"
            @update:model-value="handleParentNodeChange"
          />

          <BaseDropdownSelect
            :model-value="currentDetail.status"
            :options="detailStatusOptions"
            label="状态"
            data-workbench-detail-status-select
            list-data-attr-name="data-workbench-detail-status-list"
            item-data-attr-name="data-workbench-detail-status-option"
            @update:model-value="handleStatusChange"
          />
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <BaseTextarea :model-value="currentDetail.goal" :rows="3" label="章节目标" @update:model-value="value => patchText('goal', value)" />
          <BaseTextarea
            :model-value="currentDetail.conflict"
            :rows="3"
            label="章节冲突"
            @update:model-value="value => patchText('conflict', value)"
          />
        </div>

        <div class="grid gap-2 sm:grid-cols-3">
          <BaseTextarea v-model="beatsText" :rows="5" label="剧情节拍（每行一条）" />
          <BaseTextarea v-model="mustIncludeText" :rows="5" label="必须包含（每行一条）" />
          <BaseTextarea v-model="mustAvoidText" :rows="5" label="必须避免（每行一条）" />
        </div>
      </div>
    </div>

    <FoundationGenerationReminderModal
      :state="foundationGenerationReminder"
      @close="cancelFoundationGenerationReminder"
      @confirm="confirmFoundationGenerationReminder"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useOutlineControl } from '../../composables/useOutlineControl';
import { useOutlineStore } from '../../stores/outline.store';
import { useWorkbenchStore } from '../../stores/workbench.store';
import type { ChapterDetail, OutlineNodeStatus } from '../../types/outline';
import HelpTriggerButton from '../components/help/HelpTriggerButton.vue';
import BaseButton from '../base/BaseButton.vue';
import BaseDropdownSelect from '../base/BaseDropdownSelect.vue';
import BaseInput from '../base/BaseInput.vue';
import BaseTextarea from '../base/BaseTextarea.vue';
import type { HelpTopicId } from '../help/help-topics';
import FoundationGenerationReminderModal from './shared/FoundationGenerationReminderModal.vue';

const emit = defineEmits<{
  (event: 'open-help', topic: HelpTopicId): void;
}>();

const props = withDefaults(
  defineProps<{
    chapter?: number | null;
  }>(),
  {
    chapter: null,
  },
);

const outlineStore = useOutlineStore();
const workbenchStore = useWorkbenchStore();
const {
  aiBusyAction,
  canRewriteDetail,
  foundationGenerationReminder,
  cancelFoundationGenerationReminder,
  confirmFoundationGenerationReminder,
  patchDetailListByText,
  rewriteDetail,
  getPreferredChapter,
  ensureChapterDetail,
} = useOutlineControl();

const activeChapter = ref(getPreferredChapter(props.chapter));

watch(
  () => props.chapter,
  chapter => {
    activeChapter.value = getPreferredChapter(chapter);
  },
  { immediate: true },
);

watch(activeChapter, chapter => {
  workbenchStore.setTargetChapter(chapter);
});

const currentDetail = computed(() => {
  return outlineStore.getChapterDetail(activeChapter.value);
});

const chapterLabel = computed(() => {
  const detail = currentDetail.value;
  if (!detail) {
    return `当前定位章节：第 ${activeChapter.value} 章（尚无细纲）`;
  }

  const statusLabel = detail.status === 'approved' ? '已确认' : '草稿';
  return `当前定位章节：第 ${activeChapter.value} 章（${statusLabel}）`;
});

const beatsText = computed({
  get: () => currentDetail.value?.beats.join('\n') ?? '',
  set: value => {
    patchDetailListByText(activeChapter.value, 'beats', value);
  },
});

const mustIncludeText = computed({
  get: () => currentDetail.value?.mustInclude.join('\n') ?? '',
  set: value => {
    patchDetailListByText(activeChapter.value, 'mustInclude', value);
  },
});

const mustAvoidText = computed({
  get: () => currentDetail.value?.mustAvoid.join('\n') ?? '',
  set: value => {
    patchDetailListByText(activeChapter.value, 'mustAvoid', value);
  },
});

const detailStatusOptions: Array<{ value: OutlineNodeStatus; label: string }> = [
  { value: 'draft', label: '草稿' },
  { value: 'approved', label: '已确认' },
];

const parentNodeOptions = computed(() => {
  return [
    { value: '', label: '（未关联大纲段落）' },
    ...outlineStore.sortedMasterOutline.map(node => ({
      value: node.id,
      label: `${node.title || node.id}（${node.chapterStart}-${node.chapterEnd}）`,
    })),
  ];
});

const handleChapterInput = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  activeChapter.value = Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
};

const ensureCurrentDetail = () => {
  const detail = ensureChapterDetail(activeChapter.value);
  if (!detail.parentNodeId) {
    const parentNodeId = outlineStore.findMasterNodeByChapter(activeChapter.value)?.id ?? '';
    if (parentNodeId) {
      outlineStore.patchChapterDetail(activeChapter.value, { parentNodeId });
    }
  }
};

const removeCurrentDetail = () => {
  outlineStore.removeChapterDetail(activeChapter.value);
};

const rewriteCurrentChapter = async () => {
  await rewriteDetail(activeChapter.value);
};

const openOutlineHelp = () => {
  emit('open-help', 'outline');
};

const patchText = (field: keyof Pick<ChapterDetail, 'title' | 'goal' | 'conflict'>, value: unknown) => {
  const payload: Partial<ChapterDetail> = {};
  payload[field] = String(value ?? '');
  outlineStore.patchChapterDetail(activeChapter.value, payload);
};

const handleParentNodeChange = (value: unknown) => {
  outlineStore.patchChapterDetail(activeChapter.value, {
    parentNodeId: String(value ?? ''),
  });
};

const handleStatusChange = (value: unknown) => {
  const status: OutlineNodeStatus = value === 'approved' ? 'approved' : 'draft';
  outlineStore.patchChapterDetail(activeChapter.value, {
    status,
  });
};
</script>
