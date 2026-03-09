import { nextTick } from 'vue';
import {
  WORLDBUILDING_CHAT_VARIABLE_PATH,
  useWorldbuildingPersistence,
} from '@/novelToST/composables/useWorldbuildingPersistence';
import { useWorldbuildingStore } from '@/novelToST/stores/worldbuilding.store';
import { stMocks } from '../../setup/st-globals.mock';

describe('useWorldbuildingPersistence', () => {
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
        worldbuilding: {
          selectedWorldbookName: '  主世界书  ',
          sessions: [
            {
              id: 'session-a',
              type: 'character',
              title: '  主角  ',
              seed: '  边境出身  ',
              versions: [
                {
                  id: 'version-a-1',
                  version: 1,
                  draft: {
                    name: '  林川  ',
                  },
                  lockedFields: [],
                  createdAt: '2026-03-01T00:00:00.000Z',
                },
              ],
              activeVersionId: 'version-a-1',
              updatedAt: '2026-03-01T00:00:00.000Z',
            },
          ],
        },
      },
    });

    const persistence = useWorldbuildingPersistence();
    const store = useWorldbuildingStore();

    persistence.hydrate();

    expect(store.selectedWorldbookName).toBe('主世界书');
    expect(store.sessions[0]?.title).toBe('主角');
    expect(store.sessions[0]?.seed).toBe('边境出身');

    expect(updateVariablesWithMock).toHaveBeenCalledTimes(1);
    const updater = updateVariablesWithMock.mock.calls[0]?.[0] as (variables: Record<string, unknown>) => Record<string, unknown>;
    const merged = updater({});

    expect(_.get(merged, `${WORLDBUILDING_CHAT_VARIABLE_PATH}.selectedWorldbookName`)).toBe('主世界书');
  });

  it('should persist after worldbuilding state changes', async () => {
    stMocks.getVariables.mockReturnValue({});

    const persistence = useWorldbuildingPersistence();
    const store = useWorldbuildingStore();
    persistence.hydrate();

    updateVariablesWithMock.mockClear();

    store.createSession({ type: 'location', title: '王都', seed: '帝国核心城市' });
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
          worldbuilding: {
            sessions: [
              {
                id: 'session-a',
                type: 'character',
                title: '聊天 A',
                versions: [
                  {
                    id: 'version-a',
                    version: 1,
                    draft: {},
                    lockedFields: [],
                    createdAt: '2026-03-01T00:00:00.000Z',
                  },
                ],
                activeVersionId: 'version-a',
                updatedAt: '2026-03-01T00:00:00.000Z',
              },
            ],
          },
        },
      })
      .mockReturnValueOnce({
        novelToST: {
          worldbuilding: {
            sessions: [
              {
                id: 'session-b',
                type: 'character',
                title: '聊天 B',
                versions: [
                  {
                    id: 'version-b',
                    version: 1,
                    draft: {},
                    lockedFields: [],
                    createdAt: '2026-03-01T00:00:00.000Z',
                  },
                ],
                activeVersionId: 'version-b',
                updatedAt: '2026-03-01T00:00:00.000Z',
              },
            ],
          },
        },
      });

    const persistence = useWorldbuildingPersistence();
    const store = useWorldbuildingStore();

    persistence.hydrate();
    expect(store.activeSession?.title).toBe('聊天 A');

    expect(hasChatChangedListener).toBe(true);
    chatChangedCallback();

    expect(store.activeSession?.title).toBe('聊天 B');
  });
});
