<template>
  <div
    v-if="props.open"
    data-outline-delete-request-modal
    class="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 p-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-lg rounded-xl border border-rose-400/20 bg-slate-900 p-4 text-slate-100 shadow-2xl">
      <div class="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p class="text-sm font-semibold text-rose-50">确认删除上一次请求</p>
          <p class="mt-1 text-xs whitespace-pre-wrap text-slate-300">
            这会回退当前对话的最后一轮消息，并可能移除对应草案版本。
          </p>
        </div>
        <BaseButton variant="ghost" data-outline-delete-request-action="close" @click="emit('close')">关闭</BaseButton>
      </div>

      <p class="mt-3 text-xs text-slate-300">删除后无法直接恢复。如需保留当前结果，请先应用或记录对应草案。</p>

      <div class="mt-4 flex justify-end gap-2">
        <BaseButton variant="ghost" data-outline-delete-request-action="cancel" @click="emit('close')">取消</BaseButton>
        <BaseButton
          variant="ghost"
          data-outline-delete-request-action="confirm"
          class="border border-rose-400/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
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
    open?: boolean;
  }>(),
  {
    open: false,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();
</script>
