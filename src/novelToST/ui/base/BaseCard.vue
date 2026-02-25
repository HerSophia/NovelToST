<template>
  <div class="relative overflow-hidden border border-white/[0.06] bg-transparent transition-colors duration-300">
    <div class="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-cyan-400/50 via-blue-400/20 to-transparent"></div>

    <div class="pl-3">
      <!-- Header -->
      <div
        class="flex items-center justify-between py-2 pr-3 transition-colors"
        :class="[collapsible ? 'cursor-pointer hover:bg-white/[0.03]' : '', title ? 'border-b border-white/5' : '']"
        @click="toggleCollapse"
      >
        <div class="flex items-center gap-2">
          <svg
            v-if="collapsible"
            class="size-4 text-slate-400 transition-transform duration-300"
            :class="currentCollapsed ? '-rotate-90' : 'rotate-0'"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>

          <h3 v-if="title" class="text-xs font-semibold tracking-wider text-slate-200 uppercase">
            {{ title }}
          </h3>
        </div>

        <div class="flex items-center gap-2">
          <slot name="actions" />
        </div>
      </div>

      <!-- Content with Transition -->
      <div class="grid transition-[grid-template-rows] duration-300 ease-in-out" :class="currentCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'">
        <div class="overflow-hidden">
          <div class="space-y-3 py-2.5 pr-3">
            <slot />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    collapsible?: boolean;
    collapsed?: boolean;
    defaultCollapsed?: boolean;
  }>(),
  {
    title: '',
    collapsible: false,
    collapsed: undefined,
    defaultCollapsed: false,
  },
);

const emit = defineEmits<{
  'update:collapsed': [value: boolean];
}>();

const internalCollapsed = ref(props.defaultCollapsed);

const isControlled = computed(() => props.collapsed !== undefined);

const currentCollapsed = computed(() => (isControlled.value ? Boolean(props.collapsed) : internalCollapsed.value));

const setCollapsed = (value: boolean) => {
  if (!isControlled.value) {
    internalCollapsed.value = value;
  }
  emit('update:collapsed', value);
};

const toggleCollapse = () => {
  if (!props.collapsible) {
    return;
  }
  setCollapsed(!currentCollapsed.value);
};

watch(
  () => props.defaultCollapsed,
  val => {
    if (!isControlled.value) {
      internalCollapsed.value = val;
    }
  },
);

watch(
  () => props.collapsed,
  val => {
    if (val !== undefined) {
      internalCollapsed.value = val;
    }
  },
);
</script>
