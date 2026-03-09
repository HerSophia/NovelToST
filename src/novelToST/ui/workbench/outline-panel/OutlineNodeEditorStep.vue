<template>
  <div data-outline-step="4-node-edit" class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
    <div class="mb-2 flex items-start justify-between gap-2">
      <div>
        <h3 class="text-sm font-medium text-white">✏️ 故事线与节点</h3>
        <p class="mt-0.5 text-[11px] text-slate-400">查看和手动编辑当前的大纲结构</p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          data-outline-action="toggle-step-4-node-edit"
          class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
          :aria-expanded="!props.collapsed"
          aria-controls="outline-step-panel-4-node-edit"
          @click="emit('toggle-collapse')"
        >
          {{ props.collapsed ? '展开' : '收起' }}
        </button>

        <HelpTriggerButton topic="outline" title="查看节点编辑帮助" data-outline-help-trigger="4-node-edit" @trigger="emit('open-help')" />
      </div>
    </div>

    <div
      v-show="!props.collapsed"
      id="outline-step-panel-4-node-edit"
      data-outline-step-content="4-node-edit"
      class="space-y-3"
    >
      <div class="rounded-lg border border-white/10 bg-black/10 p-2.5">
        <div class="mb-2 flex items-center justify-between">
          <p class="text-xs font-medium text-slate-300">故事线（点击卡片查看详情）</p>
          <BaseButton variant="ghost" data-outline-action="append-storyline" @click="emit('append-storyline')">＋ 新增</BaseButton>
        </div>

        <div v-if="props.storylines.length === 0" class="rounded-md border border-dashed border-white/15 p-3 text-xs text-slate-400">
          暂无故事线。请先新增一条故事线。
        </div>

        <div v-else class="flex gap-2 overflow-x-auto pb-1" data-outline-storyline-cards>
          <button
            v-for="storyline in props.storylines"
            :key="storyline.id"
            type="button"
            data-outline-storyline-card
            class="max-w-[260px] min-w-[220px] shrink-0 rounded-md border px-2.5 py-2 text-left text-xs transition"
            :class="
              props.selectedStoryline?.id === storyline.id
                ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            "
            @click="emit('select-storyline', storyline.id)"
          >
            <p class="truncate font-medium">{{ storyline.title || '未命名故事线' }}</p>
            <p class="mt-0.5 text-[11px] opacity-80">
              {{ getStorylineTypeLabel(storyline.type) }} · {{ getStatusLabel(storyline.status) }} ·
              {{ getNodeCountByStoryline(storyline.id) }} 节点
            </p>
            <p class="mt-0.5 text-[10px]">
              <span
                data-outline-storyline-lock-badge
                class="cursor-pointer select-none"
                :class="isStorylineLocked(storyline.id) ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'"
                @click.stop="emit('toggle-storyline-lock', storyline.id)"
              >
                {{ isStorylineLocked(storyline.id) ? '🔒 已锁定' : '🔓 未锁定' }}
              </span>
            </p>
            <p class="mt-1 max-h-9 overflow-hidden text-[11px] text-slate-400">
              {{ storyline.description || '暂无描述，点击卡片补充。' }}
            </p>
          </button>
        </div>

        <div v-if="props.selectedStoryline" data-outline-selected-storyline class="mt-3 rounded-md border border-white/10 bg-black/20 p-2">
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="text-[11px] text-slate-300">当前选中：{{ props.selectedStoryline.title || '未命名故事线' }}</p>
            <BaseButton variant="ghost" data-outline-action="toggle-storyline-detail" @click="emit('toggle-storyline-detail')">
              {{ props.showSelectedStorylineDetail ? '折叠详情' : '展开详情' }}
            </BaseButton>
          </div>

          <div v-show="props.showSelectedStorylineDetail" data-outline-storyline-detail class="space-y-2">
            <div class="grid gap-2 sm:grid-cols-[1fr,130px,120px]">
              <BaseInput
                :model-value="props.selectedStoryline?.title ?? ''"
                label="名称"
                @update:model-value="value => props.selectedStoryline && emit('patch-storyline-text', props.selectedStoryline.id, 'title', value)"
              />

              <BaseDropdownSelect
                :model-value="props.selectedStoryline?.type ?? 'subplot'"
                label="类型"
                :options="storylineTypeOptions"
                list-data-attr-name="data-outline-storyline-type-list"
                item-data-attr-name="data-outline-storyline-type-option"
                data-outline-storyline-type-select
                @update:model-value="value => props.selectedStoryline && emit('patch-storyline-type', props.selectedStoryline.id, value)"
              />

              <BaseDropdownSelect
                :model-value="props.selectedStoryline?.status ?? 'draft'"
                label="状态"
                :options="outlineStatusOptions"
                data-outline-storyline-status-select
                list-data-attr-name="data-outline-storyline-status-list"
                item-data-attr-name="data-outline-storyline-status-option"
                @update:model-value="value => props.selectedStoryline && emit('patch-storyline-status', props.selectedStoryline.id, value)"
              />
            </div>

            <BaseTextarea
              :model-value="props.selectedStoryline?.description ?? ''"
              :rows="2"
              label="描述"
              @update:model-value="value => props.selectedStoryline && emit('patch-storyline-text', props.selectedStoryline.id, 'description', value)"
            />

            <div class="mt-2 grid gap-2 sm:grid-cols-2">
              <BaseTextarea
                :model-value="(props.selectedStoryline?.themeKeywords ?? []).join('\n')"
                :rows="3"
                label="主题关键词（每行一条）"
                placeholder="复仇&#10;救赎&#10;成长"
                @update:model-value="value => props.selectedStoryline && emit('patch-storyline-list-field', props.selectedStoryline.id, 'themeKeywords', String(value ?? ''))"
              />
              <BaseTextarea
                :model-value="(props.selectedStoryline?.linkedCharacters ?? []).join('\n')"
                :rows="3"
                label="关联角色（每行一条）"
                placeholder="林逸&#10;苏晴"
                @update:model-value="value => props.selectedStoryline && emit('patch-storyline-list-field', props.selectedStoryline.id, 'linkedCharacters', String(value ?? ''))"
              />
            </div>

            <div class="mt-2 flex justify-end">
              <BaseButton variant="danger" :disabled="props.storylines.length <= 1" @click="emit('remove-selected-storyline')">
                删除当前故事线
              </BaseButton>
            </div>
          </div>
        </div>

        <p v-else data-outline-storyline-tip class="mt-3 rounded-md border border-dashed border-white/15 p-2 text-xs text-slate-400">
          💡 点击上方故事线卡片后，可查看和编辑完整信息；下方节点也会切换到该故事线。
        </p>
      </div>

      <div class="rounded-lg border border-white/10 bg-black/10 p-2.5">
        <div class="mb-2 flex items-center justify-between">
          <p class="text-xs font-medium text-slate-300">大纲节点</p>
          <BaseButton variant="ghost" data-workbench-outline-action="append-node" :disabled="!props.selectedStoryline" @click="emit('append-node')">
            ＋ 新增
          </BaseButton>
        </div>

        <div
          v-if="!props.selectedStoryline"
          data-outline-node-tip
          class="rounded-md border border-dashed border-white/15 p-3 text-xs text-slate-400"
        >
          💡 请先点击上方故事线卡片，再查看或新增该故事线下的大纲节点。
        </div>

        <template v-else>
          <p class="mb-2 text-[11px] text-slate-400">
            当前显示：{{ props.selectedStoryline.title || '未命名故事线' }}（{{ props.filteredMasterOutlineNodes.length }} 个节点）
          </p>

          <div v-if="props.filteredMasterOutlineNodes.length === 0" class="rounded-md border border-dashed border-white/15 p-3 text-xs text-slate-400">
            该故事线下暂无节点。可以点击上方“新增”来创建。
          </div>

          <div v-else class="space-y-2" data-outline-filtered-node-list>
            <div
              v-for="node in props.filteredMasterOutlineNodes"
              :key="node.id"
              class="rounded-lg border p-2.5"
              :class="isNodeLocked(node.id) ? 'border-amber-400/40 bg-amber-500/5' : 'border-white/10 bg-black/15'"
            >
              <div class="mb-2 flex items-center justify-between">
                <span
                  data-outline-node-lock-badge
                  class="cursor-pointer text-[10px] select-none"
                  :class="isNodeLocked(node.id) ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'"
                  @click="emit('toggle-node-lock', node.id)"
                >
                  {{ isNodeLocked(node.id) ? '🔒 已锁定' : '🔓 未锁定' }}
                </span>
              </div>

              <div class="grid gap-2 sm:grid-cols-[1fr,110px,110px,120px]">
                <BaseInput
                  :model-value="node.title"
                  label="标题"
                  @update:model-value="value => emit('patch-master-node-text', node.id, 'title', value)"
                />
                <BaseInput
                  :model-value="node.chapterStart"
                  type="number"
                  :min="1"
                  label="起始章"
                  @update:model-value="value => emit('patch-master-node-chapter', node.id, 'chapterStart', value)"
                />
                <BaseInput
                  :model-value="node.chapterEnd"
                  type="number"
                  :min="1"
                  label="结束章"
                  @update:model-value="value => emit('patch-master-node-chapter', node.id, 'chapterEnd', value)"
                />
                <BaseDropdownSelect
                  :model-value="node.status"
                  label="状态"
                  :options="outlineStatusOptions"
                  data-outline-node-status-select
                  list-data-attr-name="data-outline-node-status-list"
                  item-data-attr-name="data-outline-node-status-option"
                  @update:model-value="value => emit('patch-master-node-status', node.id, value)"
                />
              </div>

              <div class="mt-2 grid gap-2 sm:grid-cols-2">
                <BaseDropdownSelect
                  :model-value="node.storylineId"
                  label="所属故事线"
                  :options="storylineSelectOptions"
                  data-outline-node-storyline-select
                  list-data-attr-name="data-outline-node-storyline-list"
                  item-data-attr-name="data-outline-node-storyline-option"
                  @update:model-value="value => emit('patch-master-node-storyline', node.id, value)"
                />

                <BaseDropdownSelect
                  :model-value="node.phase ?? 'custom'"
                  label="叙事阶段"
                  :options="narrativePhaseOptions"
                  data-outline-node-phase-select
                  list-data-attr-name="data-outline-node-phase-list"
                  item-data-attr-name="data-outline-node-phase-option"
                  @update:model-value="value => emit('patch-master-node-phase', node.id, value)"
                />
              </div>

              <div class="mt-2 grid gap-2 sm:grid-cols-2">
                <BaseTextarea
                  :model-value="node.summary"
                  :rows="3"
                  label="概要"
                  placeholder="这个阶段发生了什么…"
                  @update:model-value="value => emit('patch-master-node-text', node.id, 'summary', value)"
                />
                <BaseTextarea
                  :model-value="node.turningPoints.join('\n')"
                  :rows="3"
                  label="关键转折（每行一条）"
                  placeholder="主角发现真相&#10;反派暴露身份"
                  @update:model-value="value => emit('patch-master-turning-points', node.id, String(value ?? ''))"
                />
              </div>

              <div class="mt-2 grid gap-2 sm:grid-cols-3">
                <BaseTextarea
                  :model-value="(node.keywords ?? []).join('\n')"
                  :rows="3"
                  label="关键词（每行一条）"
                  placeholder="命运之轮&#10;背叛"
                  @update:model-value="value => emit('patch-master-node-list-field', node.id, 'keywords', String(value ?? ''))"
                />
                <BaseTextarea
                  :model-value="(node.characters ?? []).join('\n')"
                  :rows="3"
                  label="相关角色（每行一条）"
                  placeholder="林逸&#10;苏晴"
                  @update:model-value="value => emit('patch-master-node-list-field', node.id, 'characters', String(value ?? ''))"
                />
                <BaseTextarea
                  :model-value="(node.locations ?? []).join('\n')"
                  :rows="3"
                  label="相关地点（每行一条）"
                  placeholder="帝都&#10;迷雾森林"
                  @update:model-value="value => emit('patch-master-node-list-field', node.id, 'locations', String(value ?? ''))"
                />
              </div>

              <div class="mt-2 grid gap-2 sm:grid-cols-2">
                <BaseInput
                  :model-value="node.tensionLevel ?? ''"
                  type="number"
                  :min="1"
                  :max="10"
                  label="张力等级（1–10）"
                  @update:model-value="value => emit('patch-master-node-tension-level', node.id, value)"
                />
                <BaseInput
                  :model-value="node.emotionalTone ?? ''"
                  label="情感基调"
                  placeholder="紧张、忧伤、希望…"
                  @update:model-value="value => emit('patch-master-node-text', node.id, 'emotionalTone', value)"
                />
              </div>

              <div class="mt-2 grid gap-2 sm:grid-cols-2">
                <BaseTextarea
                  :model-value="(node.foreshadowing ?? []).join('\n')"
                  :rows="3"
                  label="伏笔（每行一条）"
                  placeholder="神秘信件&#10;消失的钥匙"
                  @update:model-value="value => emit('patch-master-node-list-field', node.id, 'foreshadowing', String(value ?? ''))"
                />
                <BaseTextarea
                  :model-value="(node.payoffs ?? []).join('\n')"
                  :rows="3"
                  label="伏笔回收（每行一条）"
                  placeholder="信件揭示真相&#10;钥匙打开密室"
                  @update:model-value="value => emit('patch-master-node-list-field', node.id, 'payoffs', String(value ?? ''))"
                />
              </div>

              <div class="mt-2 flex justify-end">
                <BaseButton variant="danger" @click="emit('remove-master-node', node.id)">删除节点</BaseButton>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseButton from '../../base/BaseButton.vue';
import BaseDropdownSelect from '../../base/BaseDropdownSelect.vue';
import BaseInput from '../../base/BaseInput.vue';
import BaseTextarea from '../../base/BaseTextarea.vue';
import HelpTriggerButton from '../../components/help/HelpTriggerButton.vue';
import type { MasterOutlineNode, NarrativePhase, OutlineNodeStatus, Storyline, StorylineType } from '../../../types/outline';

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
    storylines?: Storyline[];
    masterOutlineNodes?: MasterOutlineNode[];
    selectedStoryline?: Storyline | null;
    showSelectedStorylineDetail?: boolean;
    filteredMasterOutlineNodes?: MasterOutlineNode[];
    lockedStorylineIds?: string[];
    lockedNodeIds?: string[];
  }>(),
  {
    selectedStoryline: null,
    collapsed: false,
    storylines: () => [],
    masterOutlineNodes: () => [],
    showSelectedStorylineDetail: true,
    filteredMasterOutlineNodes: () => [],
    lockedStorylineIds: () => [],
    lockedNodeIds: () => [],
  },
);

const emit = defineEmits<{
  'toggle-collapse': [];
  'open-help': [];
  'append-storyline': [];
  'select-storyline': [storylineId: string];
  'toggle-storyline-detail': [];
  'patch-storyline-text': [storylineId: string, field: 'title' | 'description', value: unknown];
  'patch-storyline-type': [storylineId: string, value: unknown];
  'patch-storyline-status': [storylineId: string, value: unknown];
  'patch-storyline-list-field': [storylineId: string, field: 'themeKeywords' | 'linkedCharacters', text: string];
  'remove-selected-storyline': [];
  'append-node': [];
  'patch-master-node-text': [nodeId: string, field: 'title' | 'summary' | 'emotionalTone', value: unknown];
  'patch-master-node-chapter': [nodeId: string, field: 'chapterStart' | 'chapterEnd', value: unknown];
  'patch-master-node-status': [nodeId: string, value: unknown];
  'patch-master-node-storyline': [nodeId: string, value: unknown];
  'patch-master-node-phase': [nodeId: string, value: unknown];
  'patch-master-node-tension-level': [nodeId: string, value: unknown];
  'patch-master-turning-points': [nodeId: string, text: string];
  'patch-master-node-list-field': [nodeId: string, field: 'keywords' | 'characters' | 'locations' | 'foreshadowing' | 'payoffs', text: string];
  'remove-master-node': [nodeId: string];
  'toggle-storyline-lock': [storylineId: string];
  'toggle-node-lock': [nodeId: string];
}>();

const storylineTypeOptions: Array<{ value: StorylineType; label: string }> = [
  { value: 'main', label: '主线' },
  { value: 'subplot', label: '支线' },
  { value: 'parallel', label: '平行线' },
];

const outlineStatusOptions: Array<{ value: OutlineNodeStatus; label: string }> = [
  { value: 'draft', label: '草稿' },
  { value: 'approved', label: '已确认' },
];

const narrativePhaseOptions: Array<{ value: NarrativePhase; label: string }> = [
  { value: 'setup', label: '铺垫（开端）' },
  { value: 'confrontation', label: '对抗（发展）' },
  { value: 'climax', label: '高潮' },
  { value: 'resolution', label: '收束（结局）' },
  { value: 'custom', label: '自定义' },
];

const storylineSelectOptions = computed(() => {
  return props.storylines.map(storyline => ({
    value: storyline.id,
    label: storyline.title || storyline.id,
  }));
});

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

const getNodeCountByStoryline = (storylineId: string): number => {
  return props.masterOutlineNodes.filter(node => node.storylineId === storylineId).length;
};

const isStorylineLocked = (storylineId: string): boolean => {
  return props.lockedStorylineIds.includes(storylineId);
};

const isNodeLocked = (nodeId: string): boolean => {
  return props.lockedNodeIds.includes(nodeId);
};
</script>
