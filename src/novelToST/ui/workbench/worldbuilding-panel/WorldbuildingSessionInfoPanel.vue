<template>
  <div
    v-if="props.activeSession"
    v-show="!props.collapsed"
    data-worldbuilding-session-info-panel
    class="rounded-lg border border-white/10 bg-slate-900/70 p-3"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p class="text-xs text-slate-400">会话信息</p>
        <p class="text-sm font-medium text-white">{{ props.activeSession.title || '未命名会话' }}</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="add-version"
          class="rounded-md border border-violet-400/60 bg-violet-500/20 px-2 py-1 text-xs text-violet-100 transition hover:bg-violet-500/30"
          @click="emit('add-version')"
        >
          另存为新版本
        </BaseButton>

        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="apply-session-edit"
          class="rounded-md border border-cyan-400/60 bg-cyan-500/20 px-2 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/30"
          @click="emit('apply-session-edit')"
        >
          保存会话设置
        </BaseButton>

        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="open-remove-session-confirm"
          class="rounded-md border border-rose-400/60 bg-rose-500/20 px-2 py-1 text-xs text-rose-100 transition hover:bg-rose-500/30"
          @click="emit('open-remove-session-confirm')"
        >
          删除会话
        </BaseButton>
      </div>
    </div>

    <div class="mt-2 grid gap-2 sm:grid-cols-2">
      <label class="text-[11px] text-slate-400">
        <span>会话标题</span>
        <BaseInput
          :model-value="props.sessionEditTitle"
          data-worldbuilding-session-edit-title
          type="text"
          class="mt-1 rounded-md text-xs"
          @update:model-value="handleSessionEditTitleModelUpdate"
        />
      </label>

      <label class="text-[11px] text-slate-400">
        <span>设定类型</span>
        <BaseDropdownSelect
          :model-value="props.sessionEditType"
          :options="sessionTypeOptions"
          data-worldbuilding-session-edit-type
          list-data-attr-name="data-worldbuilding-session-edit-type-list"
          item-data-attr-name="data-worldbuilding-session-edit-type-option"
          class="mt-1 rounded-md text-xs"
          @update:model-value="handleSessionEditTypeModelUpdate"
        />
      </label>

      <label class="text-[11px] text-slate-400 sm:col-span-2">
        <span>种子设定</span>
        <BaseTextarea
          :model-value="props.sessionEditSeed"
          data-worldbuilding-session-edit-seed
          :rows="2"
          class="mt-1 rounded-md text-xs"
          @update:model-value="handleSessionEditSeedModelUpdate"
        />
      </label>
    </div>

    <div class="mt-2 flex flex-wrap gap-2">
      <BaseButton
        type="button"
        variant="ghost"
        data-worldbuilding-action="reset-session-edit"
        class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
        @click="emit('reset-session-edit')"
      >
        撤销本次编辑
      </BaseButton>
    </div>

    <div class="mt-3 flex flex-wrap gap-2" data-worldbuilding-version-list>
      <BaseButton
        v-for="version in props.activeSession.versions"
        :key="version.id"
        type="button"
        variant="ghost"
        class="rounded-md px-2 py-1 text-xs transition"
        :class="
          props.activeSession.activeVersionId === version.id
            ? 'border-violet-400/70 bg-violet-500/20 text-violet-100'
            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
        "
        @click="emit('select-version', version.id)"
      >
        V{{ version.version }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseButton from '../../base/BaseButton.vue';
import BaseDropdownSelect from '../../base/BaseDropdownSelect.vue';
import BaseInput from '../../base/BaseInput.vue';
import BaseTextarea from '../../base/BaseTextarea.vue';
import type { WorldbuildingSession, WorldbuildingType } from '../../../types/worldbuilding';

type WorldbuildingTypeOption = {
  value: WorldbuildingType;
  label: string;
  isPlaceholder: boolean;
};

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
    activeSession: WorldbuildingSession | null;
    typeOptions: WorldbuildingTypeOption[];
    sessionEditTitle?: string;
    sessionEditType: WorldbuildingType;
    sessionEditSeed?: string;
  }>(),
  {
    collapsed: false,
    sessionEditTitle: '',
    sessionEditSeed: '',
  },
);

const emit = defineEmits<{
  'add-version': [];
  'apply-session-edit': [];
  'open-remove-session-confirm': [];
  'reset-session-edit': [];
  'select-version': [versionId: string];
  'update:sessionEditTitle': [value: string];
  'update:sessionEditType': [value: WorldbuildingType];
  'update:sessionEditSeed': [value: string];
}>();

const sessionTypeOptions = computed(() => {
  return props.typeOptions.map(option => ({
    value: option.value,
    label: option.label,
  }));
});

const handleSessionEditTitleModelUpdate = (value: string | number | undefined) => {
  if (typeof value !== 'string') {
    return;
  }
  emit('update:sessionEditTitle', value);
};

const handleSessionEditTypeModelUpdate = (value: string | number) => {
  if (typeof value !== 'string') {
    return;
  }

  if (!props.typeOptions.some(option => option.value === value)) {
    return;
  }
  emit('update:sessionEditType', value as WorldbuildingType);
};

const handleSessionEditSeedModelUpdate = (value: string) => {
  emit('update:sessionEditSeed', value);
};
</script>
