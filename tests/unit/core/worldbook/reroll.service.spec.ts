import {
  batchRerollEntries,
  buildEntryRerollPrompt,
  getEntryRollHistory,
  getMemoryRollHistory,
  rerollMemoryChunk,
  rerollSingleEntry,
} from '@/novelToST/core/worldbook/reroll.service';
import type { WorldbookEntryRollRecord, WorldbookRollRecord } from '@/novelToST/core/worldbook/history-db.service';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import type { NovelWorldbookSettings } from '@/novelToST/types';
import type { MemoryChunk } from '@/novelToST/types/worldbook';

function makeWorldbookSettings(overrides: Partial<NovelWorldbookSettings> = {}): NovelWorldbookSettings {
  const settingsStore = useNovelSettingsStore();
  settingsStore.patch({
    worldbook: {
      ...overrides,
    },
  });

  return {
    ...settingsStore.settings.worldbook,
  };
}

function createChunk(index: number): MemoryChunk {
  return {
    id: `wb-chunk-${index + 1}`,
    index,
    title: `第${index + 1}章`,
    content: `这是第${index + 1}章的正文。`,
    estimatedTokens: 20,
    source: [
      {
        chapterIndex: index,
        chapterTitle: `第${index + 1}章`,
        startOffset: 0,
        endOffset: 120,
      },
    ],
    processed: false,
    failed: false,
    processing: false,
    retryCount: 0,
    errorMessage: null,
  };
}

describe('worldbook/reroll.service', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = (globalThis as { fetch: typeof fetch }).fetch;
  });

  afterEach(() => {
    (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it('should build entry reroll prompt with required sections', () => {
    const settings = makeWorldbookSettings({
      customRerollPrompt: '请更详细',
      customSuffixPrompt: '最终输出必须合法 JSON',
      forceChapterMarker: true,
    });

    const prompt = buildEntryRerollPrompt({
      chunk: createChunk(1),
      category: '剧情节点',
      entryName: '危机升级',
      settings,
      categoryGuide: '关注关键冲突和转折。',
      previousContext: '上一章已建立冲突。',
      previousTailText: '前文尾段......',
      currentEntry: {
        关键词: ['危机'],
        内容: '旧版本',
      },
    });

    expect(prompt).toContain('强制章节标记');
    expect(prompt).toContain('分类="剧情节点"');
    expect(prompt).toContain('关注关键冲突和转折');
    expect(prompt).toContain('最终输出必须合法 JSON');
    expect(prompt).toContain('条目名称必须包含“第2章”');
  });

  it('should reroll chunk and save roll history', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"角色":{"林舟":{"关键词":["林舟"],"内容":"主角设定"}}}',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const settings = makeWorldbookSettings({
      useTavernApi: false,
      customApiProvider: 'openai-compatible',
      customApiEndpoint: 'http://127.0.0.1:5000/v1',
      customApiModel: 'test-model',
      customApiKey: 'token',
      apiTimeout: 5000,
    });

    const saveRollResult = vi.fn(async () => 1);

    const result = await rerollMemoryChunk({
      chunk: createChunk(0),
      settings,
      buildPrompt: (chunk) => `分析章节: ${chunk.title}`,
      customPrompt: '请重点提取角色',
      historyService: {
        saveRollResult,
      },
    });

    expect(result.prompt).toContain('分析章节: 第1章');
    expect(result.prompt).toContain('请重点提取角色');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      category: '角色',
      name: '林舟',
    });
    expect(saveRollResult).toHaveBeenCalledTimes(1);
  });

  it('should reroll single entry and fallback to requested entry name', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"角色":{"错误名字":{"关键词":["林舟"],"内容":"重Roll后内容"}}}',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const settings = makeWorldbookSettings({
      useTavernApi: false,
      customApiProvider: 'openai-compatible',
      customApiEndpoint: 'http://127.0.0.1:5000/v1',
      customApiModel: 'test-model',
      customApiKey: 'token',
      apiTimeout: 5000,
      customRerollPrompt: '更准确地描述角色信息',
    });

    const saveEntryRollResult = vi.fn(async () => 1);

    const result = await rerollSingleEntry({
      chunk: createChunk(0),
      category: '角色',
      entryName: '林舟',
      settings,
      historyService: {
        saveEntryRollResult,
      },
    });

    expect(result.entry).toMatchObject({
      category: '角色',
      name: '林舟',
      content: '重Roll后内容',
    });
    expect(result.renamedFrom).toBe('错误名字');
    expect(saveEntryRollResult).toHaveBeenCalledTimes(1);
    expect(saveEntryRollResult).toHaveBeenCalledWith(
      '角色',
      '林舟',
      0,
      expect.objectContaining({ name: '林舟' }),
      '更准确地描述角色信息',
    );
  });

  it('should batch reroll entries and collect failed items', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: '{"角色":{"林舟":{"关键词":["林舟"],"内容":"batch-1"}}}',
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockImplementationOnce(async () => {
        throw new Error('network down');
      });

    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const settings = makeWorldbookSettings({
      useTavernApi: false,
      customApiProvider: 'openai-compatible',
      customApiEndpoint: 'http://127.0.0.1:5000/v1',
      customApiModel: 'test-model',
      customApiKey: 'token',
      apiTimeout: 5000,
    });

    const saveEntryRollResult = vi.fn(async () => 1);

    const result = await batchRerollEntries({
      settings,
      concurrency: 2,
      historyService: {
        saveEntryRollResult,
      },
      items: [
        { chunk: createChunk(0), category: '角色', entryName: '林舟' },
        { chunk: createChunk(1), category: '角色', entryName: '苏晚' },
      ],
    });

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.succeeded[0]?.entry.name).toBe('林舟');
    expect(result.failed[0]?.item.entryName).toBe('苏晚');
    expect(saveEntryRollResult).toHaveBeenCalledTimes(1);
  });

  it('should provide history helper wrappers', async () => {
    const memoryHistory: WorldbookRollRecord[] = [
      {
        id: 1,
        memoryIndex: 3,
        result: { id: 1 },
        timestamp: 1,
      },
    ];

    const entryHistory: WorldbookEntryRollRecord[] = [
      {
        id: 2,
        entryKey: '角色:林舟',
        category: '角色',
        entryName: '林舟',
        memoryIndex: 3,
        result: { id: 2 },
        customPrompt: '',
        timestamp: 2,
      },
    ];

    const getRollResults = vi.fn(async () => memoryHistory);
    const getEntryRollResults = vi.fn(async () => entryHistory);

    await expect(getMemoryRollHistory({ getRollResults }, 3)).resolves.toEqual(memoryHistory);
    await expect(getEntryRollHistory({ getEntryRollResults }, '角色', '林舟')).resolves.toEqual(entryHistory);

    expect(getRollResults).toHaveBeenCalledWith(3);
    expect(getEntryRollResults).toHaveBeenCalledWith('角色', '林舟');
  });
});
