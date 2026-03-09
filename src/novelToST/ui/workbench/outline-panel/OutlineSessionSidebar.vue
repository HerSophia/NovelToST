<template>
  <aside class="rounded-xl border border-white/10 bg-slate-900/55 p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-medium text-slate-300">💬 我的对话</p>
      <span class="text-[11px] text-slate-500">{{ props.sessions.length }} 个</span>
    </div>

    <div v-if="props.sessions.length === 0" class="mt-3 rounded-md border border-dashed border-white/15 p-3 text-center text-xs text-slate-400">
      <p>还没有对话</p>
      <p class="mt-1 text-slate-500">创建一个新对话，开始构建你的故事大纲吧。</p>
    </div>

    <div v-else class="mt-2 space-y-1.5" data-outline-session-list>
      <button
        v-for="session in props.sessions"
        :key="session.id"
        type="button"
        class="w-full rounded-md border px-2 py-1.5 text-left text-xs transition"
        :class="
          props.activeSessionId === session.id
            ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100'
            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
        "
        @click="emit('select-session', session.id)"
      >
        <p class="truncate font-medium">{{ session.title || '未命名对话' }}</p>
        <p class="mt-0.5 truncate text-[11px] text-slate-400">
          {{ session.messages.length }} 条消息 · {{ session.snapshots.length }} 个草案
        </p>
      </button>
    </div>

    <div class="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/15 p-2.5">
      <p class="text-[11px] font-medium text-slate-300">新建对话</p>

      <BaseInput v-model="sessionTitleModel" label="标题（可选）" placeholder="如：主线大纲 / 前三章节奏" />

      <BaseTextarea v-model="sessionSeedModel" :rows="2" label="初始想法（可选）" placeholder="简要描述你想讨论的方向…" />

      <BaseButton variant="success" block data-outline-action="create-session" @click="emit('create-session')">✨ 开始新对话</BaseButton>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseButton from '../../base/BaseButton.vue';
import BaseInput from '../../base/BaseInput.vue';
import BaseTextarea from '../../base/BaseTextarea.vue';
import type { OutlineSession } from '../../../types/outline';

const props = withDefaults(
  defineProps<{
    sessions?: OutlineSession[];
    activeSessionId?: string | null;
    sessionTitle?: string;
    sessionSeed?: string;
  }>(),
  {
    sessions: () => [],
    activeSessionId: null,
    sessionTitle: '',
    sessionSeed: '',
  },
);

const emit = defineEmits<{
  'update:sessionTitle': [value: string];
  'update:sessionSeed': [value: string];
  'create-session': [];
  'select-session': [sessionId: string];
}>();

const sessionTitleModel = computed({
  get: () => props.sessionTitle,
  set: value => emit('update:sessionTitle', value),
});

const sessionSeedModel = computed({
  get: () => props.sessionSeed,
  set: value => emit('update:sessionSeed', value),
});
</script>
