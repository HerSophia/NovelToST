<template>
  <div data-conversation-actions class="flex flex-wrap items-center gap-2">
    <slot />

    <BaseButton
      v-if="props.canRetry"
      variant="ghost"
      data-conversation-action="retry-last-round"
      :disabled="props.retryDisabled"
      @click="emit('retry-last-round')"
    >
      🔁 重试上一次
    </BaseButton>

    <BaseButton
      v-if="props.canDelete"
      variant="ghost"
      data-conversation-action="delete-last-round"
      :disabled="props.deleteDisabled"
      @click="emit('delete-last-round')"
    >
      🗑 删除上一次
    </BaseButton>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '../../base/BaseButton.vue';

const props = withDefaults(
  defineProps<{
    canRetry?: boolean;
    canDelete?: boolean;
    retryDisabled?: boolean;
    deleteDisabled?: boolean;
  }>(),
  {
    canRetry: true,
    canDelete: true,
    retryDisabled: false,
    deleteDisabled: false,
  },
);

const emit = defineEmits<{
  'retry-last-round': [];
  'delete-last-round': [];
}>();
</script>
