<template>
  <div class="grid gap-2 sm:grid-cols-5">
    <BaseButton variant="success" :disabled="!canStart" @click="$emit('start')">
      <template #icon>
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </template>
      开始
    </BaseButton>
    <BaseButton variant="warning" :disabled="!canPause" @click="$emit('pause')">
      <template #icon>
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </template>
      暂停
    </BaseButton>
    <BaseButton variant="primary" :disabled="!canResume" @click="$emit('resume')">
      <template #icon>
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </template>
      恢复
    </BaseButton>
    <BaseButton variant="danger" :disabled="!canStop" @click="$emit('stop')">
      <template #icon>
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      </template>
      停止
    </BaseButton>
    <BaseButton variant="secondary" :disabled="!canReset" @click="$emit('reset')">
      <template #icon>
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </template>
      重置
    </BaseButton>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '../base/BaseButton.vue';

defineProps<{
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  canReset: boolean;
}>();

defineEmits<{
  start: [];
  pause: [];
  resume: [];
  stop: [];
  reset: [];
}>();
</script>
