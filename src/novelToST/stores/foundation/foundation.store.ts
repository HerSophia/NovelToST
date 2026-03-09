import { klona } from 'klona';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  FoundationConflictFramework,
  FoundationCore,
  FoundationEndgame,
  FoundationExtensionModule,
  FoundationKeyCharacter,
  FoundationKeyRelations,
  FoundationMessage,
  FoundationModuleId,
  FoundationNarrativeRules,
  FoundationPersistedState,
  FoundationPositioning,
  FoundationProtagonist,
  FoundationWorldBrief,
  StoryFoundation,
} from '../../types/foundation';
import { FOUNDATION_MODULE_IDS } from '../../types/foundation';
import {
  computeFoundationGenerationReadiness,
  getFoundationTierSummary,
  hasAdvancedFoundationContent,
} from '../../core/foundation-tier';
import {
  computeModuleStatuses,
  createEmptyFoundationPersistedState,
  normalizeFoundationConflictFramework,
  normalizeFoundationCore,
  normalizeFoundationEndgame,
  normalizeFoundationExtensionModule,
  normalizeFoundationKeyCharacter,
  normalizeFoundationKeyRelations,
  normalizeFoundationMessage,
  normalizeFoundationNarrativeRules,
  normalizeFoundationPersistedState,
  normalizeFoundationPositioning,
  normalizeFoundationProtagonist,
  normalizeFoundationWorldBrief,
} from './foundation.normalize';

let foundationMessageCounter = 0;
let foundationKeyCharacterCounter = 0;
let foundationExtensionCounter = 0;

function nextTimestamp(): string {
  return new Date().toISOString();
}

function nextTimestampAfter(previous: string | null | undefined): string {
  const previousMs = typeof previous === 'string' ? Date.parse(previous) : Number.NaN;
  const nowMs = Date.now();
  const nextMs = Number.isFinite(previousMs) && nowMs <= previousMs ? previousMs + 1 : nowMs;

  return new Date(nextMs).toISOString();
}

function createFoundationMessageId(): string {
  foundationMessageCounter += 1;
  return `foundation-message-${Date.now()}-${foundationMessageCounter}`;
}

function createFoundationKeyCharacterId(): string {
  foundationKeyCharacterCounter += 1;
  return `foundation-keychar-${Date.now()}-${foundationKeyCharacterCounter}`;
}

function createFoundationExtensionId(): string {
  foundationExtensionCounter += 1;
  return `foundation-ext-${Date.now()}-${foundationExtensionCounter}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type DeepPartial<T> = T extends readonly (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? {
        [K in keyof T]?: DeepPartial<T[K]>;
      }
    : T;

export const useFoundationStore = defineStore('novelToST/foundation', () => {
  const defaultState = createEmptyFoundationPersistedState();

  const foundation = ref<StoryFoundation>(defaultState.foundation);
  const messages = ref<FoundationMessage[]>(defaultState.messages);
  const updatedAt = ref(defaultState.updatedAt);

  const moduleStatuses = computed(() => computeModuleStatuses(foundation.value));
  const completedCount = computed(
    () => FOUNDATION_MODULE_IDS.filter(moduleId => moduleStatuses.value[moduleId] === 'complete').length,
  );
  const generationReadiness = computed(() => computeFoundationGenerationReadiness(foundation.value));
  const tierSummary = computed(() => getFoundationTierSummary(foundation.value));
  const hasAdvancedContent = computed(() => hasAdvancedFoundationContent(foundation.value));
  const totalModuleCount = FOUNDATION_MODULE_IDS.length;

  const touchUpdatedAt = (): void => {
    updatedAt.value = nextTimestampAfter(updatedAt.value);
  };

  const toStateSnapshot = (): FoundationPersistedState => {
    return klona({
      foundation: foundation.value,
      messages: messages.value,
      updatedAt: updatedAt.value,
    });
  };

  const snapshot = (): FoundationPersistedState => {
    return toStateSnapshot();
  };

  const hydrate = (rawState: unknown): void => {
    const normalizedState = normalizeFoundationPersistedState(rawState);

    foundation.value = normalizedState.foundation;
    messages.value = normalizedState.messages;
    updatedAt.value = normalizedState.updatedAt;
  };

  const reset = (): void => {
    const nextState = createEmptyFoundationPersistedState();

    foundation.value = nextState.foundation;
    messages.value = nextState.messages;
    updatedAt.value = nextState.updatedAt;
  };

  const patchModule = <M extends FoundationModuleId>(moduleId: M, patch: DeepPartial<StoryFoundation[M]>): void => {
    if (!isRecord(patch)) {
      return;
    }

    switch (moduleId) {
      case 'positioning': {
        foundation.value = {
          ...foundation.value,
          positioning: normalizeFoundationPositioning({
            ...foundation.value.positioning,
            ...(patch as Partial<FoundationPositioning>),
          }),
        };
        break;
      }
      case 'core': {
        foundation.value = {
          ...foundation.value,
          core: normalizeFoundationCore({
            ...foundation.value.core,
            ...(patch as Partial<FoundationCore>),
          }),
        };
        break;
      }
      case 'protagonist': {
        foundation.value = {
          ...foundation.value,
          protagonist: normalizeFoundationProtagonist({
            ...foundation.value.protagonist,
            ...(patch as Partial<FoundationProtagonist>),
          }),
        };
        break;
      }
      case 'keyRelations': {
        const keyRelationsPatch = patch as Partial<FoundationKeyRelations>;
        foundation.value = {
          ...foundation.value,
          keyRelations: normalizeFoundationKeyRelations({
            ...foundation.value.keyRelations,
            ...keyRelationsPatch,
            antagonist: {
              ...foundation.value.keyRelations.antagonist,
              ...(isRecord(keyRelationsPatch.antagonist) ? keyRelationsPatch.antagonist : {}),
            },
            keyCharacters: keyRelationsPatch.keyCharacters ?? foundation.value.keyRelations.keyCharacters,
          }),
        };
        break;
      }
      case 'conflictFramework': {
        foundation.value = {
          ...foundation.value,
          conflictFramework: normalizeFoundationConflictFramework({
            ...foundation.value.conflictFramework,
            ...(patch as Partial<FoundationConflictFramework>),
          }),
        };
        break;
      }
      case 'narrativeRules': {
        foundation.value = {
          ...foundation.value,
          narrativeRules: normalizeFoundationNarrativeRules({
            ...foundation.value.narrativeRules,
            ...(patch as Partial<FoundationNarrativeRules>),
          }),
        };
        break;
      }
      case 'worldBrief': {
        foundation.value = {
          ...foundation.value,
          worldBrief: normalizeFoundationWorldBrief({
            ...foundation.value.worldBrief,
            ...(patch as Partial<FoundationWorldBrief>),
          }),
        };
        break;
      }
      case 'endgame': {
        foundation.value = {
          ...foundation.value,
          endgame: normalizeFoundationEndgame({
            ...foundation.value.endgame,
            ...(patch as Partial<FoundationEndgame>),
          }),
        };
        break;
      }
    }

    touchUpdatedAt();
  };

  const applyFoundationPatch = (patch: DeepPartial<StoryFoundation>): void => {
    FOUNDATION_MODULE_IDS.forEach(moduleId => {
      switch (moduleId) {
        case 'positioning':
          if (isRecord(patch.positioning)) {
            patchModule('positioning', patch.positioning);
          }
          break;
        case 'core':
          if (isRecord(patch.core)) {
            patchModule('core', patch.core);
          }
          break;
        case 'protagonist':
          if (isRecord(patch.protagonist)) {
            patchModule('protagonist', patch.protagonist);
          }
          break;
        case 'keyRelations':
          if (isRecord(patch.keyRelations)) {
            patchModule('keyRelations', patch.keyRelations);
          }
          break;
        case 'conflictFramework':
          if (isRecord(patch.conflictFramework)) {
            patchModule('conflictFramework', patch.conflictFramework);
          }
          break;
        case 'narrativeRules':
          if (isRecord(patch.narrativeRules)) {
            patchModule('narrativeRules', patch.narrativeRules);
          }
          break;
        case 'worldBrief':
          if (isRecord(patch.worldBrief)) {
            patchModule('worldBrief', patch.worldBrief);
          }
          break;
        case 'endgame':
          if (isRecord(patch.endgame)) {
            patchModule('endgame', patch.endgame);
          }
          break;
      }
    });
  };

  const addKeyCharacter = (input: Omit<FoundationKeyCharacter, 'id'>): string => {
    const character = normalizeFoundationKeyCharacter({
      id: createFoundationKeyCharacterId(),
      ...input,
    });

    foundation.value = {
      ...foundation.value,
      keyRelations: normalizeFoundationKeyRelations({
        ...foundation.value.keyRelations,
        keyCharacters: [...foundation.value.keyRelations.keyCharacters, character],
      }),
    };
    touchUpdatedAt();

    return character.id;
  };

  const updateKeyCharacter = (id: string, patch: Partial<FoundationKeyCharacter>): void => {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return;
    }

    let hasUpdated = false;
    const nextCharacters = foundation.value.keyRelations.keyCharacters.map(character => {
      if (character.id !== normalizedId) {
        return character;
      }

      hasUpdated = true;
      return normalizeFoundationKeyCharacter({
        ...character,
        ...patch,
        id: character.id,
      });
    });

    if (!hasUpdated) {
      return;
    }

    foundation.value = {
      ...foundation.value,
      keyRelations: normalizeFoundationKeyRelations({
        ...foundation.value.keyRelations,
        keyCharacters: nextCharacters,
      }),
    };
    touchUpdatedAt();
  };

  const removeKeyCharacter = (id: string): void => {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return;
    }

    const nextCharacters = foundation.value.keyRelations.keyCharacters.filter(character => character.id !== normalizedId);
    if (nextCharacters.length === foundation.value.keyRelations.keyCharacters.length) {
      return;
    }

    foundation.value = {
      ...foundation.value,
      keyRelations: normalizeFoundationKeyRelations({
        ...foundation.value.keyRelations,
        keyCharacters: nextCharacters,
      }),
    };
    touchUpdatedAt();
  };

  const addExtension = (input: Omit<FoundationExtensionModule, 'id'>): string => {
    const extension = normalizeFoundationExtensionModule({
      id: createFoundationExtensionId(),
      ...input,
    });

    foundation.value = {
      ...foundation.value,
      extensions: [...foundation.value.extensions, extension].map(item => normalizeFoundationExtensionModule(item)),
    };
    touchUpdatedAt();

    return extension.id;
  };

  const updateExtension = (id: string, patch: Partial<FoundationExtensionModule>): void => {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return;
    }

    let hasUpdated = false;
    const nextExtensions = foundation.value.extensions.map(extension => {
      if (extension.id !== normalizedId) {
        return extension;
      }

      hasUpdated = true;
      return normalizeFoundationExtensionModule({
        ...extension,
        ...patch,
        id: extension.id,
      });
    });

    if (!hasUpdated) {
      return;
    }

    foundation.value = {
      ...foundation.value,
      extensions: nextExtensions,
    };
    touchUpdatedAt();
  };

  const removeExtension = (id: string): void => {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return;
    }

    const nextExtensions = foundation.value.extensions.filter(extension => extension.id !== normalizedId);
    if (nextExtensions.length === foundation.value.extensions.length) {
      return;
    }

    foundation.value = {
      ...foundation.value,
      extensions: nextExtensions,
    };
    touchUpdatedAt();
  };

  const addMessage = (input: Omit<FoundationMessage, 'id' | 'createdAt'>): FoundationMessage => {
    const message = normalizeFoundationMessage({
      id: createFoundationMessageId(),
      role: input.role,
      text: input.text,
      createdAt: nextTimestamp(),
      parseError: input.parseError,
      rawResponse: input.rawResponse,
    });

    messages.value = [...messages.value, message];
    touchUpdatedAt();

    return message;
  };

  const clearMessages = (): void => {
    if (messages.value.length === 0) {
      return;
    }

    messages.value = [];
    touchUpdatedAt();
  };

  const getLastRoundUserInstruction = (): string | null => {
    const msgs = messages.value;

    let assistantIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        assistantIdx = i;
        break;
      }
    }

    if (assistantIdx < 0) {
      return null;
    }

    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        return msgs[i].text;
      }
    }

    return null;
  };

  const deleteLastRound = (): void => {
    const msgs = messages.value;
    const indicesToRemove = new Set<number>();

    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        indicesToRemove.add(i);
        for (let j = i - 1; j >= 0; j--) {
          if (msgs[j].role === 'user') {
            indicesToRemove.add(j);
            break;
          }
        }
        break;
      }
    }

    if (indicesToRemove.size === 0) {
      return;
    }

    messages.value = msgs.filter((_, idx) => !indicesToRemove.has(idx));
    touchUpdatedAt();
  };

  return {
    foundation,
    messages,
    updatedAt,

    moduleStatuses,
    completedCount,
    generationReadiness,
    tierSummary,
    hasAdvancedContent,
    totalModuleCount,

    touchUpdatedAt,
    hydrate,
    reset,
    toStateSnapshot,
    snapshot,
    patchModule,
    applyFoundationPatch,
    addKeyCharacter,
    updateKeyCharacter,
    removeKeyCharacter,
    addExtension,
    updateExtension,
    removeExtension,
    addMessage,
    clearMessages,
    getLastRoundUserInstruction,
    deleteLastRound,
  };
});
