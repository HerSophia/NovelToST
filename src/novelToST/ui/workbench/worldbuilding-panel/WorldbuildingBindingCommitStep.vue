<template>
  <div
    class="space-y-3 rounded-lg border border-white/10 bg-slate-900/55 p-3"
    data-worldbuilding-step="4-binding-commit"
  >
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.12em] text-cyan-200 uppercase">步骤 4</p>
        <h3 class="mt-1 text-sm font-medium text-white">世界书绑定与提交</h3>
      </div>

      <div class="flex items-center gap-2">
        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="toggle-step-4-binding-commit"
          class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
          :aria-expanded="!props.collapsed"
          aria-controls="worldbuilding-step-panel-4-binding-commit"
          @click="emit('toggle-collapse')"
        >
          {{ props.collapsed ? '展开' : '收起' }}
        </BaseButton>

        <HelpTriggerButton
          topic="worldbuilding"
          title="查看绑定与提交流程帮助"
          data-worldbuilding-help-trigger="4-binding-commit"
          @trigger="emit('open-help')"
        />
      </div>
    </div>

    <div
      v-show="!props.collapsed"
      id="worldbuilding-step-panel-4-binding-commit"
      data-worldbuilding-step-content="4-binding-commit"
      class="space-y-3"
    >
      <div class="rounded-lg border border-white/10 bg-slate-900/70 p-3" data-worldbuilding-chat-binding>
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-xs font-medium text-slate-200">当前聊天已启用世界书</p>
            <p class="mt-1 text-xs text-cyan-100" data-worldbuilding-chat-binding-name>
              {{ props.chatWorldbookBinding.boundWorldbookName || '当前聊天还没有绑定世界书' }}
            </p>
            <p class="mt-1 text-[11px] text-slate-400">提交目标会默认跟随聊天绑定；你也可以手动调整。</p>
          </div>

          <BaseButton
            type="button"
            variant="ghost"
            data-worldbuilding-action="refresh-chat-binding"
            class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="props.chatBindingLoading"
            @click="emit('refresh-chat-binding')"
          >
            {{ props.chatBindingLoading ? '读取中...' : '刷新绑定状态' }}
          </BaseButton>
        </div>

        <div class="mt-2 flex flex-wrap gap-2">
          <BaseButton
            type="button"
            variant="ghost"
            data-worldbuilding-action="use-chat-binding-target"
            class="rounded-md border border-cyan-400/60 bg-cyan-500/15 px-2 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!props.chatWorldbookBinding.boundWorldbookName"
            @click="emit('use-chat-binding-target')"
          >
            使用当前聊天绑定的世界书
          </BaseButton>

          <BaseButton
            type="button"
            variant="ghost"
            data-worldbuilding-action="bind-chat-worldbook"
            class="rounded-md border border-violet-400/60 bg-violet-500/20 px-2 py-1 text-xs text-violet-100 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!props.selectedWorldbookName || props.chatBindingApplying"
            @click="emit('bind-chat-worldbook')"
          >
            {{ props.chatBindingApplying ? '应用中...' : '把选中的世界书绑定到聊天' }}
          </BaseButton>
        </div>
      </div>

      <div class="rounded-lg border border-white/10 bg-slate-900/70 p-3" data-worldbuilding-commit>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-xs font-medium tracking-[0.08em] text-slate-300 uppercase">
            提交到世界书（含大纲同步）
          </h3>

          <BaseButton
            type="button"
            variant="ghost"
            data-worldbuilding-action="refresh-worldbooks"
            class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="props.worldbookListLoading"
            @click="emit('refresh-worldbooks')"
          >
            {{ props.worldbookListLoading ? '刷新中...' : '刷新世界书列表' }}
          </BaseButton>
        </div>

        <p class="mt-2 text-xs text-slate-400">候选总数：{{ props.candidates.length }} 条</p>
        <p class="mt-1 text-xs text-slate-400">已勾选：{{ props.checkedCandidateCount }} 条</p>

        <BaseCheckbox
          :model-value="props.syncOutlineAfterCommit"
          :input-attrs="{ 'data-worldbuilding-outline-sync-toggle': '', class: 'mt-0.5' }"
          class="mt-2 items-start rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200"
          @update:model-value="handleOutlineSyncToggleModelUpdate"
        >
          <span>提交后也同步到故事基底（自动去重）</span>
        </BaseCheckbox>

        <BaseDropdownSelect
          :model-value="props.selectedWorldbookName"
          :options="worldbookOptions"
          label="目标世界书（必选）"
          placeholder="请选择目标世界书"
          data-worldbuilding-worldbook-select
          list-data-attr-name="data-worldbuilding-worldbook-list"
          item-data-attr-name="data-worldbuilding-worldbook-option"
          class="mt-1 rounded-md text-xs"
          @update:model-value="handleWorldbookSelectModelUpdate"
        />

        <p v-if="props.selectableWorldbooks.length === 0" class="mt-1 text-[11px] text-amber-300">
          没有检测到可用世界书，请先在宿主里创建。
        </p>

        <ul
          v-if="props.candidates.length > 0"
          class="mt-2 max-h-44 space-y-1.5 overflow-y-auto"
          data-worldbuilding-candidate-list
        >
          <li
            v-for="candidate in props.candidates"
            :key="candidate.id"
            class="rounded-md border border-white/10 bg-white/5 px-2 py-1.5"
          >
            <div class="flex items-start justify-between gap-2">
              <BaseCheckbox
                :model-value="candidate.checked"
                class="flex min-w-0 flex-1 items-start gap-2"
                @update:model-value="checked => handleCandidateCheckedModelUpdate(candidate.id, Boolean(checked))"
              >
                <span class="min-w-0">
                  <span class="block truncate text-xs text-slate-100">{{ candidate.name || '（无名称）' }}</span>
                  <span class="block truncate text-[11px] text-slate-400">{{ candidate.category || '未分类' }} · {{ formatCandidateKeywords(candidate.keywords) }}</span>
                </span>
              </BaseCheckbox>

              <span
                class="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                :class="getConflictTagClass(resolveCandidateConflict(candidate.id).kind)"
              >
                {{ getConflictTagLabel(resolveCandidateConflict(candidate.id).kind) }}
              </span>
            </div>

            <p v-if="resolveCandidatePreview(candidate.id)?.willRename" class="mt-1 text-[11px] text-violet-200">
              预计重命名：{{ candidate.name }} → {{ resolveCandidatePreview(candidate.id)?.resolvedName }}
            </p>
          </li>
        </ul>

        <div class="mt-2 flex flex-wrap gap-2">
          <BaseButton
            type="button"
            variant="ghost"
            data-worldbuilding-action="build-commit-preview"
            class="rounded-md border border-violet-400/60 bg-violet-500/20 px-2 py-1 text-xs text-violet-100 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!props.canBuildCommitPreview"
            @click="emit('build-commit-preview')"
          >
            {{ props.commitPreviewLoading ? '预览中...' : '检查并预览冲突' }}
          </BaseButton>

          <BaseButton
            type="button"
            variant="ghost"
            data-worldbuilding-action="open-commit-confirm"
            class="rounded-md border border-cyan-400/60 bg-cyan-500/20 px-2 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!props.canOpenCommitConfirm"
            @click="emit('open-commit-confirm')"
          >
            {{ props.committing ? '提交中...' : '确认写入世界书' }}
          </BaseButton>
        </div>

        <div
          v-if="props.commitPreview"
          data-worldbuilding-commit-preview
          class="mt-2 rounded-md border border-violet-400/30 bg-violet-500/10 p-2 text-[11px] text-violet-100"
        >
          冲突预览：同名 {{ props.commitPreview.conflictCountByKind.name }} 条，关键词重叠
          {{ props.commitPreview.conflictCountByKind.keyword_overlap }} 条， 预计重命名
          {{ props.commitPreview.renameCount }} 条。
        </div>

        <div
          v-if="props.commitReceipt"
          data-worldbuilding-commit-receipt
          class="mt-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-100"
        >
          提交回执：成功 {{ props.commitReceipt.successCount }} 条，重命名 {{ props.commitReceipt.renamedCount }} 条，失败
          {{ props.commitReceipt.failedCount }} 条。
          <p v-if="props.commitReceipt.errorMessage" class="mt-1 text-amber-200">
            错误：{{ props.commitReceipt.errorMessage }}
          </p>
        </div>

        <div
          v-if="props.outlineSyncReceipt"
          data-worldbuilding-outline-sync-receipt
          class="mt-2 rounded-md border border-cyan-400/30 bg-cyan-500/10 p-2 text-[11px] text-cyan-100"
        >
          故事基底同步完成：新增 {{ props.outlineSyncReceipt.appendedCount }} 条（主角
          {{ props.outlineSyncReceipt.appendedCountByField.protagonist }} / 关键人物
          {{ props.outlineSyncReceipt.appendedCountByField.keyCharacters }} / 世界规则
          {{ props.outlineSyncReceipt.appendedCountByField.requiredRules }} / 禁用设定
          {{ props.outlineSyncReceipt.appendedCountByField.forbiddenSettings }} / 禁止套路
          {{ props.outlineSyncReceipt.appendedCountByField.forbiddenPatterns }}）， 跳过
          {{ props.outlineSyncReceipt.skippedCount }} 条。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HelpTriggerButton from '../../components/help/HelpTriggerButton.vue';
import BaseButton from '../../base/BaseButton.vue';
import BaseCheckbox from '../../base/BaseCheckbox.vue';
import BaseDropdownSelect from '../../base/BaseDropdownSelect.vue';
import type { ChatWorldbookBindingSnapshot } from '../../../core/worldbook-binding.service';
import type {
  WorldbookCommitPreview,
  WorldbookCommitPreviewItem,
  WorldbookCommitReceipt,
} from '../../../core/worldbook-commit.service';
import type { FoundationSyncReceipt } from '../../../core/worldbuilding-outline-sync.service';
import type {
  WorldbookEntryCandidate,
  WorldbookEntryCandidateConflict,
  WorldbookEntryCandidateConflictKind,
} from '../../../types/worldbuilding';

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
    chatWorldbookBinding: ChatWorldbookBindingSnapshot;
    chatBindingLoading?: boolean;
    chatBindingApplying?: boolean;
    worldbookListLoading?: boolean;
    selectableWorldbooks?: string[];
    selectedWorldbookName?: string;
    checkedCandidateCount?: number;
    syncOutlineAfterCommit?: boolean;
    candidates?: WorldbookEntryCandidate[];
    canBuildCommitPreview?: boolean;
    canOpenCommitConfirm?: boolean;
    commitPreviewLoading?: boolean;
    committing?: boolean;
    commitPreview?: WorldbookCommitPreview | null;
    commitReceipt?: WorldbookCommitReceipt | null;
    outlineSyncReceipt?: FoundationSyncReceipt | null;
  }>(),
  {
    collapsed: false,
    chatBindingLoading: false,
    chatBindingApplying: false,
    worldbookListLoading: false,
    selectableWorldbooks: () => [],
    selectedWorldbookName: '',
    checkedCandidateCount: 0,
    syncOutlineAfterCommit: false,
    candidates: () => [],
    canBuildCommitPreview: false,
    canOpenCommitConfirm: false,
    commitPreviewLoading: false,
    committing: false,
    commitPreview: null,
    commitReceipt: null,
    outlineSyncReceipt: null,
  },
);

const emit = defineEmits<{
  'toggle-collapse': [];
  'open-help': [];
  'refresh-chat-binding': [];
  'use-chat-binding-target': [];
  'bind-chat-worldbook': [];
  'refresh-worldbooks': [];
  'update:selectedWorldbookName': [value: string];
  'update:syncOutlineAfterCommit': [value: boolean];
  'candidate-checked-changed': [payload: { candidateId: string; checked: boolean }];
  'build-commit-preview': [];
  'open-commit-confirm': [];
}>();

const worldbookOptions = computed(() => {
  return [
    { value: '', label: '请选择目标世界书' },
    ...props.selectableWorldbooks.map(worldbookName => ({ value: worldbookName, label: worldbookName })),
  ];
});

const handleWorldbookSelectModelUpdate = (value: string | number) => {
  if (typeof value !== 'string') {
    return;
  }
  emit('update:selectedWorldbookName', value);
};

const handleOutlineSyncToggleModelUpdate = (value: boolean) => {
  emit('update:syncOutlineAfterCommit', Boolean(value));
};

const handleCandidateCheckedModelUpdate = (candidateId: string, checked: boolean) => {
  emit('candidate-checked-changed', {
    candidateId,
    checked: Boolean(checked),
  });
};

const formatCandidateKeywords = (keywords: string[]): string => {
  if (keywords.length === 0) {
    return '无关键词';
  }

  return keywords.join(' / ');
};

const resolveCandidatePreview = (candidateId: string): WorldbookCommitPreviewItem | null => {
  return props.commitPreview?.candidates.find(item => item.candidate.id === candidateId) ?? null;
};

const resolveCandidateConflict = (candidateId: string): WorldbookEntryCandidateConflict => {
  const previewItem = resolveCandidatePreview(candidateId);
  if (previewItem) {
    return previewItem.conflict;
  }

  const candidate = props.candidates.find(item => item.id === candidateId);
  return candidate?.conflict ?? { kind: 'none' };
};

const getConflictTagLabel = (kind: WorldbookEntryCandidateConflictKind): string => {
  if (kind === 'name') {
    return '同名冲突';
  }

  if (kind === 'keyword_overlap') {
    return '关键词重叠';
  }

  return '无冲突';
};

const getConflictTagClass = (kind: WorldbookEntryCandidateConflictKind): string => {
  if (kind === 'name') {
    return 'border border-rose-400/40 bg-rose-500/20 text-rose-100';
  }

  if (kind === 'keyword_overlap') {
    return 'border border-amber-400/40 bg-amber-500/20 text-amber-100';
  }

  return 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-100';
};
</script>
