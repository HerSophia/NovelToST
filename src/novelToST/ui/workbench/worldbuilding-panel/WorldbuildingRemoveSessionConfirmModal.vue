<template>
  <div
    v-if="props.visible"
    data-worldbuilding-remove-session-confirm-modal
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
  >
    <div class="w-full max-w-lg rounded-lg border border-white/15 bg-slate-900 p-4 text-slate-100 shadow-xl">
      <h3 class="text-sm font-semibold">确认删除会话</h3>
      <p class="mt-2 text-xs text-slate-300">即将删除会话：{{ props.sessionTitle || '未命名会话' }}</p>
      <p class="mt-1 text-xs text-amber-200">删除后会话内对话与版本无法恢复。</p>

      <div class="mt-4 flex justify-end gap-2">
        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="cancel-remove-session"
          class="rounded-md border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
          @click="emit('close')"
        >
          取消
        </BaseButton>
        <BaseButton
          type="button"
          variant="ghost"
          data-worldbuilding-action="confirm-remove-session"
          class="rounded-md border border-rose-400/60 bg-rose-500/20 px-3 py-1 text-xs text-rose-100 hover:bg-rose-500/30"
          @click="emit('confirm')"
        >
          确认删除
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '../../base/BaseButton.vue';

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    sessionTitle?: string;
  }>(),
  {
    visible: false,
    sessionTitle: '',
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();
</script>
