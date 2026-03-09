import { nextTick } from 'vue';
import {
  FOUNDATION_CHAT_VARIABLE_PATH,
  useFoundationPersistence,
} from '@/novelToST/composables/useFoundationPersistence';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { stMocks } from '../../setup/st-globals.mock';

describe('useFoundationPersistence', () => {
  const updateVariablesWithMock = vi.fn();

  beforeEach(() => {
    updateVariablesWithMock.mockReset();
    updateVariablesWithMock.mockImplementation((updater: (variables: Record<string, unknown>) => Record<string, unknown>) => {
      return updater({});
    });

    vi.stubGlobal('updateVariablesWith', updateVariablesWithMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should hydrate from chat variables and persist normalized snapshot', () => {
    stMocks.getVariables.mockReturnValue({
      novelToST: {
        foundation: {
          foundation: {
            positioning: {
              genre: '  古风权谋  ',
              mainType: '  权谋  ',
            },
            core: {
              logline: '  一句话故事  ',
            },
          },
          messages: [
            {
              id: 'm-1',
              role: 'assistant',
              text: '  已补全主角档案  ',
              createdAt: '2026-03-01T00:00:00.000Z',
            },
          ],
          updatedAt: '2026-03-01T00:10:00.000Z',
        },
      },
    });

    const persistence = useFoundationPersistence();
    const store = useFoundationStore();

    persistence.hydrate();

    expect(store.foundation.positioning.genre).toBe('古风权谋');
    expect(store.foundation.positioning.mainType).toBe('权谋');
    expect(store.foundation.core.logline).toBe('一句话故事');
    expect(store.messages[0]?.text).toBe('已补全主角档案');

    expect(updateVariablesWithMock).toHaveBeenCalledTimes(1);
    const updater = updateVariablesWithMock.mock.calls[0]?.[0] as (variables: Record<string, unknown>) => Record<string, unknown>;
    const merged = updater({});

    expect(_.get(merged, `${FOUNDATION_CHAT_VARIABLE_PATH}.foundation.positioning.genre`)).toBe('古风权谋');
  });

  it('should migrate legacy outline setup into foundation when foundation snapshot is missing', () => {
    stMocks.getVariables.mockReturnValue({
      novelToST: {
        outline: {
          setup: {
            title: '  旧标题  ',
            genre: '  古风权谋  ',
            premise: '  一句话梗概  ',
            tone: '  冷峻压抑  ',
            coreConflict: '  皇位之争  ',
            characters: ['  林青：落魄世子  ', '  宿敌：权臣之子  '],
            worldRules: ['  皇权森严  '],
            constraints: ['  不可修仙  '],
          },
        },
      },
    });

    const persistence = useFoundationPersistence();
    const store = useFoundationStore();

    persistence.hydrate();

    expect(store.foundation.positioning.title).toBe('旧标题');
    expect(store.foundation.positioning.genre).toBe('古风权谋');
    expect(store.foundation.core.logline).toBe('一句话梗概');
    expect(store.foundation.core.coreConflict).toBe('皇位之争');
    expect(store.foundation.core.emotionalTone).toBe('冷峻压抑');
    expect(store.foundation.protagonist.name).toBe('林青');
    expect(store.foundation.protagonist.identity).toBe('落魄世子');
    expect(store.foundation.keyRelations.keyCharacters[0]?.name).toBe('宿敌');
    expect(store.foundation.worldBrief.requiredRules).toEqual(['皇权森严']);
    expect(store.foundation.worldBrief.forbiddenSettings).toEqual(['不可修仙']);
    expect(store.foundation.narrativeRules.forbiddenPatterns).toEqual(['不可修仙']);

    expect(updateVariablesWithMock).toHaveBeenCalledTimes(1);
    const updater = updateVariablesWithMock.mock.calls[0]?.[0] as (variables: Record<string, unknown>) => Record<string, unknown>;
    const merged = updater({});

    expect(_.get(merged, `${FOUNDATION_CHAT_VARIABLE_PATH}.foundation.positioning.title`)).toBe('旧标题');
    expect(_.get(merged, `${FOUNDATION_CHAT_VARIABLE_PATH}.foundation.protagonist.name`)).toBe('林青');
  });

  it('should not write back when stored foundation snapshot is malformed, even if legacy outline setup exists', () => {
    stMocks.getVariables.mockReturnValue({
      novelToST: {
        foundation: {
          foundation: 123,
          messages: [],
          updatedAt: 456,
        },
        outline: {
          setup: {
            title: '旧标题',
            genre: '古风权谋',
          },
        },
      },
    });

    const persistence = useFoundationPersistence();
    const store = useFoundationStore();

    persistence.hydrate();

    expect(store.foundation.positioning.title).toBe('');
    expect(store.foundation.positioning.genre).toBe('');
    expect(updateVariablesWithMock).not.toHaveBeenCalled();
  });

  it('should persist after foundation state changes', async () => {
    stMocks.getVariables.mockReturnValue({});

    const persistence = useFoundationPersistence();
    const store = useFoundationStore();
    persistence.hydrate();

    updateVariablesWithMock.mockClear();

    store.patchModule('core', {
      logline: '新的一句话故事',
    });
    await nextTick();

    expect(updateVariablesWithMock).toHaveBeenCalledTimes(1);
  });

  it('should re-hydrate when chat changed event is triggered', () => {
    let hasChatChangedListener = false;
    let chatChangedCallback: () => void = () => {
      throw new Error('CHAT_CHANGED 监听回调未注册');
    };

    stMocks.eventOn.mockImplementation((eventName: string, callback: (...args: unknown[]) => void) => {
      if (eventName === stMocks.tavern_events.CHAT_CHANGED) {
        hasChatChangedListener = true;
        chatChangedCallback = callback as () => void;
      }

      return {
        stop: vi.fn(),
      };
    });

    stMocks.getVariables
      .mockReturnValueOnce({
        novelToST: {
          foundation: {
            foundation: {
              positioning: {
                genre: '聊天 A',
                mainType: '类型 A',
              },
            },
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
        },
      })
      .mockReturnValueOnce({
        novelToST: {
          foundation: {
            foundation: {
              positioning: {
                genre: '聊天 A',
                mainType: '类型 A',
              },
            },
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
        },
      })
      .mockReturnValueOnce({
        novelToST: {
          foundation: {
            foundation: {
              positioning: {
                genre: '聊天 B',
                mainType: '类型 B',
              },
            },
            updatedAt: '2026-03-01T00:00:10.000Z',
          },
        },
      })
      .mockReturnValueOnce({
        novelToST: {
          foundation: {
            foundation: {
              positioning: {
                genre: '聊天 B',
                mainType: '类型 B',
              },
            },
            updatedAt: '2026-03-01T00:00:10.000Z',
          },
        },
      });

    const persistence = useFoundationPersistence();
    const store = useFoundationStore();

    persistence.hydrate();
    expect(store.foundation.positioning.genre).toBe('聊天 A');

    expect(hasChatChangedListener).toBe(true);
    chatChangedCallback();

    expect(store.foundation.positioning.genre).toBe('聊天 B');
  });
});
