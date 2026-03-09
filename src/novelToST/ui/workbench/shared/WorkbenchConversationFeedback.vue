<template>
  <div
    v-if="props.warningText"
    data-conversation-feedback
    class="rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-xs text-amber-100"
  >
    <div class="flex items-start justify-between gap-2">
      <div>
        <p>⚠️ {{ props.warningText }}</p>
        <p v-if="props.safetyText" class="mt-1 text-amber-300/70">
          {{ props.safetyText }}
        </p>
      </div>

      <BaseButton
        v-if="props.canClear"
        variant="ghost"
        data-conversation-action="clear-feedback"
        class="shrink-0 text-[11px] text-amber-200/80 hover:text-amber-100"
        @click="emit('clear')"
      >
        清除
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '../../base/BaseButton.vue';

const props = withDefaults(
  defineProps<{
    warningText?: string| null;
    safetyText?: string | null;
    canClear?: boolean;
  }>(),
  {
    warningText: null,
    safetyText: null,
    canClear: true,
  },
);

const emit = defineEmits<{
  'clear': [];
}>();
</script>
