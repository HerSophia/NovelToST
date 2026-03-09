import { nextTick } from 'vue';
import { OUTLINE_CHAT_VARIABLE_PATH, useOutlinePersistence } from '@/novelToST/composables/useOutlinePersistence';
import { useOutlineStore } from '@/novelToST/stores/outline.store';
import { stMocks } from '../../setup/st-globals.mock';

describe('useOutlinePersistence', () => {
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

  it('should hydrate from chat variables and persist normalized snapshot without legacy setup field', () => {
    stMocks.getVariables.mockReturnValue({
      novelToST: {
        outline: {
          enabled: true,
          storylines: [
            {
              id: 'storyline-1',
              type: 'main',
              title: '主线 A',
              description: '  主线描述  ',
              color: '',
              sortOrder: 0,
              status: 'draft',
              extra: {},
            },
          ],
          setup: {
            title: '  旧标题  ',
          },
        },
      },
    });

    const persistence = useOutlinePersistence();
    const store = useOutlineStore();

    persistence.hydrate();

    expect(store.enabled).toBe(true);
    expect(store.storylines[0]?.title).toBe('主线 A');
    expect(updateVariablesWithMock).toHaveBeenCalledTimes(1);

    const updater = updateVariablesWithMock.mock.calls[0]?.[0] as (variables: Record<string, unknown>) => Record<string, unknown>;
    const merged = updater({});

    expect(_.get(merged, `${OUTLINE_CHAT_VARIABLE_PATH}.enabled`)).toBe(true);
    expect(_.get(merged, `${OUTLINE_CHAT_VARIABLE_PATH}.storylines.0.title`)).toBe('主线 A');
    expect(_.get(merged, `${OUTLINE_CHAT_VARIABLE_PATH}.setup`)).toBeUndefined();
  });

  it('should persist after outline state changes', async () => {
    stMocks.getVariables.mockReturnValue({});

    const persistence = useOutlinePersistence();
    const store = useOutlineStore();
    persistence.hydrate();

    updateVariablesWithMock.mockClear();

    store.setEnabled(true);
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
          outline: {
            enabled: true,
            storylines: [
              {
                id: 'storyline-a',
                type: 'main',
                title: '聊天 A',
                description: '',
                color: '',
                sortOrder: 0,
                status: 'draft',
                extra: {},
              },
            ],
          },
        },
      })
      .mockReturnValueOnce({
        novelToST: {
          outline: {
            enabled: false,
            storylines: [
              {
                id: 'storyline-b',
                type: 'main',
                title: '聊天 B',
                description: '',
                color: '',
                sortOrder: 0,
                status: 'draft',
                extra: {},
              },
            ],
          },
        },
      });

    const persistence = useOutlinePersistence();
    const store = useOutlineStore();

    persistence.hydrate();
    expect(store.enabled).toBe(true);
    expect(store.storylines[0]?.title).toBe('聊天 A');

    expect(hasChatChangedListener).toBe(true);
    chatChangedCallback();

    expect(store.enabled).toBe(false);
    expect(store.storylines[0]?.title).toBe('聊天 B');
  });
});
