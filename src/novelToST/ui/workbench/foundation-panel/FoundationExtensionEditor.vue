<template>
  <section data-foundation-extensions class="space-y-2 rounded-lg border border-white/10 bg-slate-900/65 p-3">
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">扩展模块</p>
        <h3 class="mt-1 text-sm font-medium text-white">自定义补充字段</h3>
        <p class="mt-1 text-xs text-slate-400">用来记录本项目特有的限制或约定，比如平台审核要求、连载节奏规划等。</p>
      </div>

      <div class="flex items-center gap-2">
        <span class="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[11px] text-slate-300">
          共 {{ props.extensions.length }} 项
        </span>

        <BaseButton
          type="button"
          variant="ghost"
          data-foundation-action="add-extension"
          class="rounded-md border border-emerald-400/50 bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-100 transition hover:bg-emerald-500/25"
          @click="emit('add-extension')"
        >
          新增扩展
        </BaseButton>

        <HelpTriggerButton
          topic="foundation"
          title="查看故事基底帮助"
          data-foundation-help-trigger="extensions"
          @trigger="emit('open-help')"
        />
      </div>
    </div>

    <div v-if="props.extensions.length === 0" class="rounded border border-dashed border-white/15 bg-black/20 p-3 text-xs text-slate-500">
      还没有扩展模块。如果你的项目有特殊约束（如平台审核要求、连载周期限制），可以在这里新增。
    </div>

    <div v-else class="grid gap-2 xl:grid-cols-2">
      <div
        v-for="(extension, index) in props.extensions"
        :key="extension.id"
        :data-foundation-extension-item="extension.id"
        class="space-y-2 rounded border border-white/10 bg-black/20 p-3"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-[11px] text-slate-500">扩展 {{ index + 1 }}</p>

          <BaseButton
            type="button"
            variant="danger"
            data-foundation-action="remove-extension"
            :data-foundation-extension-id="extension.id"
            class="rounded-md border border-rose-400/50 bg-rose-500/15 px-2 py-1 text-[11px] text-rose-100 transition hover:bg-rose-500/25"
            @click="emit('remove-extension', extension.id)"
          >
            删除
          </BaseButton>
        </div>

        <BaseInput
          :model-value="extension.title"
          label="模块标题"
          placeholder="例如：平台限制、章节节奏控制"
          :data-foundation-extension-title="extension.id"
          @update:model-value="value => handleTitleUpdate(extension.id, value)"
        />

        <BaseTextarea
          :model-value="toPrettyJson(extension.fields)"
          label="字段 JSON"
          :rows="6"
          placeholder="例如：{ &quot;platform&quot;: &quot;起点中文网&quot;, &quot;updateCycle&quot;: &quot;日更&quot; }"
          hint="编辑后点击其他区域自动保存。格式错误不会丢失原有内容。"
          :data-foundation-extension-fields="extension.id"
          @blur="handleFieldsBlur(extension.id, $event)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import BaseButton from '../../base/BaseButton.vue';
import BaseInput from '../../base/BaseInput.vue';
import BaseTextarea from '../../base/BaseTextarea.vue';
import HelpTriggerButton from '../../components/help/HelpTriggerButton.vue';
import type { FoundationExtensionModule } from '../../../types/foundation';

const props = withDefaults(
  defineProps<{
    extensions?: FoundationExtensionModule[];
  }>(),
  {
    extensions: () => [],
  },
);

const emit = defineEmits<{
  'add-extension': [];
  'update-extension': [id: string, patch: Partial<FoundationExtensionModule>];
  'remove-extension': [id: string];
  'open-help': [];
}>();

const toPrettyJson = (fields: Record<string, unknown>): string => {
  return JSON.stringify(fields, null, 2);
};

const handleTitleUpdate = (id: string, value: string | number | undefined) => {
  emit('update-extension', id, {
    title: String(value ?? ''),
  });
};

const handleFieldsBlur = (id: string, event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) {
    return;
  }

  const text = target.value.trim();
  if (!text) {
    emit('update-extension', id, { fields: {} });
    return;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      toastr.warning('扩展字段必须是 JSON 对象，当前输入已忽略。');
      return;
    }

    emit('update-extension', id, {
      fields: parsed as Record<string, unknown>,
    });
  } catch {
    toastr.warning('扩展字段 JSON 解析失败，当前输入已忽略。');
  }
};
</script>
