<template>
  <BaseCard title="TXT 转世界书" collapsible :collapsed="collapsed" @update:collapsed="emit('update:collapsed', $event)">
    <template #actions>
      <span
        class="rounded-full px-2 py-0.5 text-[10px] font-medium"
        :class="statusBadgeClass"
      >
        {{ statusLabel }}
      </span>
    </template>

    <div class="grid gap-4">
      <!-- Input Section -->
      <div class="grid gap-3">
        <p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">文本输入</p>

        <!-- File upload -->
        <div
          class="flex items-center gap-3 rounded border border-dashed border-white/15 bg-white/[0.02] p-3"
          @dragover.prevent
          @drop.prevent="handleFileDrop"
        >
          <label class="cursor-pointer rounded bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/20">
            选择 TXT 文件
            <input
              ref="fileInputRef"
              type="file"
              accept=".txt,.text"
              class="hidden"
              @change="handleFileSelect"
            />
          </label>
          <span class="flex-1 truncate text-[11px] text-slate-500">
            {{ ctrl.inputFileName.value || '或拖放文件到此处' }}
          </span>
        </div>

        <!-- Text area -->
        <BaseTextarea
          v-model="ctrl.inputText.value"
          label="文本内容"
          :rows="4"
          placeholder="粘贴小说文本内容，或通过上方上传 TXT 文件..."
        />

        <div v-if="ctrl.inputText.value" class="text-[10px] text-slate-500">
          {{ ctrl.inputText.value.length }} 字符
        </div>
      </div>

      <!-- Control toolbar -->
      <div class="grid grid-cols-5 gap-2">
        <BaseButton variant="success" :disabled="!ctrl.canStart.value" @click="ctrl.start()">
          开始
        </BaseButton>
        <BaseButton variant="warning" :disabled="!ctrl.canPause.value" @click="ctrl.pause()">
          暂停
        </BaseButton>
        <BaseButton variant="primary" :disabled="!ctrl.canResume.value" @click="ctrl.resume()">
          恢复
        </BaseButton>
        <BaseButton variant="danger" :disabled="!ctrl.canStop.value" @click="handleStopRequest">
          停止
        </BaseButton>
        <BaseButton variant="secondary" :disabled="!ctrl.canReset.value" @click="ctrl.reset()">
          重置
        </BaseButton>
      </div>

      <!-- Error display -->
      <div
        v-if="wbStore.errorMessage"
        class="flex items-start gap-2 rounded bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
      >
        <span class="mt-0.5 shrink-0">⚠</span>
        <span class="whitespace-pre-wrap">{{ wbStore.errorMessage }}</span>
      </div>

      <!-- Sub-panels -->
      <MemoryQueuePanel
        v-model:collapsed="subPanelCollapsed.queue"
        @reroll-chunk="openRerollChunkModal"
      />

      <WorldbookResultPanel
        v-model:collapsed="subPanelCollapsed.result"
        @reroll-entry="openRerollEntryModal"
        @remove-entry="ctrl.removeEntry"
        @open-search-replace="showSearchReplaceModal = true"
        @export-entries="handleExportEntries"
      />

      <WorldbookSettingsPanel
        v-model:collapsed="subPanelCollapsed.settings"
        @export-settings="ctrl.doExportSettings()"
        @import-settings="triggerSettingsImport"
      />

      <!-- Action buttons -->
      <div class="flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <BaseButton variant="ghost" @click="showHistoryModal = true">
          查看历史
        </BaseButton>
        <BaseButton variant="ghost" @click="ctrl.doExportTaskState()">
          导出任务
        </BaseButton>
        <BaseButton variant="ghost" @click="triggerTaskImport">
          导入任务
        </BaseButton>
      </div>
    </div>

    <!-- Hidden file inputs -->
    <input
      ref="settingsImportRef"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleSettingsImport"
    />
    <input
      ref="taskImportRef"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleTaskImport"
    />

    <!-- Modals -->
    <HistoryModal
      v-model="showHistoryModal"
      @rollback="ctrl.doRollbackToHistory"
    />

    <RerollModal
      v-model="showRerollModal"
      :mode="rerollMode"
      :target-index="rerollTargetIndex"
      :target-entry-name="rerollTargetEntryName"
      @confirm="handleRerollConfirm"
    />

    <SearchReplaceModal
      v-model="showSearchReplaceModal"
      @replaced="handleSearchReplaced"
    />

    <ConfirmStopModal
      v-model="showStopConfirmModal"
      title="确认停止"
      description="将请求停止世界书处理，当前正在处理的块会在安全点结束。"
      @confirm="ctrl.stop()"
    />
  </BaseCard>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useWorldbookControl } from '../../../composables/useWorldbookControl';
import { useWorldbookStore } from '../../../stores/worldbook.store';
import BaseButton from '../../base/BaseButton.vue';
import BaseCard from '../../base/BaseCard.vue';
import BaseTextarea from '../../base/BaseTextarea.vue';
import ConfirmStopModal from '../ConfirmStopModal.vue';
import HistoryModal from './HistoryModal.vue';
import MemoryQueuePanel from './MemoryQueuePanel.vue';
import RerollModal from './RerollModal.vue';
import SearchReplaceModal from './SearchReplaceModal.vue';
import WorldbookResultPanel from './WorldbookResultPanel.vue';
import WorldbookSettingsPanel from './WorldbookSettingsPanel.vue';
import type { WorldbookEntry } from '../../../types/worldbook';

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  'update:collapsed': [value: boolean];
}>();

const ctrl = useWorldbookControl();
const wbStore = useWorldbookStore();

const fileInputRef = ref<HTMLInputElement | null>(null);
const settingsImportRef = ref<HTMLInputElement | null>(null);
const taskImportRef = ref<HTMLInputElement | null>(null);

const subPanelCollapsed = reactive({
  queue: false,
  result: false,
  settings: true,
});

// Modals
const showHistoryModal = ref(false);
const showRerollModal = ref(false);
const showSearchReplaceModal = ref(false);
const showStopConfirmModal = ref(false);

// Reroll state
const rerollMode = ref<'chunk' | 'entry'>('chunk');
const rerollTargetIndex = ref(0);
const rerollTargetEntryName = ref('');
const pendingRerollEntry = ref<WorldbookEntry | null>(null);

// Status
const statusLabel = computed(() => {
  switch (wbStore.status) {
    case 'preparing': return '准备中';
    case 'running': return '运行中';
    case 'paused': return '已暂停';
    case 'stopping': return '停止中';
    case 'completed': return '已完成';
    case 'error': return '错误';
    default: return '空闲';
  }
});

const statusBadgeClass = computed(() => {
  switch (wbStore.status) {
    case 'running': return 'bg-emerald-500/15 text-emerald-400';
    case 'paused': return 'bg-amber-500/15 text-amber-400';
    case 'stopping': return 'bg-rose-500/15 text-rose-400';
    case 'completed': return 'bg-blue-500/15 text-blue-400';
    case 'error': return 'bg-rose-500/15 text-rose-400';
    default: return 'bg-slate-500/15 text-slate-400';
  }
});

// File handling
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) ctrl.loadInputFile(file);
  input.value = '';
}

function handleFileDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0];
  if (file && (file.name.endsWith('.txt') || file.name.endsWith('.text'))) {
    ctrl.loadInputFile(file);
  }
}

// Stop confirmation
function handleStopRequest() {
  showStopConfirmModal.value = true;
}

// Reroll
function openRerollChunkModal(chunkIndex: number) {
  rerollMode.value = 'chunk';
  rerollTargetIndex.value = chunkIndex;
  rerollTargetEntryName.value = '';
  pendingRerollEntry.value = null;
  showRerollModal.value = true;
}

function openRerollEntryModal(entry: WorldbookEntry) {
  rerollMode.value = 'entry';
  rerollTargetIndex.value = 0;
  rerollTargetEntryName.value = entry.name;
  pendingRerollEntry.value = entry;
  showRerollModal.value = true;
}

function handleRerollConfirm() {
  if (rerollMode.value === 'chunk') {
    ctrl.doRerollChunk(rerollTargetIndex.value);
  } else if (pendingRerollEntry.value) {
    ctrl.doRerollEntry(pendingRerollEntry.value);
  }
}

// Import triggers
function triggerSettingsImport() {
  settingsImportRef.value?.click();
}

function triggerTaskImport() {
  taskImportRef.value?.click();
}

function handleSettingsImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) ctrl.doImportSettings(file);
  input.value = '';
}

function handleTaskImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) ctrl.doImportTaskState(file);
  input.value = '';
}

function handleExportEntries() {
  const entries = wbStore.generatedEntries;
  if (entries.length === 0) {
    toastr.warning('暂无条目可导出');
    return;
  }
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `worldbook-entries-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toastr.success(`已导出 ${entries.length} 条目`);
}

function handleSearchReplaced(count: number) {
  toastr.success(`已替换 ${count} 处匹配`);
}
</script>
