<template>
  <section data-workbench-foundation-panel class="space-y-4 text-sm text-slate-200 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:gap-4 xl:space-y-0">
    <div class="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-slate-900/40 p-3 text-xs text-indigo-100">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="font-semibold">故事基底</p>
          <p class="mt-1 text-indigo-100/90">先把这个故事最基本的方向写清楚：写什么、谁推动故事、冲突从哪里来、最后走到哪里。后面的设定工坊和大纲工坊都会参考这里。</p>
          <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span class="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-100">
              已完成 {{ foundationStore.completedCount }}
            </span>
            <span class="rounded-full border border-amber-300/40 bg-amber-500/15 px-2 py-0.5 text-amber-100">
              待补充 {{ foundationStore.totalModuleCount - foundationStore.completedCount }}
            </span>
            <span class="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-slate-300">
              记录 {{ foundationStore.messages.length }} 条
            </span>
          </div>
        </div>

        <HelpTriggerButton
          topic="foundation"
          title="查看故事基底帮助"
          data-foundation-help-trigger="overview"
          @trigger="openFoundationHelp"
        />
      </div>
    </div>

    <section data-foundation-workspace class="grid gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[340px_minmax(0,1fr)_320px] xl:overflow-hidden">
      <aside data-foundation-left-rail class="space-y-3 xl:self-start">
        <FoundationChatStep
          v-model:message-input="messageInput"
          :ai-busy="aiBusy"
          :ai-busy-module-id="aiBusyModuleId"
          :messages="foundationStore.messages"
          :last-parse-warning="lastParseWarning"
          :can-retry-last-round="canRetryLastRound"
          :can-delete-last-round="canDeleteLastRound"
          :module-options="moduleAssistOptions"
          @run-collaborate="handleRunCollaborate"
          @run-module-assist="handleRunModuleAssist"
          @retry-last-round="handleRetryLastRound"
          @delete-last-round="handleDeleteLastRound"
          @clear-parse-warning="handleClearParseWarning"
          @clear-messages="clearMessages"
          @open-help="openFoundationHelp"
        />
      </aside>

      <section data-foundation-center-editor class="min-h-0 space-y-3 xl:overflow-y-auto xl:pr-1">
        <section data-foundation-modules class="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-3">
          <div>
            <div>
              <p class="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">模块编辑区</p>
              <h3 class="mt-1 text-sm font-medium text-white">先把故事的基本方向写清楚</h3>
              <p class="mt-1 text-xs text-slate-400">建议从「作品定位」开始，按顺序往下写。拿不准时，可以先写短句，后面再补细。</p>
              <p data-foundation-required-legend class="mt-1 text-[11px] text-slate-500">
                带 * 的字段，是这一块里建议先补的内容。是否已经可以开始生成，请看右侧提示。
              </p>
            </div>
          </div>

          <div
            data-foundation-toolbar
            class="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_auto]"
          >
            <div data-foundation-toolbar-group="mode" class="space-y-1.5">
              <p class="text-[10px] tracking-[0.12em] text-slate-500 uppercase">显示范围</p>

              <div class="flex flex-wrap items-center gap-1.5">
                <span
                  data-foundation-mode-current
                  class="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[11px] text-slate-300"
                >
                  {{ foundationModeLabel }}
                </span>

                <BaseButton
                  v-for="option in foundationModeOptions"
                  :key="option.id"
                  type="button"
                  variant="ghost"
                  :data-foundation-mode="option.id"
                  class="rounded-md border px-2 py-1 text-[11px] transition"
                  :class="foundationMode === option.id ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100' : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'"
                  @click="setFoundationMode(option.id)"
                >
                  {{ option.label }}
                </BaseButton>
              </div>
            </div>

            <div data-foundation-toolbar-group="filter" class="space-y-1.5">
              <p class="text-[10px] tracking-[0.12em] text-slate-500 uppercase">模块筛选</p>

              <div class="flex flex-wrap items-center gap-1.5">
                <BaseButton
                  v-for="option in moduleFilterOptions"
                  :key="option.id"
                  type="button"
                  variant="ghost"
                  :data-foundation-module-filter="option.id"
                  class="rounded-md border px-2 py-1 text-[11px] transition"
                  :class="
                    moduleStatusFilter === option.id
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  "
                  @click="setModuleStatusFilter(option.id)"
                >
                  {{ option.label }}（{{ option.count }}）
                </BaseButton>
              </div>
            </div>

            <div data-foundation-toolbar-group="view" class="space-y-1.5 xl:justify-self-end">
              <p class="text-[10px] tracking-[0.12em] text-slate-500 uppercase">展开与收起</p>

              <div class="flex flex-wrap items-center gap-1.5 xl:justify-end">
                <BaseButton
                  type="button"
                  variant="ghost"
                  data-foundation-action="expand-all-modules"
                  class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
                  @click="expandAllModules"
                >
                  展开全部
                </BaseButton>

                <BaseButton
                  type="button"
                  variant="ghost"
                  data-foundation-action="collapse-all-modules"
                  class="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
                  @click="collapseAllModules"
                >
                  收起全部
                </BaseButton>
              </div>
            </div>
          </div>

          <div
            v-if="shouldShowAdvancedContentHint"
            data-foundation-advanced-content-hint
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 p-3 text-xs text-fuchsia-100"
          >
            <div>
              <p class="font-medium">已发现完整模式内容</p>
              <p class="mt-1 text-fuchsia-100/80">
                你之前已经写了 {{ foundationStore.tierSummary.advanced.filled }} / {{ foundationStore.tierSummary.advanced.total }} 个精细控制模块。当前在常用模式下，这些内容会先隐藏。
              </p>
            </div>

            <BaseButton type="button" variant="ghost" data-foundation-action="switch-to-advanced-mode" class="rounded-md border border-fuchsia-400/40 bg-fuchsia-500/15 px-2 py-1 text-[11px] text-fuchsia-50 transition hover:bg-fuchsia-500/25" @click="setFoundationMode('advanced')">
              切到完整模式
            </BaseButton>
          </div>

          <div class="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
            <aside class="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2 xl:sticky xl:top-3 xl:max-h-[72vh] xl:overflow-y-auto">
              <p class="px-1 text-[11px] tracking-[0.08em] text-slate-400 uppercase">快速定位</p>

              <BaseButton
                v-for="module in visibleModuleConfigs"
                :key="module.id"
                type="button"
                variant="ghost"
                :data-foundation-module-quick-jump="module.id"
                class="w-full justify-start rounded-md border px-2 py-1.5 text-left text-xs transition"
                :class="[
                  activeModuleId === module.id ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                  getQuickNavStatusClass(foundationStore.moduleStatuses[module.id]),
                ]"
                @click="focusModule(module.id)"
              >
                <span class="min-w-0">
                  <span class="block truncate">{{ module.title }}</span>
                  <span class="text-[11px] opacity-75">{{ getModuleStatusLabel(foundationStore.moduleStatuses[module.id]) }}</span>
                </span>
              </BaseButton>

              <div
                v-if="visibleModuleConfigs.length === 0"
                data-foundation-module-filter-empty
                class="rounded border border-dashed border-white/15 bg-black/20 p-2 text-xs text-slate-500"
              >
                当前筛选下没有可显示模块。可以切换上方筛选条件。
              </div>
            </aside>

            <div class="space-y-3">
              <div
                v-for="module in visibleModuleConfigs"
                :id="moduleAnchorId(module.id)"
                :key="module.id"
                :data-foundation-module-anchor="module.id"
                class="scroll-mt-24"
              >
                <FoundationModulePanel
                  :module-id="module.id"
                  :title="module.title"
                  :description="module.description"
                  :status="foundationStore.moduleStatuses[module.id]"
                  :model-value="moduleValueById(module.id)"
                  :tier="FOUNDATION_MODULE_TIERS[module.id]"
                  :fields="module.fields"
                  :field-count="module.fields.length"
                  :required-progress="getModuleRequiredProgress(module.id)"
                  :ai-busy="aiBusy"
                  :assisting="aiBusy && aiBusyModuleId === module.id"
                  :collapsed="moduleCollapseState[module.id]"
                  :active="activeModuleId === module.id"
                  @patch-field="(path, value) => handleModuleFieldPatch(module.id, path, value)"
                  @run-assist="handleRunModuleAssist(module.id)"
                  @toggle-collapse="toggleModuleCollapse(module.id)"
                  @open-help="openFoundationHelp"
                />
              </div>
            </div>
          </div>
        </section>

        <div class="grid gap-3 2xl:grid-cols-2">
          <section data-foundation-key-characters class="space-y-2 rounded-lg border border-white/10 bg-slate-900/65 p-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">补充角色关系</p>
                <h3 class="mt-1 text-sm font-medium text-white">关键角色与关系变化</h3>
                <p class="mt-1 text-xs text-slate-400">这里补主角之外的重要角色，写清他们在故事里的作用，以及和主角的关系会怎样变化。</p>
              </div>

              <div class="flex items-center gap-2">
                <span class="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[11px] text-slate-300">
                  共 {{ foundationStore.foundation.keyRelations.keyCharacters.length }} 人
                </span>

                <BaseButton
                  type="button"
                  variant="ghost"
                  data-foundation-action="add-key-character"
                  class="rounded-md border border-emerald-400/50 bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-100 transition hover:bg-emerald-500/25"
                  @click="addKeyCharacter"
                >
                  新增角色
                </BaseButton>

                <HelpTriggerButton
                  topic="foundation"
                  title="查看故事基底帮助"
                  data-foundation-help-trigger="key-characters"
                  @trigger="openFoundationHelp"
                />
              </div>
            </div>

            <div v-if="foundationStore.foundation.keyRelations.keyCharacters.length === 0" class="rounded border border-dashed border-white/15 bg-black/20 p-3 text-xs text-slate-500">
              还没有添加关键角色。可以先补 1 到 2 个最重要的人物。
            </div>

            <div class="grid gap-2 md:grid-cols-2">
              <div
                v-for="(character, index) in foundationStore.foundation.keyRelations.keyCharacters"
                :key="character.id"
                :data-foundation-key-character-item="character.id"
                class="space-y-2 rounded border border-white/10 bg-black/20 p-3"
              >
                <div class="flex items-center justify-between">
                  <p class="text-[11px] text-slate-500">角色 {{ index + 1 }}</p>

                  <BaseButton
                    type="button"
                    variant="danger"
                    data-foundation-action="remove-key-character"
                    :data-foundation-key-character-id="character.id"
                    class="rounded-md border border-rose-400/50 bg-rose-500/15 px-2 py-1 text-[11px] text-rose-100 transition hover:bg-rose-500/25"
                    @click="foundationStore.removeKeyCharacter(character.id)"
                  >
                    删除角色
                  </BaseButton>
                </div>

                <div class="grid gap-2 md:grid-cols-2">
                  <BaseInput
                    :model-value="character.name"
                    label="角色名"
                    :data-foundation-key-character-name="character.id"
                    @update:model-value="value => foundationStore.updateKeyCharacter(character.id, { name: String(value ?? '') })"
                  />

                  <BaseInput
                    :model-value="character.role"
                    label="在故事里的作用"
                    :data-foundation-key-character-role="character.id"
                    @update:model-value="value => foundationStore.updateKeyCharacter(character.id, { role: String(value ?? '') })"
                  />
                </div>

                <BaseTextarea
                  :model-value="character.relationArc"
                  label="关系弧线"
                  :rows="3"
                  :data-foundation-key-character-relation-arc="character.id"
                  @update:model-value="value => foundationStore.updateKeyCharacter(character.id, { relationArc: value })"
                />
              </div>
            </div>
          </section>

          <FoundationExtensionEditor
            v-if="foundationMode === 'advanced'"
            class="h-fit"
            :extensions="foundationStore.foundation.extensions"
            @add-extension="addExtension"
            @update-extension="handleUpdateExtension"
            @remove-extension="foundationStore.removeExtension"
            @open-help="openFoundationHelp"
          />
        </div>
      </section>

      <aside data-foundation-right-rail class="space-y-3 xl:self-start">
        <FoundationProgressBar
          class="h-fit"
          :tier-summary="foundationStore.tierSummary"
          :completed-count="foundationStore.completedCount"
          :total-module-count="foundationStore.totalModuleCount"
          :module-statuses="foundationStore.moduleStatuses"
        />
      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useFoundationControl } from '../../composables/useFoundationControl';
import {
  FOUNDATION_MODULE_KEYS_BY_TIER,
  FOUNDATION_MODULE_TIERS,
  getValueAtPath,
  hasMeaningfulFoundationValue,
} from '../../core/foundation-tier';
import { useFoundationStore } from '../../stores/foundation.store';
import {
  FOUNDATION_MODULE_IDS,
  REQUIRED_FIELDS,
  type FoundationExtensionModule,
  type FoundationModuleId,
  type FoundationModuleStatus,
} from '../../types/foundation';
import type { HelpTopicId } from '../help/help-topics';
import BaseButton from '../base/BaseButton.vue';
import BaseInput from '../base/BaseInput.vue';
import BaseTextarea from '../base/BaseTextarea.vue';
import HelpTriggerButton from '../components/help/HelpTriggerButton.vue';
import FoundationChatStep from './foundation-panel/FoundationChatStep.vue';
import FoundationExtensionEditor from './foundation-panel/FoundationExtensionEditor.vue';
import FoundationModulePanel from './foundation-panel/FoundationModulePanel.vue';
import FoundationProgressBar from './foundation-panel/FoundationProgressBar.vue';

type FoundationFieldSchema = {
  path: string;
  label: string;
  kind: 'text' | 'textarea' | 'list' | 'boolean';
  placeholder?: string;
  hint?: string;
  rows?: number;
  required?: boolean;
  maxItems?: number;
};

type FoundationModuleConfig = {
  id: FoundationModuleId;
  title: string;
  description: string;
  fields: FoundationFieldSchema[];
};

type ModuleStatusFilter = 'all' | FoundationModuleStatus;

type ModuleFilterOption = {
  id: ModuleStatusFilter;
  label: string;
  count: number;
};

type FoundationPanelMode = 'normal' | 'advanced';

type FoundationModeOption = {
  id: FoundationPanelMode;
  label: string;
};

function withRequiredFieldMarkers(moduleConfigs: FoundationModuleConfig[]): FoundationModuleConfig[] {
  return moduleConfigs.map(module => {
    const requiredFields = new Set(REQUIRED_FIELDS[module.id] ?? []);

    return {
      ...module,
      fields: module.fields.map(field => ({
        ...field,
        required: requiredFields.has(field.path),
      })),
    };
  });
}

const FOUNDATION_MODE_OPTIONS: FoundationModeOption[] = [
  { id: 'normal', label: '常用模式' },
  { id: 'advanced', label: '完整模式' },
];

const FOUNDATION_MODULE_CONFIGS: FoundationModuleConfig[] = withRequiredFieldMarkers([
  {
    id: 'positioning',
    title: '作品定位',
    description: '先定清楚这是什么故事，主要写给谁看，读者最想从中得到什么感受。',
    fields: [
      { path: 'title', label: '暂定书名', kind: 'text', placeholder: '先写一个临时名，后面随时可以改' },
      { path: 'genre', label: '题材', kind: 'text', placeholder: '如：古风权谋、都市悬疑、星际冒险' },
      { path: 'mainType', label: '主类型', kind: 'text', placeholder: '如：成长、复仇、探案、争霸' },
      { path: 'subType', label: '副类型', kind: 'text', placeholder: '如：朝堂、群像、轻喜、感情线' },
      {
        path: 'targetExperience',
        label: '读者最想得到的感受',
        kind: 'list',
        maxItems: 3,
        placeholder: '每行一项，如：紧张感\n反转感\n代入感',
        hint: '先写最重要的 1 到 3 项。',
      },
      {
        path: 'length',
        label: '篇幅规划',
        kind: 'text',
        placeholder: '如：30 万字长篇、12 万字中篇',
        hint: '先写大概范围即可。',
      },
      {
        path: 'audience',
        label: '目标读者',
        kind: 'text',
        placeholder: '如：喜欢高压权谋的女性网文读者',
        hint: '写最核心的一类读者即可。',
      },
      {
        path: 'contentIntensity',
        label: '内容尺度',
        kind: 'list',
        maxItems: 3,
        placeholder: '每行一项，如：轻度暴力\n中度情感拉扯',
        hint: '只写会影响阅读预期的内容。',
      },
    ],
  },
  {
    id: 'core',
    title: '故事核心',
    description: '这一块用来抓住故事最重要的东西：主角是谁，想做什么，最难的阻碍是什么。',
    fields: [
      {
        path: 'logline',
        label: '一句话故事',
        kind: 'textarea',
        rows: 3,
        placeholder: '如：失势世子假死潜伏，只为在乱局中夺回兵权并救出家人。',
        hint: '尽量一句话说清主角、目标和阻碍。',
      },
      {
        path: 'coreConflict',
        label: '当前最大冲突',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：他想复位救人，但每走一步都会暴露假死真相。',
      },
      {
        path: 'coreSuspense',
        label: '最想让读者追问的问题',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：主角能否在身份暴露前找到幕后真凶？',
      },
      {
        path: 'coreSellPoint',
        label: '最吸引人的点',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：高压权谋、双重身份、连续反转',
      },
      {
        path: 'themeKeywords',
        label: '主题关键词',
        kind: 'list',
        maxItems: 3,
        placeholder: '每行一项，如：信任\n代价\n自我救赎',
        hint: '先抓 1 到 3 个最核心的词。',
      },
      {
        path: 'emotionalTone',
        label: '整体气质',
        kind: 'text',
        placeholder: '如：冷峻克制、压抑里带一点暖意',
      },
    ],
  },
  {
    id: 'protagonist',
    title: '主角档案',
    description: '先把主角写明白。后面的大纲、人物关系和冲突，都会围着这里展开。',
    fields: [
      { path: 'name', label: '主角姓名', kind: 'text', placeholder: '如：沈砚' },
      { path: 'identity', label: '当前身份', kind: 'text', placeholder: '如：被废世子、边军谋士' },
      {
        path: 'visibleGoal',
        label: '眼前目标',
        kind: 'text',
        placeholder: '如：三个月内夺回兵权',
        hint: '写主角现在最想做到的事。',
      },
      {
        path: 'deepNeed',
        label: '真正需要',
        kind: 'text',
        placeholder: '如：重新学会信任别人',
        hint: '这通常比眼前目标更深一层。',
      },
      { path: 'coreDesire', label: '最深的渴望', kind: 'text', placeholder: '如：掌控自己的命运' },
      { path: 'coreFear', label: '最怕失去什么', kind: 'text', placeholder: '如：再次失去亲人' },
      {
        path: 'coreFlaw',
        label: '核心缺点',
        kind: 'text',
        placeholder: '如：过度控制、无法信任他人',
        hint: '写最容易把事情搞砸的地方。',
      },
      { path: 'behaviorStyle', label: '做事方式', kind: 'text', placeholder: '如：冷静谨慎、先算后动' },
      { path: 'moralLeaning', label: '做事底色', kind: 'text', placeholder: '如：守底线，但会用灰色手段' },
      { path: 'mostCaredAbout', label: '最在意什么', kind: 'text', placeholder: '如：妹妹的安全' },
      { path: 'bottomLine', label: '绝不退让的底线', kind: 'text', placeholder: '如：绝不伤及无辜' },
      { path: 'temptation', label: '最容易动摇的诱惑', kind: 'text', placeholder: '如：只要交出同伴就能复位' },
      {
        path: 'arcDirection',
        label: '变化方向',
        kind: 'text',
        placeholder: '如：从封闭自保到愿意为他人冒险',
        hint: '写故事前后最大的变化。',
      },
    ],
  },
  {
    id: 'keyRelations',
    title: '关键关系',
    description: '先写最关键的对手或对位人物。只要和主角的目标正面冲突，这一块就成立。',
    fields: [
      { path: 'antagonist.name', label: '主要对手', kind: 'text', placeholder: '如：裴相' },
      { path: 'antagonist.goal', label: '对手想得到什么', kind: 'text', placeholder: '如：借战乱彻底掌控朝局' },
      {
        path: 'antagonist.conflict',
        label: '他和主角正面冲突在哪里',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：两人都想掌控边军，但立场和手段完全不同。',
      },
    ],
  },
  {
    id: 'conflictFramework',
    title: '冲突结构',
    description: '把故事为什么会越来越难写清楚：阻碍从哪里来，失败会失去什么，事情怎样一步步升级。',
    fields: [
      { path: 'mainConflict', label: '表面冲突', kind: 'textarea', rows: 2, placeholder: '现在最明显的对抗是什么' },
      {
        path: 'innerConflict',
        label: '主角心里的拉扯',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：要不要为了复位牺牲旧日情义',
      },
      {
        path: 'relationConflict',
        label: '关系冲突',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：盟友希望求稳，主角却必须冒险',
      },
      {
        path: 'externalObstacle',
        label: '外部阻碍',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：追兵、权力结构、资源短缺',
      },
      {
        path: 'failureCost',
        label: '失败代价',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：失去唯一的亲人、兵权彻底旁落',
        hint: '写失败以后最痛的后果。',
      },
      { path: 'timePressure', label: '时间压力', kind: 'text', placeholder: '如：三个月内必须夺回兵权' },
      {
        path: 'irreversibleEvents',
        label: '一旦发生就回不了头的事',
        kind: 'list',
        placeholder: '每行一项，如：身份暴露\n盟友倒戈',
      },
      {
        path: 'escalationPattern',
        label: '冲突怎么升级',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：每解决一个小问题，就会暴露一个更大的问题',
      },
    ],
  },
  {
    id: 'narrativeRules',
    title: '叙事规则',
    description: '这一块不是起步必填，但写了以后，后面的生成会更稳，更像你想要的写法。',
    fields: [
      { path: 'pov', label: '叙事视角', kind: 'text', placeholder: '如：限制性第三人称、第一人称' },
      { path: 'tenseAndStyle', label: '时态和文风', kind: 'text', placeholder: '如：过去时，克制冷峻' },
      { path: 'languageQuality', label: '语言感觉', kind: 'text', placeholder: '如：简洁、锋利、少解释' },
      {
        path: 'infoDisclosure',
        label: '信息怎么放给读者',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：前期只给碎片线索，中期集中揭露',
      },
      { path: 'allowExposition', label: '允许直白说明', kind: 'boolean' },
      { path: 'plotDriver', label: '剧情主要靠什么推动', kind: 'text', placeholder: '如：选择后果、权力博弈' },
      { path: 'romanceWeight', label: '感情线比重', kind: 'text', placeholder: '如：弱、中、强' },
      { path: 'ensembleWeight', label: '群像比重', kind: 'text', placeholder: '如：主角为主，群像辅助' },
      {
        path: 'emphasisTags',
        label: '特别想强调的感觉',
        kind: 'list',
        placeholder: '每行一项，如：压迫感\n克制\n反转',
      },
      {
        path: 'forbiddenPatterns',
        label: '明确不要出现的写法',
        kind: 'list',
        placeholder: '每行一项，如：强行误会\n突然失忆',
      },
    ],
  },
  {
    id: 'worldBrief',
    title: '世界需求',
    description: '只写故事真正要用到的规则、地点和设定。不必现在就写完整世界观。',
    fields: [
      { path: 'worldType', label: '世界类型', kind: 'text', placeholder: '如：架空王朝、近未来都市、星际殖民地' },
      {
        path: 'requiredRules',
        label: '必须成立的规则',
        kind: 'list',
        placeholder: '每行一项，如：兵权只能由皇命调动',
        hint: '只写会直接影响剧情的规则。',
      },
      {
        path: 'keyScenes',
        label: '关键地点',
        kind: 'list',
        placeholder: '每行一项，如：边城军营\n地下情报站',
      },
      {
        path: 'settingPivots',
        label: '关键设定',
        kind: 'list',
        placeholder: '每行一项，如：门阀结构\n军权归属',
      },
      {
        path: 'conflictGeneratingRules',
        label: '容易引发冲突的规则',
        kind: 'list',
        placeholder: '每行一项，如：军令层层掣肘',
      },
      {
        path: 'forbiddenSettings',
        label: '明确不要的设定',
        kind: 'list',
        placeholder: '每行一项，如：随意复活\n万能系统',
      },
    ],
  },
  {
    id: 'endgame',
    title: '终局方向',
    description: '先定一个收束方向，让后面的大纲不容易跑偏。',
    fields: [
      {
        path: 'overallDirection',
        label: '最后会走到哪里',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：主角夺回兵权，但必须付出关系破裂的代价',
      },
      { path: 'endingType', label: '结局类型', kind: 'text', placeholder: '如：苦尽甘来、带代价的胜利、开放式' },
      { path: 'protagonistChanges', label: '主角会有实质变化', kind: 'boolean' },
      {
        path: 'rootProblem',
        label: '最后必须面对的问题',
        kind: 'textarea',
        rows: 2,
        placeholder: '如：他始终回避的家庭创伤',
        hint: '写到结尾时必须正面解决的根问题。',
      },
      {
        path: 'readerFeeling',
        label: '读完后的感受',
        kind: 'text',
        placeholder: '如：释然、怅然若失、热血',
      },
      {
        path: 'mustResolve',
        label: '结尾前必须解决的事',
        kind: 'list',
        placeholder: '每行一项，如：洗清冤案\n救出家人',
      },
    ],
  },
]);

const emit = defineEmits<{
  'open-help': [topic: HelpTopicId];
}>();

const foundationStore = useFoundationStore();
const {
  messageInput,
  aiBusy,
  aiBusyModuleId,
  lastParseWarning,
  canRetryLastRound,
  canDeleteLastRound,
  runCollaborate,
  runModuleAssist,
  retryLastRound,
  deleteLastRound,
  clearMessages,
} = useFoundationControl();

const createModuleCollapseState = (): Record<FoundationModuleId, boolean> => {
  return FOUNDATION_MODULE_IDS.reduce(
    (acc, moduleId) => {
      acc[moduleId] = false;
      return acc;
    },
    {} as Record<FoundationModuleId, boolean>,
  );
};

const moduleStatusFilter = ref<ModuleStatusFilter>('all');
const activeModuleId = ref<FoundationModuleId | null>(null);
const foundationMode = ref<FoundationPanelMode>('normal');
const moduleCollapseState = ref<Record<FoundationModuleId, boolean>>(createModuleCollapseState());

const foundationModeOptions = FOUNDATION_MODE_OPTIONS;

const foundationModeLabel = computed(() => {
  if (foundationMode.value === 'advanced') {
    return '当前：完整模式';
  }

  return '当前：常用模式';
});

const modeVisibleModuleIds = computed<FoundationModuleId[]>(() => {
  const tierKeys = foundationMode.value === 'advanced'
    ? [
        ...FOUNDATION_MODULE_KEYS_BY_TIER.basic,
        ...FOUNDATION_MODULE_KEYS_BY_TIER.intermediate,
        ...FOUNDATION_MODULE_KEYS_BY_TIER.advanced,
      ]
    : [...FOUNDATION_MODULE_KEYS_BY_TIER.basic, ...FOUNDATION_MODULE_KEYS_BY_TIER.intermediate];

  return tierKeys.filter((moduleId): moduleId is FoundationModuleId => moduleId !== 'extensions');
});

const modeVisibleModuleIdSet = computed(() => new Set(modeVisibleModuleIds.value));

const modeAccessibleModuleConfigs = computed(() => {
  return FOUNDATION_MODULE_CONFIGS.filter(module => modeVisibleModuleIdSet.value.has(module.id));
});

const shouldShowAdvancedContentHint = computed(() => {
  return foundationMode.value === 'normal' && foundationStore.hasAdvancedContent;
});

const moduleAssistOptions = computed(() => {
  return modeAccessibleModuleConfigs.value.map(module => ({
    id: module.id,
    label: module.title,
  }));
});

const setFoundationMode = (mode: FoundationPanelMode) => {
  foundationMode.value = mode;
};

const moduleStatusCounts = computed(() => {
  return modeVisibleModuleIds.value.reduce(
    (acc, moduleId) => {
      const status = foundationStore.moduleStatuses[moduleId];
      acc[status] += 1;
      return acc;
    },
    {
      empty: 0,
      partial: 0,
      complete: 0,
    } as Record<FoundationModuleStatus, number>,
  );
});

const moduleFilterOptions = computed<ModuleFilterOption[]>(() => {
  return [
    { id: 'all', label: '全部', count: modeVisibleModuleIds.value.length },
    { id: 'empty', label: '未填写', count: moduleStatusCounts.value.empty },
    { id: 'partial', label: '部分完成', count: moduleStatusCounts.value.partial },
    { id: 'complete', label: '已完成', count: moduleStatusCounts.value.complete },
  ];
});

const visibleModuleConfigs = computed(() => {
  return modeAccessibleModuleConfigs.value.filter(module => {
    if (!modeVisibleModuleIdSet.value.has(module.id)) {
      return false;
    }

    if (moduleStatusFilter.value === 'all') {
      return true;
    }

    return foundationStore.moduleStatuses[module.id] === moduleStatusFilter.value;
  });
});

const moduleValueById = (moduleId: FoundationModuleId): Record<string, unknown> => {
  return foundationStore.foundation[moduleId] as unknown as Record<string, unknown>;
};

const moduleAnchorId = (moduleId: FoundationModuleId): string => {
  return `foundation-module-anchor-${moduleId}`;
};

const getModuleStatusLabel = (status: FoundationModuleStatus): string => {
  if (status === 'complete') {
    return '已完成';
  }

  if (status === 'partial') {
    return '部分完成';
  }

  return '未填写';
};

const getQuickNavStatusClass = (status: FoundationModuleStatus): string => {
  if (status === 'complete') {
    return 'border-l-2 border-l-emerald-400/50';
  }

  if (status === 'partial') {
    return 'border-l-2 border-l-amber-400/50';
  }

  return 'border-l-2 border-l-white/15';
};

const setModuleStatusFilter = (filter: ModuleStatusFilter) => {
  moduleStatusFilter.value = filter;
};

const focusModule = (moduleId: FoundationModuleId) => {
  activeModuleId.value = moduleId;
  moduleCollapseState.value[moduleId] = false;

  nextTick(() => {
    const target = document.getElementById(moduleAnchorId(moduleId));
    if (!target || typeof target.scrollIntoView !== 'function') {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
};

const toggleModuleCollapse = (moduleId: FoundationModuleId) => {
  moduleCollapseState.value[moduleId] = !moduleCollapseState.value[moduleId];

  if (!moduleCollapseState.value[moduleId]) {
    activeModuleId.value = moduleId;
  }
};

const expandAllModules = () => {
  for (const moduleId of visibleModuleConfigs.value.map(module => module.id)) {
    moduleCollapseState.value[moduleId] = false;
  }
};

const collapseAllModules = () => {
  for (const moduleId of visibleModuleConfigs.value.map(module => module.id)) {
    moduleCollapseState.value[moduleId] = true;
  }
};

watch(
  visibleModuleConfigs,
  modules => {
    if (modules.length === 0) {
      activeModuleId.value = null;
      return;
    }

    const firstModuleId = modules[0]?.id ?? null;
    if (!firstModuleId) {
      activeModuleId.value = null;
      return;
    }

    if (activeModuleId.value === null) {
      activeModuleId.value = firstModuleId;
      return;
    }

    if (!modules.some(module => module.id === activeModuleId.value)) {
      activeModuleId.value = firstModuleId;
    }
  },
  { immediate: true },
);

const getModuleRequiredProgress = (moduleId: FoundationModuleId): string => {
  const requiredFields = REQUIRED_FIELDS[moduleId] ?? [];
  if (requiredFields.length === 0) {
    return '这一块没有重点项';
  }

  const moduleValue = moduleValueById(moduleId);
  const filledCount = requiredFields.filter(path => hasMeaningfulFoundationValue(getValueAtPath(moduleValue, path))).length;
  return `重点项 ${filledCount}/${requiredFields.length}`;
};

const buildPathPatch = (fieldPath: string, value: unknown): Record<string, unknown> => {
  const segments = fieldPath
    .split('.')
    .map(item => item.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return {};
  }

  const root: Record<string, unknown> = {};
  let cursor: Record<string, unknown> = root;

  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }

    cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  });

  return root;
};

const handleModuleFieldPatch = (moduleId: FoundationModuleId, fieldPath: string, value: unknown) => {
  const patch = buildPathPatch(fieldPath, value);
  foundationStore.patchModule(moduleId, patch as any);
};

const handleRunCollaborate = async () => {
  await runCollaborate();
};

const handleRunModuleAssist = async (moduleId: FoundationModuleId) => {
  await runModuleAssist(moduleId);
};

const handleRetryLastRound = async () => {
  await retryLastRound();
};

const handleDeleteLastRound = () => {
  deleteLastRound();
};

const handleClearParseWarning = () => {
  lastParseWarning.value = null;
};

const addKeyCharacter = () => {
  foundationStore.addKeyCharacter({
    name: '',
    role: '',
    relationArc: '',
  });
};

const addExtension = () => {
  foundationStore.addExtension({
    title: '新扩展模块',
    fields: {},
  });
};

const handleUpdateExtension = (id: string, patch: Partial<FoundationExtensionModule>) => {
  foundationStore.updateExtension(id, patch);
};

const openFoundationHelp = () => {
  emit('open-help', 'foundation');
};
</script>
