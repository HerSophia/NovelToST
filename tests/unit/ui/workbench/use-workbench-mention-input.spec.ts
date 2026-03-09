import { nextTick, ref } from 'vue';
import type { OutlineMentionCandidate, OutlineMentionContext } from '@/novelToST/core/outline-mention.service';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';

vi.mock('@/novelToST/core/outline-mention.service', async () => {
  const actual = await vi.importActual<typeof import('@/novelToST/core/outline-mention.service')>('@/novelToST/core/outline-mention.service');
  return {
    ...actual,
    searchOutlineMentionCandidates: vi.fn(),
  };
});

import { searchOutlineMentionCandidates } from '@/novelToST/core/outline-mention.service';
import { useWorkbenchMentionInput } from '@/novelToST/ui/workbench/composables/useWorkbenchMentionInput';
import { WORKBENCH_MENTION_SOURCE_FILTERS } from '@/novelToST/ui/workbench/shared/mention-source-filter';

async function flushAsyncUpdates(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

function createMentionContext(): OutlineMentionContext {
  const foundationStore = useFoundationStore();
  foundationStore.reset();
  foundationStore.patchModule('positioning', {
    title: '星图设定',
    genre: '科幻',
  });
  foundationStore.patchModule('core', {
    logline: '舰队失控后重建秩序',
    emotionalTone: '紧张',
    coreConflict: '主角与议会对立',
  });
  foundationStore.patchModule('protagonist', {
    name: '黎曜',
  });
  foundationStore.patchModule('worldBrief', {
    requiredRules: ['跃迁需授权'],
  });

  return {
    foundation: JSON.parse(JSON.stringify(foundationStore.foundation)),
    storylines: [],
    masterOutline: [],
    detailsByChapter: {},
  };
}

function createTextarea(value: string): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setSelectionRange(value.length, value.length);
  return textarea;
}

function createEventWithTarget<T extends Event>(target: EventTarget): T {
  return { target } as T;
}

describe('useWorkbenchMentionInput', () => {
  const searchOutlineMentionCandidatesMock = vi.mocked(searchOutlineMentionCandidates);

  const foundationCandidate: OutlineMentionCandidate = {
    kind: 'foundation',
    id: 'foundation:current',
    label: '故事基底',
    description: '故事基底信息',
  };

  const nodeCandidate: OutlineMentionCandidate = {
    kind: 'node',
    id: 'node-1',
    label: '星序节点',
    description: '节点信息',
  };

  const worldbookCandidate: OutlineMentionCandidate = {
    kind: 'worldbook',
    id: '主线词典',
    label: '主线词典',
    description: '世界书信息',
  };

  beforeEach(() => {
    searchOutlineMentionCandidatesMock.mockReset();
  });

  it('should search candidates and cycle source filters with ArrowLeft/ArrowRight', async () => {
    searchOutlineMentionCandidatesMock.mockImplementation(async input => {
      const kinds = input.kinds ?? [];
      if (kinds.length === 0) {
        return [foundationCandidate, nodeCandidate];
      }
      if (kinds.includes('foundation')) {
        return [foundationCandidate];
      }
      if (kinds.includes('worldbook') || kinds.includes('worldbook_entry')) {
        return [worldbookCandidate];
      }
      if (kinds.includes('node')) {
        return [nodeCandidate];
      }
      return [];
    });

    const modelValue = ref('@星');
    const mentionInput = useWorkbenchMentionInput({
      modelValue,
      buildContext: createMentionContext,
      sourceFilters: WORKBENCH_MENTION_SOURCE_FILTERS,
      defaultSourceFilterId: 'all',
    });

    const textarea = createTextarea('@星');
    mentionInput.handleInput(createEventWithTarget<Event>(textarea));
    await flushAsyncUpdates();

    expect(searchOutlineMentionCandidatesMock.mock.calls[0]?.[0]?.query).toBe('星');
    expect(searchOutlineMentionCandidatesMock.mock.calls[0]?.[0]?.limit).toBe(8);
    expect(searchOutlineMentionCandidatesMock.mock.calls[0]?.[0]?.kinds).toBeUndefined();
    expect(mentionInput.showMentionPopup.value).toBe(true);
    expect(mentionInput.mentionCandidates.value.map(candidate => candidate.kind)).toEqual(['foundation', 'node']);

    const arrowRightPreventDefault = vi.fn();
    mentionInput.handleInputKeydown({
      key: 'ArrowRight',
      target: textarea,
      preventDefault: arrowRightPreventDefault,
    } as unknown as KeyboardEvent);

    await flushAsyncUpdates();

    expect(arrowRightPreventDefault).toHaveBeenCalledTimes(1);
    expect(mentionInput.activeSourceFilter.value).toBe('foundation');
    expect(mentionInput.mentionCandidates.value.every(candidate => candidate.kind === 'foundation')).toBe(true);

    mentionInput.handleInputKeydown({
      key: 'ArrowRight',
      target: textarea,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    await flushAsyncUpdates();

    expect(mentionInput.activeSourceFilter.value).toBe('worldbook');
    expect(mentionInput.mentionCandidates.value.every(candidate => candidate.kind === 'worldbook')).toBe(true);

    mentionInput.handleInputKeydown({
      key: 'ArrowLeft',
      target: textarea,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    await flushAsyncUpdates();

    expect(mentionInput.activeSourceFilter.value).toBe('foundation');
  });

  it('should apply active candidate with Enter and remove @query from model', async () => {
    searchOutlineMentionCandidatesMock.mockResolvedValue([foundationCandidate]);

    const modelValue = ref('@主');
    const mentionInput = useWorkbenchMentionInput({
      modelValue,
      buildContext: createMentionContext,
      defaultSourceFilterId: 'all',
    });

    const textarea = createTextarea('@主');
    mentionInput.handleInput(createEventWithTarget<Event>(textarea));
    await flushAsyncUpdates();

    expect(mentionInput.showMentionPopup.value).toBe(true);
    expect(mentionInput.mentionCandidates.value).toHaveLength(1);

    const enterPreventDefault = vi.fn();
    mentionInput.handleInputKeydown({
      key: 'Enter',
      target: textarea,
      preventDefault: enterPreventDefault,
    } as unknown as KeyboardEvent);

    await flushAsyncUpdates();

    expect(enterPreventDefault).toHaveBeenCalledTimes(1);
    expect(mentionInput.showMentionPopup.value).toBe(false);
    expect(mentionInput.selectedMentions.value).toEqual([
      {
        kind: 'foundation',
        id: 'foundation:current',
        label: '故事基底',
      },
    ]);
    expect(modelValue.value).toBe('');

    const payload = mentionInput.buildMentionPayload();
    payload[0]!.label = '已修改';
    expect(mentionInput.selectedMentions.value[0]?.label).toBe('故事基底');
  });

  it('should hide popup during composition and allow Escape to close popup when no candidates', async () => {
    searchOutlineMentionCandidatesMock.mockResolvedValue([]);

    const modelValue = ref('@无');
    const mentionInput = useWorkbenchMentionInput({
      modelValue,
      buildContext: createMentionContext,
      allowEscapeWhenNoCandidates: true,
    });

    const textarea = createTextarea('@无');

    mentionInput.handleInput(createEventWithTarget<Event>(textarea));
    await flushAsyncUpdates();

    expect(mentionInput.showMentionPopup.value).toBe(true);
    expect(mentionInput.mentionCandidates.value).toHaveLength(0);

    mentionInput.handleCompositionStart();
    expect(mentionInput.mentionComposing.value).toBe(true);
    expect(mentionInput.showMentionPopup.value).toBe(false);

    mentionInput.handleCompositionEnd(createEventWithTarget<CompositionEvent>(textarea));
    await flushAsyncUpdates();

    expect(mentionInput.mentionComposing.value).toBe(false);
    expect(mentionInput.showMentionPopup.value).toBe(true);

    const escapePreventDefault = vi.fn();
    mentionInput.handleInputKeydown({
      key: 'Escape',
      target: textarea,
      preventDefault: escapePreventDefault,
    } as unknown as KeyboardEvent);

    expect(escapePreventDefault).toHaveBeenCalledTimes(1);
    expect(mentionInput.showMentionPopup.value).toBe(false);
  });

  it('should keep mention boundary parsing behavior', () => {
    const mentionInput = useWorkbenchMentionInput({
      modelValue: ref(''),
      buildContext: createMentionContext,
    });

    expect(mentionInput.resolveMentionTriggerState('A@主', 3)).toBeNull();

    const state = mentionInput.resolveMentionTriggerState('（@主', 3);
    expect(state).toMatchObject({
      query: '主',
      triggerIndex: 1,
      caretIndex: 3,
    });

    expect(mentionInput.resolveMentionTriggerState('@主 角', 4)).toBeNull();
  });
});
