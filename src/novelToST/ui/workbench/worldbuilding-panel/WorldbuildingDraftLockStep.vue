<template>
  <div class="space-y-3" data-worldbuilding-step="3-draft-locks">
    <div class="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/55 p-3">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.12em] text-violet-200 uppercase">步骤 3</p>
        <h3 class="mt-1 text-sm font-medium text-white">确认草案并锁定关键字段</h3>
      </div>

      <div class="flex items-center gap-2">
        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="toggle-step-3-draft-locks"
          class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
          :aria-expanded="!props.collapsed"
          aria-controls="worldbuilding-step-panel-3-draft-locks"
          @click="emit('toggle-collapse')"
        >
          {{ props.collapsed ? '展开' : '收起' }}
        </BaseButton>

        <HelpTriggerButton
          topic="worldbuilding"
          title="查看草案与锁定字段帮助"
          data-worldbuilding-help-trigger="3-draft-locks"
          @trigger="emit('open-help')"
        />
      </div>
    </div>

    <div
      v-show="!props.collapsed"
      id="worldbuilding-step-panel-3-draft-locks"
      data-worldbuilding-step-content="3-draft-locks"
      class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div class="rounded-lg border border-white/10 bg-slate-900/70 p-3" data-worldbuilding-draft>
        <h3 class="text-xs font-medium tracking-[0.08em] text-slate-300 uppercase">
          当前草案
          <span class="ml-1 text-slate-500">{{ props.activeVersion ? `V${props.activeVersion.version}` : '' }}</span>
        </h3>

        <div v-if="!props.activeDraft" class="mt-2 text-xs text-slate-500">还没有可展示的草案内容。</div>

        <dl v-else class="mt-2 grid gap-2 sm:grid-cols-2">
          <div class="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
            <dt class="text-[11px] text-slate-400">名称</dt>
            <dd class="mt-1 text-xs text-slate-100">{{ props.activeDraft.name || '（空）' }}</dd>
          </div>

          <div class="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
            <dt class="text-[11px] text-slate-400">别名</dt>
            <dd class="mt-1 text-xs text-slate-100">{{ formatStringList(props.activeDraft.aliases) }}</dd>
          </div>

          <div class="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 sm:col-span-2">
            <dt class="text-[11px] text-slate-400">摘要</dt>
            <dd class="mt-1 text-xs whitespace-pre-wrap text-slate-100">
              {{ props.activeDraft.summary || '（空）' }}
            </dd>
          </div>

          <div class="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
            <dt class="text-[11px] text-slate-400">事实要点</dt>
            <dd class="mt-1 text-xs text-slate-100">{{ formatStringList(props.activeDraft.facts) }}</dd>
          </div>

          <div class="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
            <dt class="text-[11px] text-slate-400">约束</dt>
            <dd class="mt-1 text-xs text-slate-100">{{ formatStringList(props.activeDraft.constraints) }}</dd>
          </div>

          <div class="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 sm:col-span-2">
            <dt class="text-[11px] text-slate-400">关系</dt>
            <dd class="mt-1 text-xs text-slate-100">{{ formatRelations(props.activeDraft.relations) }}</dd>
          </div>

          <div class="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 sm:col-span-2">
            <dt class="text-[11px] text-slate-400">扩展字段</dt>
            <dd class="mt-1 overflow-x-auto text-xs text-slate-100">
              <pre class="whitespace-pre-wrap">{{ formatExtra(props.activeDraft.extra) }}</pre>
            </dd>
          </div>
        </dl>
      </div>

      <div class="rounded-lg border border-white/10 bg-slate-900/70 p-3">
        <h3 class="text-xs font-medium tracking-[0.08em] text-slate-300 uppercase">锁定字段</h3>
        <p class="mt-1 text-[11px] text-slate-400">勾选后，这些字段会在后续 AI 合并中优先保留。</p>

        <div v-if="!props.activeVersion" class="mt-2 text-xs text-slate-500">当前会话暂无可用版本。</div>

        <div v-else class="mt-2 grid grid-cols-2 gap-2" data-worldbuilding-locked-fields>
          <BaseCheckbox
            v-for="field in props.lockableFields"
            :key="field"
            :model-value="props.activeVersion.lockedFields.includes(field)"
            class="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200"
            @update:model-value="emit('toggle-field-lock', field)"
          >
            <span>{{ props.lockedFieldLabelMap[field] }}</span>
          </BaseCheckbox>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import HelpTriggerButton from '../../components/help/HelpTriggerButton.vue';
import BaseButton from '../../base/BaseButton.vue';
import BaseCheckbox from '../../base/BaseCheckbox.vue';
import type {
  WorldbuildingDraft,
  WorldbuildingDraftField,
  WorldbuildingDraftVersion,
} from '../../../types/worldbuilding';

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
    activeVersion?: WorldbuildingDraftVersion | null;
    activeDraft?: WorldbuildingDraft | null;
    lockableFields?: WorldbuildingDraftField[];
    lockedFieldLabelMap?: Record<WorldbuildingDraftField, string>;
  }>(),
  {
    collapsed: false,
    activeVersion: null,
    activeDraft: null,
    lockableFields: () => [],
    lockedFieldLabelMap: () => ({
      name: '名称',
      aliases: '别名',
      summary: '摘要',
      facts: '事实要点',
      constraints: '约束',
      relations: '关系',
      extra: '扩展字段',
    }),
  },
);

const emit = defineEmits<{
  'toggle-collapse': [];
  'open-help': [];
  'toggle-field-lock': [field: WorldbuildingDraftField];
}>();

const formatStringList = (values: string[]): string => {
  if (values.length === 0) {
    return '（空）';
  }

  return values.join('；');
};

const formatRelations = (relations: WorldbuildingDraft['relations']): string => {
  if (relations.length === 0) {
    return '（空）';
  }

  return relations
    .map(relation => {
      if (relation.target && relation.relation) {
        return `${relation.target}：${relation.relation}`;
      }
      return relation.target || relation.relation;
    })
    .filter(Boolean)
    .join('；');
};

const formatExtra = (extra: Record<string, unknown>): string => {
  if (Object.keys(extra).length === 0) {
    return '{}';
  }

  return JSON.stringify(extra, null, 2);
};
</script>
