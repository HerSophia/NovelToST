<template>
  <VueFinalModal
    :model-value="modelValue"
    class="flex items-center justify-center"
    content-class="w-[min(760px,94vw)] max-h-[84vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-xl"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold">导入世界书合并预览</h2>
      <button class="text-slate-400 hover:text-white" @click="emit('update:modelValue', false)">✕</button>
    </div>

    <div v-if="!preview" class="py-8 text-center text-sm text-slate-500">
      暂无可预览的导入数据。
    </div>

    <template v-else>
      <div class="mb-3 rounded border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-300">
        <div>文件：<span class="text-slate-100">{{ preview.fileName }}</span></div>
        <div class="mt-1">来源格式：{{ preview.preview.sourceFormat === 'sillytavern' ? 'SillyTavern' : '内部世界书' }}</div>
        <div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] md:grid-cols-4">
          <div>总条目：<span class="text-cyan-300">{{ preview.preview.totalEntries }}</span></div>
          <div>新条目：<span class="text-emerald-300">{{ preview.preview.newEntries.length }}</span></div>
          <div>重复条目：<span class="text-amber-300">{{ preview.preview.allDuplicates.length }}</span></div>
          <div>内部重复：<span class="text-violet-300">{{ preview.preview.internalDuplicates.length }}</span></div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div class="grid gap-3 pb-2 md:grid-cols-2">
          <div class="rounded border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div class="mb-2 text-xs font-semibold text-emerald-300">新条目（{{ preview.preview.newEntries.length }}）</div>
            <div v-if="preview.preview.newEntries.length === 0" class="text-[11px] text-slate-500">
              无
            </div>
            <ul v-else class="max-h-48 space-y-1 overflow-y-auto text-[11px]">
              <li v-for="item in preview.preview.newEntries" :key="`${item.category}::${item.name}`" class="text-slate-300">
                <span class="text-emerald-300">{{ item.category }}</span>
                <span class="mx-1 text-slate-500">/</span>
                <span>{{ item.name }}</span>
              </li>
            </ul>
          </div>

          <div class="rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <div class="mb-2 text-xs font-semibold text-amber-300">重复条目（{{ preview.preview.allDuplicates.length }}）</div>
            <div v-if="preview.preview.allDuplicates.length === 0" class="text-[11px] text-slate-500">
              无
            </div>
            <ul v-else class="max-h-48 space-y-1 overflow-y-auto text-[11px]">
              <li
                v-for="(item, index) in preview.preview.allDuplicates"
                :key="`${item.category}::${item.name}::${index}`"
                class="text-slate-300"
              >
                <span class="text-amber-300">{{ item.category }}</span>
                <span class="mx-1 text-slate-500">/</span>
                <span>{{ item.name }}</span>
                <span v-if="isInternalDuplicate(index)" class="ml-1 text-[10px] text-violet-300">(内部重复)</span>
              </li>
            </ul>
          </div>
        </div>

        <div v-if="hasDuplicates" class="mt-2 rounded border border-white/10 bg-white/[0.02] p-3">
          <div class="mb-2 text-xs font-semibold text-slate-200">重复条目处理方式</div>
          <div class="grid gap-2 text-[11px] text-slate-300 md:grid-cols-2">
            <label class="flex items-start gap-2 rounded border border-white/10 p-2">
              <input v-model="mergeMode" type="radio" value="ai" class="mt-0.5" />
              <span>🤖 AI 智能合并</span>
            </label>
            <label class="flex items-start gap-2 rounded border border-white/10 p-2">
              <input v-model="mergeMode" type="radio" value="replace" class="mt-0.5" />
              <span>📝 后者覆盖前者</span>
            </label>
            <label class="flex items-start gap-2 rounded border border-white/10 p-2">
              <input v-model="mergeMode" type="radio" value="keep" class="mt-0.5" />
              <span>🔒 保留前者</span>
            </label>
            <label class="flex items-start gap-2 rounded border border-white/10 p-2">
              <input v-model="mergeMode" type="radio" value="rename" class="mt-0.5" />
              <span>📋 重命名保留</span>
            </label>
            <label class="flex items-start gap-2 rounded border border-white/10 p-2 md:col-span-2">
              <input v-model="mergeMode" type="radio" value="append" class="mt-0.5" />
              <span>➕ 内容叠加</span>
            </label>
          </div>

          <div v-if="mergeMode === 'ai'" class="mt-3 grid gap-2 rounded border border-violet-500/20 bg-violet-500/5 p-3">
            <label class="text-[11px] text-slate-300">
              并发数
              <input
                v-model.number="aiConcurrency"
                type="number"
                min="1"
                max="10"
                class="mt-1 w-24 rounded border border-white/15 bg-slate-800 px-2 py-1 text-xs text-slate-100"
              />
            </label>
            <label class="text-[11px] text-slate-300">
              自定义合并提示词（可选）
              <textarea
                v-model="customPrompt"
                rows="4"
                class="mt-1 w-full rounded border border-white/15 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                placeholder="留空将使用当前设置中的默认合并提示词"
              />
            </label>
          </div>
        </div>

        <div class="mt-2 rounded border border-violet-500/20 bg-violet-500/5 p-3">
          <label class="flex items-center gap-2 text-xs text-violet-200">
            <input v-model="enableAliasMerge" type="checkbox" class="mt-0.5" />
            <span>启用别名合并（在导入冲突处理完成后执行）</span>
          </label>

          <div class="mt-2 text-[11px] text-slate-400">
            规则格式：<code>分类::主条目=别名1,别名2</code>，一行一组，可使用 <code>#</code> 开头写注释。
          </div>

          <textarea
            v-model="aliasRuleText"
            :disabled="!enableAliasMerge"
            rows="4"
            class="mt-2 w-full rounded border border-white/15 bg-slate-800 px-2 py-1 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="# 示例\n角色::林舟=阿舟,巡夜人"
          />

          <div v-if="enableAliasMerge" class="mt-2 grid gap-2 rounded border border-white/10 p-2 text-[11px] text-slate-300">
            <div class="font-medium text-slate-200">别名冲突策略</div>
            <div class="grid gap-2 md:grid-cols-3">
              <label class="flex items-start gap-2 rounded border border-white/10 p-2">
                <input v-model="aliasMergeMode" type="radio" value="append" class="mt-0.5" />
                <span>➕ 叠加内容（默认）</span>
              </label>
              <label class="flex items-start gap-2 rounded border border-white/10 p-2">
                <input v-model="aliasMergeMode" type="radio" value="replace" class="mt-0.5" />
                <span>📝 别名覆盖主条目</span>
              </label>
              <label class="flex items-start gap-2 rounded border border-white/10 p-2">
                <input v-model="aliasMergeMode" type="radio" value="keep" class="mt-0.5" />
                <span>🔒 保留主条目</span>
              </label>
            </div>
            <label class="flex items-start gap-2 rounded border border-white/10 p-2">
              <input v-model="keepAliasEntries" type="checkbox" class="mt-0.5" />
              <span>保留别名条目（仅复制信息到主条目，不删除别名）</span>
            </label>
          </div>

          <ul v-if="enableAliasMerge && aliasRuleErrors.length > 0" class="mt-2 list-disc space-y-1 pl-4 text-[11px] text-rose-300">
            <li v-for="(error, index) in aliasRuleErrors" :key="`${error}-${index}`">{{ error }}</li>
          </ul>
          <div v-else-if="enableAliasMerge" class="mt-2 text-[11px] text-slate-300">
            将应用 <span class="text-violet-300">{{ parsedAliasGroups.groups.length }}</span> 组别名规则。
          </div>
        </div>
      </div>

      <div class="mt-4 flex justify-end gap-2 border-t border-white/10 pt-3">
        <button
          class="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
          :disabled="loading"
          @click="emit('update:modelValue', false)"
        >
          取消
        </button>
        <button
          class="rounded bg-cyan-500 px-3 py-1.5 text-sm text-white hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading || !aliasMergeReady"
          @click="handleConfirm"
        >
          {{ loading ? '合并中...' : '确认导入' }}
        </button>
      </div>
    </template>
  </VueFinalModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { VueFinalModal } from 'vue-final-modal';
import type {
  WorldbookAliasMergeGroup,
  WorldbookAliasMergeMode,
  WorldbookMergeMode,
} from '../../../core/worldbook/merge.service';
import type { WorldbookImportPreview } from '../../../core/worldbook/st-format.service';

type AliasMergePayload = {
  groups: WorldbookAliasMergeGroup[];
  mode: WorldbookAliasMergeMode;
  keepAliases: boolean;
};

type ParsedAliasGroupsResult = {
  groups: WorldbookAliasMergeGroup[];
  errors: string[];
};

function parseAliasGroupText(rawText: string): ParsedAliasGroupsResult {
  const grouped = new Map<string, WorldbookAliasMergeGroup>();
  const errors: string[] = [];

  rawText.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0 || separatorIndex === line.length - 1) {
      errors.push(`第 ${index + 1} 行格式无效：请使用「分类::主条目=别名1,别名2」`);
      return;
    }

    const left = line.slice(0, separatorIndex).trim();
    const right = line.slice(separatorIndex + 1).trim();
    const scope = left.split('::').map(item => item.trim());

    if (scope.length !== 2 || !scope[0] || !scope[1]) {
      errors.push(`第 ${index + 1} 行缺少分类或主条目：${line}`);
      return;
    }

    const category = scope[0] as string;
    const canonicalName = scope[1] as string;
    const aliases = Array.from(new Set(right.split(/[;,，；]/).map(item => item.trim()).filter(Boolean))).filter(
      (alias) => alias.toLowerCase() !== canonicalName.toLowerCase(),
    );

    if (aliases.length === 0) {
      errors.push(`第 ${index + 1} 行未提供有效别名：${line}`);
      return;
    }

    const key = `${category.toLowerCase()}::${canonicalName.toLowerCase()}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.aliases = Array.from(new Set([...existing.aliases, ...aliases]));
      return;
    }

    grouped.set(key, { category, canonicalName, aliases });
  });

  return { groups: Array.from(grouped.values()), errors };
}

type ImportPreviewPayload = {
  fileName: string;
  preview: WorldbookImportPreview;
};

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    preview: ImportPreviewPayload | null;
    loading?: boolean;
    defaultConcurrency?: number;
    defaultCustomPrompt?: string;
  }>(),
  {
    loading: false,
    defaultConcurrency: 3,
    defaultCustomPrompt: '',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [payload: {
    mode: WorldbookMergeMode;
    customPrompt?: string;
    concurrency?: number;
    aliasMerge?: AliasMergePayload;
  }];
}>();

const mergeMode = ref<WorldbookMergeMode>('ai');
const aiConcurrency = ref(3);
const customPrompt = ref('');
const enableAliasMerge = ref(false);
const aliasMergeMode = ref<WorldbookAliasMergeMode>('append');
const keepAliasEntries = ref(false);
const aliasRuleText = ref('');

const hasDuplicates = computed(() => (props.preview?.preview.allDuplicates.length ?? 0) > 0);
const parsedAliasGroups = computed(() => parseAliasGroupText(aliasRuleText.value));
const aliasRuleErrors = computed(() => parsedAliasGroups.value.errors);
const aliasMergeReady = computed(() => !enableAliasMerge.value || (aliasRuleErrors.value.length === 0 && parsedAliasGroups.value.groups.length > 0));

function isInternalDuplicate(index: number): boolean {
  if (!props.preview) {
    return false;
  }

  return index < props.preview.preview.internalDuplicates.length;
}

function handleConfirm(): void {
  const mode: WorldbookMergeMode = hasDuplicates.value ? mergeMode.value : 'keep';

  if (!aliasMergeReady.value) {
    return;
  }

  emit('confirm', {
    mode,
    customPrompt: customPrompt.value,
    concurrency: aiConcurrency.value,
    aliasMerge: enableAliasMerge.value
      ? { groups: parsedAliasGroups.value.groups, mode: aliasMergeMode.value, keepAliases: keepAliasEntries.value }
      : undefined,
  });
}

watch(
  () => [props.modelValue, props.preview?.fileName, props.defaultConcurrency, props.defaultCustomPrompt] as const,
  ([open]) => {
    if (!open) {
      return;
    }

    mergeMode.value = hasDuplicates.value ? 'ai' : 'keep';
    aiConcurrency.value = Math.max(1, Math.trunc(props.defaultConcurrency));
    customPrompt.value = props.defaultCustomPrompt;
    enableAliasMerge.value = false;
    aliasMergeMode.value = 'append';
    keepAliasEntries.value = false;
    aliasRuleText.value = '';
  },
  { immediate: true },
);
</script>
