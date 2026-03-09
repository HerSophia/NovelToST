<template>
  <div
    v-if="props.snapshot"
    data-outline-snapshot-structured-modal
    class="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 p-4"
    @click.self="emit('close')"
  >
    <div class="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
      <div class="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p class="text-sm font-medium text-white">草案 #{{ props.snapshot.version }} · 结构化预览</p>
          <p class="text-[11px] text-slate-400">创建时间：{{ props.snapshot.createdAt }}</p>
        </div>
        <BaseButton variant="ghost" data-outline-action="close-snapshot-preview" @click="emit('close')">关闭</BaseButton>
      </div>

      <div class="max-h-[calc(88vh-68px)] space-y-3 overflow-y-auto p-4 text-xs">
        <section class="rounded-lg border border-white/10 bg-black/15 p-3">
          <h4 class="font-medium text-slate-200">故事线（{{ props.snapshot.storylines.length }}）</h4>
          <div v-if="props.snapshot.storylines.length === 0" class="mt-2 text-slate-500">该草案没有故事线。</div>
          <div v-else class="mt-2 grid gap-2 md:grid-cols-2">
            <article v-for="storyline in props.snapshot.storylines" :key="storyline.id" class="rounded-md border border-white/10 bg-black/20 p-2">
              <p class="font-medium text-slate-100">{{ storyline.title || '未命名故事线' }}</p>
              <p class="mt-0.5 text-[11px] text-slate-400">{{ getStorylineTypeLabel(storyline.type) }} · {{ getStatusLabel(storyline.status) }}</p>
              <p class="mt-1 whitespace-pre-wrap text-slate-300">{{ storyline.description || '暂无描述' }}</p>
            </article>
          </div>
        </section>

        <section class="rounded-lg border border-white/10 bg-black/15 p-3">
          <h4 class="font-medium text-slate-200">大纲节点（{{ props.snapshot.masterOutline.length }}）</h4>
          <div v-if="props.snapshot.masterOutline.length === 0" class="mt-2 text-slate-500">该草案没有节点。</div>
          <div v-else class="mt-2 space-y-2">
            <article
              v-for="node in props.snapshot.masterOutline"
              :key="node.id"
              class="rounded-md border border-white/10 bg-black/20 p-2"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-medium text-slate-100">{{ node.title || '未命名节点' }}</p>
                <p class="text-[11px] text-slate-400">第 {{ node.chapterStart }} - {{ node.chapterEnd }} 章</p>
              </div>
              <p class="mt-0.5 text-[11px] text-slate-400">
                {{ getPhaseLabel(node.phase) }} · {{ resolveSnapshotStorylineLabel(props.snapshot, node.storylineId) }}
              </p>
              <p class="mt-1 whitespace-pre-wrap text-slate-300">{{ node.summary || '暂无概要' }}</p>

              <div v-if="node.turningPoints.length > 0" class="mt-1.5">
                <p class="text-[11px] text-slate-400">关键转折：</p>
                <ul class="mt-1 list-disc space-y-0.5 pl-4 text-slate-300">
                  <li v-for="point in node.turningPoints" :key="point">{{ point }}</li>
                </ul>
              </div>
            </article>
          </div>
        </section>

        <section class="rounded-lg border border-white/10 bg-black/15 p-3">
          <h4 class="font-medium text-slate-200">章节细纲（{{ props.snapshotDetails.length }}）</h4>
          <div v-if="props.snapshotDetails.length === 0" class="mt-2 text-slate-500">该草案没有章节细纲。</div>
          <div v-else class="mt-2 space-y-2">
            <article v-for="detail in props.snapshotDetails" :key="detail.chapter" class="rounded-md border border-white/10 bg-black/20 p-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-medium text-slate-100">第 {{ detail.chapter }} 章 · {{ detail.title || '未命名细纲' }}</p>
                <p class="text-[11px] text-slate-400">{{ getStatusLabel(detail.status) }}</p>
              </div>

              <div class="mt-1 grid gap-2 md:grid-cols-2">
                <p class="text-slate-300">目标：{{ detail.goal || '暂无' }}</p>
                <p class="text-slate-300">冲突：{{ detail.conflict || '暂无' }}</p>
              </div>

              <div v-if="detail.beats.length > 0" class="mt-1.5">
                <p class="text-[11px] text-slate-400">节拍：</p>
                <ul class="mt-1 list-disc space-y-0.5 pl-4 text-slate-300">
                  <li v-for="beat in detail.beats" :key="beat">{{ beat }}</li>
                </ul>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '../../base/BaseButton.vue';
import type { ChapterDetail, NarrativePhase, OutlineNodeStatus, OutlineSnapshot, StorylineType } from '../../../types/outline';

const props = withDefaults(
  defineProps<{
    snapshot?: OutlineSnapshot | null;
    snapshotDetails?: ChapterDetail[];
  }>(),
  {
    snapshot: null,
    snapshotDetails: () => [],
  },
);

const emit = defineEmits<{
  close: [];
}>();

const getStorylineTypeLabel = (type: StorylineType): string => {
  if (type === 'main') {
    return '主线';
  }
  if (type === 'parallel') {
    return '平行线';
  }
  return '支线';
};

const getStatusLabel = (status: OutlineNodeStatus): string => {
  return status === 'approved' ? '已确认' : '草稿';
};

const getPhaseLabel = (phase: NarrativePhase | undefined): string => {
  if (phase === 'setup') {
    return '铺垫';
  }
  if (phase === 'confrontation') {
    return '对抗';
  }
  if (phase === 'climax') {
    return '高潮';
  }
  if (phase === 'resolution') {
    return '收束';
  }
  if (phase === 'custom') {
    return '自定义';
  }
  return '未标注阶段';
};

const resolveSnapshotStorylineLabel = (snapshot: OutlineSnapshot, storylineId?: string): string => {
  if (!storylineId) {
    return '未分配故事线';
  }

  const matched = snapshot.storylines.find(storyline => storyline.id === storylineId);
  return matched?.title?.trim() ? matched.title : storylineId;
};
</script>
