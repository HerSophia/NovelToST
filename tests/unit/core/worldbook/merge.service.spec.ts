import {
  consolidateWorldbookCategories,
  findChangedEntries,
  mergeEntriesWithAI,
  mergeWorldbookAliases,
  mergeWorldbookDataIncremental,
  mergeWorldbookDataWithHistory,
  performWorldbookMerge,
} from '@/novelToST/core/worldbook/merge.service';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import type { NovelWorldbookSettings } from '@/novelToST/types';

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

describe('worldbook/merge.service', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = (globalThis as { fetch: typeof fetch }).fetch;
  });

  afterEach(() => {
    (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it('should merge duplicate entries incrementally', () => {
    const merged = mergeWorldbookDataIncremental(
      {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '旧内容',
          },
        },
      },
      {
        角色: {
          林舟: {
            关键词: ['主角', '林舟'],
            内容: '新增内容',
          },
        },
      },
    );

    expect(merged.角色?.林舟?.['关键词']).toEqual(['林舟', '主角']);
    expect(String(merged.角色?.林舟?.['内容'])).toContain('旧内容');
    expect(String(merged.角色?.林舟?.['内容'])).toContain('新增内容');
  });

  it('should find changed entries between two worldbook snapshots', () => {
    const changes = findChangedEntries(
      {
        角色: {
          林舟: { 内容: '旧值' },
          苏晚: { 内容: '待删除' },
        },
      },
      {
        角色: {
          林舟: { 内容: '新值' },
          叶璃: { 内容: '新增' },
        },
      },
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'modify', category: '角色', entryName: '林舟' }),
        expect.objectContaining({ type: 'add', category: '角色', entryName: '叶璃' }),
        expect.objectContaining({ type: 'delete', category: '角色', entryName: '苏晚' }),
      ]),
    );
  });

  it('should save history while merging worldbook', async () => {
    const saveHistory = vi.fn(async () => 1);

    const result = await mergeWorldbookDataWithHistory({
      target: {
        角色: {
          林舟: { 内容: '旧值' },
        },
      },
      source: {
        角色: {
          林舟: { 内容: '新值' },
        },
      },
      memoryIndex: 1,
      memoryTitle: '第2章',
      historyService: {
        saveHistory,
      },
    });

    expect(result.changedEntries).toHaveLength(1);
    expect(saveHistory).toHaveBeenCalledTimes(1);
    expect(saveHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryTitle: '第2章',
      }),
    );
  });

  it('should support rename mode when merging duplicated entries', async () => {
    const result = await performWorldbookMerge({
      existingWorldbook: {
        角色: {
          林舟: { 关键词: ['林舟'], 内容: '旧设定' },
        },
      },
      importedWorldbook: {
        角色: {
          林舟: { 关键词: ['主角'], 内容: '新设定' },
        },
      },
      mode: 'rename',
    });

    expect(result.duplicates).toHaveLength(1);
    expect(result.processedDuplicates).toBe(1);
    expect(result.worldbook.角色?.林舟?.['内容']).toBe('旧设定');
    expect(result.worldbook.角色?.林舟_2?.['内容']).toBe('新设定');
  });

  it('should merge duplicated entries with ai mode', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"关键词":["林舟","主角"],"内容":"整合后的内容"}',
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

    const mergedEntryResult = await mergeEntriesWithAI({
      entryA: { 关键词: ['林舟'], 内容: '旧设定' },
      entryB: { 关键词: ['主角'], 内容: '新设定' },
      settings,
    });
    expect(mergedEntryResult.entry['内容']).toBe('整合后的内容');

    const result = await performWorldbookMerge({
      existingWorldbook: {
        角色: {
          林舟: { 关键词: ['林舟'], 内容: '旧设定' },
        },
      },
      importedWorldbook: {
        角色: {
          林舟: { 关键词: ['主角'], 内容: '新设定' },
        },
      },
      mode: 'ai',
      settings,
      concurrency: 2,
    });

    expect(result.processedDuplicates).toBe(1);
    expect(result.failedDuplicates).toHaveLength(0);
    expect(result.worldbook.角色?.林舟?.['内容']).toBe('整合后的内容');
  });

  it('should merge alias entries into canonical entry and remove alias entry by default', () => {
    const merged = mergeWorldbookAliases({
      worldbook: {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '主角设定',
          },
          阿舟: {
            关键词: ['阿舟'],
            内容: '外号补充',
          },
        },
      },
      groups: [
        {
          category: '角色',
          canonicalName: '林舟',
          aliases: ['阿舟'],
        },
      ],
    });

    expect(merged.mergedCount).toBe(1);
    expect(merged.missingCount).toBe(0);
    expect(merged.worldbook.角色?.阿舟).toBeUndefined();
    expect(merged.worldbook.角色?.林舟?.['关键词']).toEqual(expect.arrayContaining(['林舟', '阿舟']));
    expect(String(merged.worldbook.角色?.林舟?.['内容'])).toContain('外号补充');
  });

  it('should consolidate categories with rename mode when duplicate names exist', () => {
    const consolidated = consolidateWorldbookCategories({
      worldbook: {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '角色分类中的林舟',
          },
        },
        人物: {
          林舟: {
            关键词: ['林舟', '主角'],
            内容: '人物分类中的林舟',
          },
          苏晚: {
            关键词: ['苏晚'],
            内容: '配角',
          },
        },
      },
      rules: [
        {
          sourceCategory: '人物',
          targetCategory: '角色',
        },
      ],
      mode: 'rename',
    });

    expect(consolidated.movedCount).toBe(2);
    expect(consolidated.conflictCount).toBe(1);
    expect(consolidated.worldbook.人物).toBeUndefined();
    expect(consolidated.worldbook.角色?.林舟?.['内容']).toBe('角色分类中的林舟');
    expect(consolidated.worldbook.角色?.林舟_2?.['内容']).toBe('人物分类中的林舟');
    expect(consolidated.worldbook.角色?.苏晚?.['内容']).toBe('配角');
  });
});
