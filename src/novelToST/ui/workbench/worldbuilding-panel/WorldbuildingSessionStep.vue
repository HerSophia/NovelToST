<template>
  <aside
    class="space-y-3 rounded-lg border border-white/10 bg-slate-900/55 p-3"
    data-worldbuilding-step="1-session"
  >
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.12em] text-cyan-200 uppercase">步骤 1</p>
        <h3 class="mt-1 text-sm font-medium text-white">创建并管理会话</h3>
      </div>

      <div class="flex items-center gap-2">
        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="toggle-step-1-session"
          class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
          :aria-expanded="!props.collapsed"
          aria-controls="worldbuilding-step-panel-1-session"
          @click="emit('toggle-collapse')"
        >
          {{ props.collapsed ? '展开' : '收起' }}
        </BaseButton>

        <HelpTriggerButton
          topic="worldbuilding"
          title="查看设定工坊步骤帮助"
          data-worldbuilding-help-trigger="1-session"
          @trigger="emit('open-help')"
        />
      </div>
    </div>

    <div
      v-show="!props.collapsed"
      id="worldbuilding-step-panel-1-session"
      data-worldbuilding-step-content="1-session"
      class="space-y-3"
    >
      <div class="rounded-lg border border-white/10 bg-slate-900/70 p-3">
        <h3 class="text-xs font-medium tracking-[0.08em] text-slate-300 uppercase">设定类型</h3>
        <p class="mt-1 text-[11px] text-slate-400">先选类型，后续默认标题会更清晰。</p>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <BaseButton
            v-for="option in props.typeOptions"
            :key="option.value"
            type="button"
            variant="ghost"
            class="rounded-md px-2 py-1 text-xs transition"
            :class="
              props.selectedType === option.value
                ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            "
            @click="emit('update:selectedType', option.value)"
          >
            <span>{{ option.label }}</span>
            <span v-if="option.isPlaceholder" class="ml-1 text-[10px] text-slate-400">占位</span>
          </BaseButton>
        </div>
      </div>

      <div class="rounded-lg border border-white/10 bg-slate-900/70 p-3">
        <h3 class="text-xs font-medium tracking-[0.08em] text-slate-300 uppercase">新建会话</h3>
        <p class="mt-1 text-[11px] text-slate-400">标题与种子都可留空，稍后再补也行。</p>

        <BaseInput
          :model-value="props.sessionTitle"
          type="text"
          placeholder="会话标题（可选）"
          class="mt-2 rounded-md text-xs"
          @update:model-value="handleSessionTitleModelUpdate"
        />

        <BaseTextarea
          :model-value="props.sessionSeed"
          :rows="3"
          placeholder="输入种子设定（可选）"
          class="mt-2 rounded-md text-xs"
          @update:model-value="handleSessionSeedModelUpdate"
        />

        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="create-session"
          class="mt-2 w-full rounded-md border border-cyan-400/60 bg-cyan-500/20 px-2 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/30"
          @click="emit('create-session')"
        >
          开始新会话
        </BaseButton>
      </div>

      <div class="rounded-lg border border-white/10 bg-slate-900/70 p-3">
        <h3 class="text-xs font-medium tracking-[0.08em] text-slate-300 uppercase">
          已有会话
          <span class="ml-1 text-slate-500">({{ props.sessionCount }})</span>
        </h3>

        <div v-if="props.sessions.length === 0" class="mt-2 text-xs text-slate-500">
          还没有会话，先创建一个吧。
        </div>

        <ul v-else class="mt-2 space-y-1.5" data-worldbuilding-session-list>
          <li v-for="session in props.sessions" :key="session.id">
            <BaseButton
              type="button"
              variant="ghost"
              block
              class="justify-start rounded-md px-2 py-1.5 text-left text-xs transition"
              :class="
                props.activeSessionId === session.id
                  ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-100'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              "
              @click="emit('select-session', session.id)"
            >
              <span class="w-full min-w-0">
                <p class="truncate font-medium">{{ session.title || '未命名会话' }}</p>
                <p class="truncate text-[11px] text-slate-400">{{ session.seed || '（无种子）' }}</p>
              </span>
            </BaseButton>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import HelpTriggerButton from '../../components/help/HelpTriggerButton.vue';
import BaseButton from '../../base/BaseButton.vue';
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
    typeOptions: WorldbuildingTypeOption[];
    selectedType: WorldbuildingType;
    sessionTitle?: string;
    sessionSeed?: string;
    sessionCount?: number;
    sessions?: WorldbuildingSession[];
    activeSessionId?: string | null;
  }>(),
  {
    collapsed: false,
    sessionTitle: '',
    sessionSeed: '',
    sessionCount: 0,
    sessions: () => [],
    activeSessionId: null,
  },
);

const emit = defineEmits<{
  'toggle-collapse': [];
  'open-help': [];
  'update:selectedType': [value: WorldbuildingType];
  'update:sessionTitle': [value: string];
  'update:sessionSeed': [value: string];
  'create-session': [];
  'select-session': [sessionId: string];
}>();

const handleSessionTitleModelUpdate = (value: string | number | undefined) => {
  if (typeof value !== 'string') {
    return;
  }
  emit('update:sessionTitle', value);
};

const handleSessionSeedModelUpdate = (value: string) => {
  emit('update:sessionSeed', value);
};
</script>
