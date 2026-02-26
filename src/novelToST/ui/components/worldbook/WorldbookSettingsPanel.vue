<template>
  <BaseCard title="世界书设置" collapsible :collapsed="collapsed" @update:collapsed="emit('update:collapsed', $event)">
    <div class="grid gap-4">
      <!-- API 设置 -->
      <div class="border-b border-white/10 pb-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">API 配置</p>
        <div class="grid gap-3">
          <BaseCheckbox v-model="wb.useTavernApi">
            使用 SillyTavern API（推荐）
          </BaseCheckbox>

          <div v-if="!wb.useTavernApi" class="grid gap-3">
            <BaseSelect v-model="wb.customApiProvider" label="API 提供商">
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="gemini-proxy">Gemini (Proxy)</option>
              <option value="claude">Claude</option>
              <option value="openai-compat">OpenAI 兼容</option>
            </BaseSelect>
            <BaseInput v-model="wb.customApiEndpoint" label="API 端点" placeholder="https://..." />
            <BaseInput v-model="wb.customApiModel" label="模型名称" placeholder="gemini-2.5-flash" />
            <BaseInput v-model="wb.customApiKey" label="API Key" type="password" placeholder="sk-..." />
          </div>

          <BaseInput v-model.number="wb.apiTimeout" label="API 超时 (ms)" type="number" min="5000" hint="默认 120000ms" />
        </div>
      </div>

      <!-- 处理设置 -->
      <div class="border-b border-white/10 pb-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">处理设置</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <BaseInput v-model.number="wb.chunkSize" label="切块大小 (字符)" type="number" min="1000" hint="推荐 10000~20000" />
          <BaseSelect v-model="wb.language" label="输出语言">
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </BaseSelect>
        </div>

        <div class="mt-3 grid gap-2">
          <BaseCheckbox v-model="wb.parallelEnabled">
            启用并行处理
          </BaseCheckbox>
          <div v-if="wb.parallelEnabled" class="grid gap-3 sm:grid-cols-2">
            <BaseInput v-model.number="wb.parallelConcurrency" label="并发数" type="number" min="1" max="10" />
            <BaseSelect v-model="wb.parallelMode" label="并行模式">
              <option value="independent">独立模式</option>
              <option value="batch">批次模式</option>
            </BaseSelect>
          </div>
        </div>
      </div>

      <!-- 章节设置 -->
      <div class="border-b border-white/10 pb-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">章节识别</p>
        <div class="grid gap-3">
          <BaseCheckbox v-model="wb.useCustomChapterRegex">
            使用自定义章节正则
          </BaseCheckbox>
          <BaseInput
            v-if="wb.useCustomChapterRegex"
            v-model="wb.chapterRegexPattern"
            label="章节正则表达式"
            placeholder="第[零一二三四五六七八九十百千万0-9]+[章回卷节部篇]"
          />
          <BaseCheckbox v-model="wb.forceChapterMarker">
            强制章节标记
          </BaseCheckbox>
          <BaseCheckbox v-model="wb.useVolumeMode">
            使用分卷模式
          </BaseCheckbox>
        </div>
      </div>

      <!-- 内容设置 -->
      <div class="border-b border-white/10 pb-3">
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">内容选项</p>
        <div class="grid gap-2">
          <BaseCheckbox v-model="wb.enablePlotOutline">
            启用剧情大纲分类
          </BaseCheckbox>
          <BaseCheckbox v-model="wb.enableLiteraryStyle">
            启用文学风格分类
          </BaseCheckbox>
          <BaseCheckbox v-model="wb.allowRecursion">
            允许递归处理
          </BaseCheckbox>
          <BaseCheckbox v-model="wb.debugMode">
            调试模式
          </BaseCheckbox>
        </div>
      </div>

      <!-- 自定义提示词 -->
      <div>
        <p class="mb-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">自定义提示词</p>
        <div class="grid gap-3">
          <BaseTextarea v-model="wb.customWorldbookPrompt" label="世界书提示词" :rows="2" placeholder="追加到世界书生成提示词末尾的内容..." />
          <BaseTextarea v-model="wb.customSuffixPrompt" label="后缀提示词" :rows="2" placeholder="追加到提示词最末尾的内容..." />
          <BaseInput v-model="wb.filterResponseTags" label="过滤响应标签" hint="逗号分隔，如 thinking,/think" />
        </div>
      </div>

      <!-- 导入导出 -->
      <div class="flex gap-2 border-t border-white/10 pt-3">
        <BaseButton variant="secondary" @click="$emit('export-settings')">
          导出设置
        </BaseButton>
        <BaseButton variant="secondary" @click="$emit('import-settings')">
          导入设置
        </BaseButton>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useNovelSettingsStore } from '../../../stores/settings.store';
import BaseButton from '../../base/BaseButton.vue';
import BaseCard from '../../base/BaseCard.vue';
import BaseCheckbox from '../../base/BaseCheckbox.vue';
import BaseInput from '../../base/BaseInput.vue';
import BaseSelect from '../../base/BaseSelect.vue';
import BaseTextarea from '../../base/BaseTextarea.vue';

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  'update:collapsed': [value: boolean];
  'export-settings': [];
  'import-settings': [];
}>();

const settingsStore = useNovelSettingsStore();
const { settings } = storeToRefs(settingsStore);

const wb = computed(() => settings.value.worldbook);
</script>
