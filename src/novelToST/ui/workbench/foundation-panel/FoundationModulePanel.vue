<template>
  <section
    :data-foundation-module="props.moduleId"
    class="space-y-2 rounded-lg border bg-slate-900/65 p-3 transition-colors"
    :class="props.active ? 'border-indigo-400/50 shadow-[0_0_0_1px_rgba(129,140,248,0.35)]' : 'border-white/10'"
  >
    <div class="flex items-start justify-between gap-2">
      <div>
        <h3 class="mt-1 text-sm font-medium text-white">{{ props.title }}</h3>
        <div class="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            :data-foundation-module-tier="props.moduleId"
            :data-foundation-module-tier-level="props.tier"
            class="rounded-full border px-2 py-0.5 text-[11px]"
            :class="tierClass"
          >
            {{ tierLabel }}
          </span>
        </div>
        <p v-if="props.description" class="mt-1 text-xs text-slate-400">{{ props.description }}</p>
        <p v-if="props.requiredProgress" class="mt-1 text-[11px] text-slate-500">
          {{ props.requiredProgress }}
          <template v-if="props.fieldCount > 0"> · 共 {{ props.fieldCount }} 个字段</template>
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-1.5">
        <span :data-foundation-module-status="props.moduleId" class="rounded-full border px-2 py-0.5 text-[11px]" :class="statusClass">
          {{ statusLabel }}
        </span>

        <BaseButton
          type="button"
          variant="ghost"
          :data-foundation-action="`module-assist-inline-${props.moduleId}`"
          class="rounded-md border border-indigo-400/50 bg-indigo-500/15 px-2 py-1 text-[11px] text-indigo-100 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="props.aiBusy"
          @click="emit('run-assist')"
        >
          {{ props.assisting ? 'AI 正在补这一块...' : 'AI 帮我补这一块' }}
        </BaseButton>

        <BaseButton
          type="button"
          variant="ghost"
          :data-foundation-action="`toggle-module-${props.moduleId}`"
          class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
          :aria-expanded="!props.collapsed"
          @click="emit('toggle-collapse')"
        >
          {{ props.collapsed ? '展开' : '收起' }}
        </BaseButton>

        <HelpTriggerButton
          topic="foundation"
          title="查看故事基底帮助"
          :data-foundation-help-trigger="props.moduleId"
          @trigger="emit('open-help')"
        />
      </div>
    </div>

    <div v-show="!props.collapsed" :data-foundation-module-content="props.moduleId" class="grid gap-2 md:grid-cols-2">
      <template v-for="field in props.fields" :key="field.path">
        <BaseCheckbox
          v-if="field.kind === 'boolean'"
          :model-value="Boolean(getFieldValue(field.path))"
          :input-attrs="resolveFieldInputAttrs(field)"
          class="rounded border border-white/10 bg-black/10 px-3 py-2"
          @update:model-value="value => handleBooleanFieldUpdate(field.path, value)"
        >
          <span :data-foundation-field-label="`${props.moduleId}.${field.path}`">{{ field.label }}</span>
          <span
            v-if="field.required"
            :data-foundation-field-required-marker="`${props.moduleId}.${field.path}`"
            :title="REQUIRED_FIELD_MARKER_TITLE"
            class="text-amber-300"
          >
            *
          </span>
        </BaseCheckbox>

        <div v-else-if="field.kind === 'textarea'" class="grid gap-1.5">
          <label
            :data-foundation-field-label="`${props.moduleId}.${field.path}`"
            class="flex items-center gap-1 text-[11px] tracking-wide text-slate-400 uppercase"
          >
            <span>{{ field.label }}</span>
            <span
              v-if="field.required"
              :data-foundation-field-required-marker="`${props.moduleId}.${field.path}`"
              :title="REQUIRED_FIELD_MARKER_TITLE"
              class="text-amber-300"
            >
              *
            </span>
          </label>

          <BaseTextarea
            :model-value="String(getFieldValue(field.path) ?? '')"
            label=""
            :rows="field.rows ?? 3"
            :placeholder="field.placeholder ?? ''"
            :hint="field.hint ?? ''"
            :data-foundation-field="`${props.moduleId}.${field.path}`"
            :data-foundation-field-required="field.required ? 'true' : null"
            @update:model-value="value => handleTextFieldUpdate(field.path, value)"
          />
        </div>

        <div v-else-if="field.kind === 'list'" class="grid gap-1.5">
          <label
            :data-foundation-field-label="`${props.moduleId}.${field.path}`"
            class="flex items-center gap-1 text-[11px] tracking-wide text-slate-400 uppercase"
          >
            <span>{{ field.label }}</span>
            <span
              v-if="field.required"
              :data-foundation-field-required-marker="`${props.moduleId}.${field.path}`"
              :title="REQUIRED_FIELD_MARKER_TITLE"
              class="text-amber-300"
            >
              *
            </span>
          </label>

          <BaseTextarea
            :model-value="toListInput(getFieldValue(field.path))"
            label=""
            :rows="field.rows ?? 3"
            :placeholder="field.placeholder ?? ''"
            :hint="resolveListFieldHint(field)"
            :data-foundation-field="`${props.moduleId}.${field.path}`"
            :data-foundation-field-required="field.required ? 'true' : null"
            @update:model-value="value => handleListFieldUpdate(field.path, value, field.maxItems)"
          />
        </div>

        <div v-else class="grid gap-1.5">
          <label
            :data-foundation-field-label="`${props.moduleId}.${field.path}`"
            class="flex items-center gap-1 text-[11px] tracking-wide text-slate-400 uppercase"
          >
            <span>{{ field.label }}</span>
            <span
              v-if="field.required"
              :data-foundation-field-required-marker="`${props.moduleId}.${field.path}`"
              :title="REQUIRED_FIELD_MARKER_TITLE"
              class="text-amber-300"
            >
              *
            </span>
          </label>

          <BaseInput
            :model-value="String(getFieldValue(field.path) ?? '')"
            label=""
            :placeholder="field.placeholder ?? ''"
            :hint="field.hint ?? ''"
            :data-foundation-field="`${props.moduleId}.${field.path}`"
            :data-foundation-field-required="field.required ? 'true' : null"
            @update:model-value="value => handleTextFieldUpdate(field.path, String(value ?? ''))"
          />
        </div>
      </template>
    </div>

    <p
      v-show="props.collapsed"
      :data-foundation-module-collapsed-hint="props.moduleId"
      class="rounded border border-dashed border-white/15 bg-black/15 px-2 py-1 text-xs text-slate-500"
    >
      这一块已收起。点击上方「展开」可继续编辑。
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BaseCheckbox from '../../base/BaseCheckbox.vue';
import BaseButton from '../../base/BaseButton.vue';
import BaseInput from '../../base/BaseInput.vue';
import BaseTextarea from '../../base/BaseTextarea.vue';
import type { FoundationTierLevel } from '../../../core/foundation-tier';
import HelpTriggerButton from '../../components/help/HelpTriggerButton.vue';
import type { FoundationModuleId, FoundationModuleStatus } from '../../../types/foundation';

type FoundationFieldSchema = {
  path: string;
  label: string;
  kind: 'text' | 'textarea' | 'list' | 'boolean';
  placeholder?: string;
  hint?: string;
  required?: boolean;
  rows?: number;
  maxItems?: number;
};

const props = withDefaults(
  defineProps<{
    moduleId: FoundationModuleId;
    title: string;
    description?: string;
    tier: FoundationTierLevel;
    status: FoundationModuleStatus;
    modelValue: Record<string, unknown>;
    fields: FoundationFieldSchema[];
    aiBusy?: boolean;
    assisting?: boolean;
    collapsed?: boolean;
    active?: boolean;
    requiredProgress?: string;
    fieldCount?: number;
  }>(),
  {
    description: '',
    aiBusy: false,
    assisting: false,
    collapsed: false,
    active: false,
    requiredProgress: '',
    fieldCount: 0,
  },
);

const emit = defineEmits<{
  'patch-field': [path: string, value: unknown];
  'run-assist': [];
  'toggle-collapse': [];
  'open-help': [];
}>();

const REQUIRED_FIELD_MARKER_TITLE = '这一块里建议先补的字段';

const tierLabel = computed(() => {
  if (props.tier === 'basic') {
    return '起步必填';
  }

  if (props.tier === 'intermediate') {
    return '建议补充';
  }

  return '精细控制';
});

const tierClass = computed(() => {
  if (props.tier === 'basic') {
    return 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100';
  }

  if (props.tier === 'intermediate') {
    return 'border-sky-400/40 bg-sky-500/15 text-sky-100';
  }

  return 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100';
});

const statusLabel = computed(() => {
  if (props.status === 'complete') {
    return '已完成';
  }

  if (props.status === 'partial') {
    return '部分完成';
  }

  return '未填写';
});

const statusClass = computed(() => {
  if (props.status === 'complete') {
    return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100';
  }

  if (props.status === 'partial') {
    return 'border-amber-400/40 bg-amber-500/15 text-amber-100';
  }

  return 'border-white/10 bg-white/5 text-slate-400';
});

const getFieldValue = (path: string): unknown => {
  const normalizedPath = path
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean);

  let current: unknown = props.modelValue;
  for (const segment of normalizedPath) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

const toListInput = (value: unknown): string => {
  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .join('\n');
};

const parseListInput = (rawValue: string, maxItems?: number): string[] => {
  const normalized = rawValue
    .split(/\r?\n|[，,；;]/)
    .map(item => item.trim())
    .filter(Boolean);

  const deduped = [...new Set(normalized)];
  if (typeof maxItems !== 'number') {
    return deduped;
  }

  return deduped.slice(0, Math.max(0, Math.trunc(maxItems)));
};

const resolveListFieldHint = (field: FoundationFieldSchema): string => {
  if (field.hint && field.maxItems == null) {
    return field.hint;
  }

  if (field.hint && field.maxItems != null) {
    return `${field.hint}（最多 ${field.maxItems} 项）`;
  }

  if (field.maxItems != null) {
    return `可用换行或逗号分隔，最多 ${field.maxItems} 项。`;
  }

  return '可用换行或逗号分隔。';
};

const resolveFieldInputAttrs = (field: FoundationFieldSchema): Record<string, string> => {
  return {
    'data-foundation-field': `${props.moduleId}.${field.path}`,
    ...(field.required ? { 'data-foundation-field-required': 'true' } : {}),
  };
};

const handleTextFieldUpdate = (path: string, value: string) => {
  emit('patch-field', path, value);
};

const handleListFieldUpdate = (path: string, value: string, maxItems?: number) => {
  emit('patch-field', path, parseListInput(value, maxItems));
};

const handleBooleanFieldUpdate = (path: string, value: boolean) => {
  emit('patch-field', path, Boolean(value));
};
</script>
