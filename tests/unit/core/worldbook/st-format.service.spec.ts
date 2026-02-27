import {
  buildStructuredWorldbookFromEntries,
  buildWorldbookImportPreview,
  convertEntriesToSillyTavernFormat,
  convertStructuredWorldbookToEntries,
  parseWorldbookImport,
  performWorldbookImportMerge,
} from '@/novelToST/core/worldbook/st-format.service';
import { useNovelSettingsStore } from '@/novelToST/stores/settings.store';
import type { NovelWorldbookSettings } from '@/novelToST/types';
import type { WorldbookEntry } from '@/novelToST/types/worldbook';
import conflictFixture from './fixtures/import/conflict.fixture';
import missingFieldFixture from './fixtures/import/missing-field.fixture';
import standardFixture from './fixtures/import/standard.fixture';

function createWorldbookSettings(overrides: Partial<NovelWorldbookSettings> = {}): NovelWorldbookSettings {
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

describe('worldbook/st-format.service', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = (globalThis as { fetch: typeof fetch }).fetch;
  });

  afterEach(() => {
    (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it('should export entries to SillyTavern format with position/depth/order parity', () => {
    const settings = createWorldbookSettings({
      allowRecursion: false,
      categoryLightSettings: {
        角色: true,
      },
      categoryDefaultConfig: {
        角色: {
          order: 200,
          autoIncrementOrder: true,
        },
      },
      entryPositionConfig: {
        '角色::林舟': {
          position: 1,
          depth: 6,
        },
      },
    });

    const exported = convertEntriesToSillyTavernFormat({
      settings,
      entries: [
        {
          id: 'entry-1',
          category: '角色',
          name: '林舟',
          keywords: ['林舟', '主角'],
          content: '巡夜人。',
          sourceChunkIds: ['chunk-1'],
        },
        {
          id: 'entry-2',
          category: '角色',
          name: '苏晚',
          keywords: ['苏晚'],
          content: '观察者。',
          sourceChunkIds: ['chunk-1'],
        },
      ],
    });

    expect(exported.entries).toHaveLength(2);
    expect(exported.entries[0]).toMatchObject({
      uid: 0,
      comment: '角色 - 林舟',
      selective: true,
      constant: false,
      excludeRecursion: true,
      preventRecursion: true,
      position: 1,
      depth: 6,
      order: 200,
      key: ['林舟', '主角'],
    });
    expect(exported.entries[1]).toMatchObject({
      comment: '角色 - 苏晚',
      order: 201,
    });
  });

  it('should parse standard fixture and build import preview', () => {
    const parsed = parseWorldbookImport(JSON.stringify(standardFixture));

    const preview = buildWorldbookImportPreview({
      existingWorldbook: {},
      imported: parsed,
    });

    expect(parsed.sourceFormat).toBe('sillytavern');
    expect(preview.totalEntries).toBe(3);
    expect(preview.newEntries).toHaveLength(3);
    expect(preview.allDuplicates).toHaveLength(0);
    expect(parsed.worldbook.角色?.林舟).toBeDefined();
    expect(parsed.worldbook.地点?.云港).toBeDefined();
  });

  it('should parse missing-field fixture with fallback category/name/keywords', () => {
    const parsed = parseWorldbookImport(JSON.stringify(missingFieldFixture));

    expect(parsed.worldbook.组织?.条目_10?.['内容']).toContain('地下结社');
    expect(parsed.worldbook.道具?.霜刃?.['关键词']).toEqual(['霜刃']);
    expect(parsed.worldbook.未分类?.条目_12?.['关键词']).toEqual(['边境议会']);

    const meta = parsed.entryMeta['组织::条目_10'];
    expect(meta).toMatchObject({ position: 2, depth: 5, order: 188 });
  });

  it('should support keep mode for conflict fixture', async () => {
    const parsed = parseWorldbookImport(JSON.stringify(conflictFixture));

    const preview = buildWorldbookImportPreview({
      existingWorldbook: {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '现有设定',
          },
        },
      },
      imported: parsed,
    });

    expect(preview.internalDuplicates).toHaveLength(1);
    expect(preview.duplicatesWithExisting).toHaveLength(1);
    expect(preview.allDuplicates).toHaveLength(2);
    expect(preview.newEntries).toHaveLength(1);

    const result = await performWorldbookImportMerge({
      existingWorldbook: {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '现有设定',
          },
        },
      },
      imported: parsed,
      mode: 'keep',
    });

    expect(result.processedDuplicates).toBe(2);
    expect(result.worldbook.角色?.林舟?.['内容']).toBe('现有设定');
    expect(result.worldbook.地点?.云港?.['内容']).toBe('新增地点设定');
  });

  it('should support replace mode for conflict fixture', async () => {
    const parsed = parseWorldbookImport(JSON.stringify(conflictFixture));

    const result = await performWorldbookImportMerge({
      existingWorldbook: {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '现有设定',
          },
        },
      },
      imported: parsed,
      mode: 'replace',
    });

    expect(result.processedDuplicates).toBe(2);
    expect(result.worldbook.角色?.林舟?.['内容']).toBe('导入冲突-第二版');
  });

  it('should support rename mode for conflict fixture', async () => {
    const parsed = parseWorldbookImport(JSON.stringify(conflictFixture));

    const result = await performWorldbookImportMerge({
      existingWorldbook: {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '现有设定',
          },
        },
      },
      imported: parsed,
      mode: 'rename',
    });

    expect(result.worldbook.角色?.林舟?.['内容']).toBe('现有设定');
    expect(result.worldbook.角色?.林舟_2?.['内容']).toBe('导入冲突-第一版');
    expect(result.worldbook.角色?.林舟_3?.['内容']).toBe('导入冲突-第二版');
  });

  it('should support append mode for conflict fixture', async () => {
    const parsed = parseWorldbookImport(JSON.stringify(conflictFixture));

    const result = await performWorldbookImportMerge({
      existingWorldbook: {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '现有设定',
          },
        },
      },
      imported: parsed,
      mode: 'append',
    });

    const mergedContent = String(result.worldbook.角色?.林舟?.['内容']);
    expect(mergedContent).toContain('现有设定');
    expect(mergedContent).toContain('导入冲突-第一版');
    expect(mergedContent).toContain('导入冲突-第二版');
  });

  it('should support ai mode for conflict fixture', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"关键词":["融合关键词"],"内容":"AI合并内容"}',
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

    const parsed = parseWorldbookImport(JSON.stringify(conflictFixture));
    const settings = createWorldbookSettings({
      useTavernApi: false,
      customApiProvider: 'openai-compatible',
      customApiEndpoint: 'http://127.0.0.1:5000/v1',
      customApiModel: 'test-model',
      customApiKey: 'token',
      apiTimeout: 5000,
    });

    const result = await performWorldbookImportMerge({
      existingWorldbook: {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '现有设定',
          },
        },
      },
      imported: parsed,
      mode: 'ai',
      settings,
      concurrency: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.worldbook.角色?.林舟?.['内容']).toBe('AI合并内容');
  });

  it('should apply alias merge groups after import merge', async () => {
    const parsed = parseWorldbookImport(JSON.stringify({
      角色: {
        阿舟: {
          关键词: ['阿舟'],
          内容: '外号补充',
        },
      },
    }));

    const result = await performWorldbookImportMerge({
      existingWorldbook: {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '主角设定',
          },
        },
      },
      imported: parsed,
      mode: 'keep',
      aliasMerge: {
        groups: [
          {
            category: '角色',
            canonicalName: '林舟',
            aliases: ['阿舟'],
          },
        ],
        mode: 'append',
      },
    });

    expect(result.aliasMerge).toMatchObject({ applied: true, groups: 1, mergedCount: 1, missingCount: 0 });
    expect(result.worldbook.角色?.阿舟).toBeUndefined();
    expect(result.worldbook.角色?.林舟?.['关键词']).toEqual(expect.arrayContaining(['林舟', '阿舟']));
    expect(String(result.worldbook.角色?.林舟?.['内容'])).toContain('外号补充');
  });

  it('should convert merged worldbook back to entries and preserve existing id/meta', async () => {
    const parsed = parseWorldbookImport(JSON.stringify(conflictFixture));

    const merged = await performWorldbookImportMerge({
      existingWorldbook: {
        角色: {
          林舟: {
            关键词: ['林舟'],
            内容: '现有设定',
          },
        },
      },
      imported: parsed,
      mode: 'replace',
    });

    const settings = createWorldbookSettings();
    const existingEntries: WorldbookEntry[] = [
      {
        id: 'entry-existing',
        category: '角色',
        name: '林舟',
        keywords: ['林舟'],
        content: '现有设定',
        sourceChunkIds: ['chunk-1'],
      },
    ];

    const mergedEntries = convertStructuredWorldbookToEntries({
      worldbook: merged.worldbook,
      existingEntries,
      entryMeta: parsed.entryMeta,
      settings,
      idPrefix: 'import-test',
    });

    const existing = mergedEntries.find((entry) => entry.category === '角色' && entry.name === '林舟');
    const importedNew = mergedEntries.find((entry) => entry.category === '地点' && entry.name === '云港');

    expect(existing?.id).toBe('entry-existing');
    expect(existing?.sourceChunkIds).toEqual(['chunk-1']);
    expect(importedNew?.id).toContain('import-test-');
    expect(importedNew?.position).toBe(1);
    expect(importedNew?.depth).toBe(4);
    expect(importedNew?.order).toBe(160);
  });

  it('should build structured worldbook from flat entries', () => {
    const structured = buildStructuredWorldbookFromEntries([
      {
        id: 'entry-1',
        category: '角色',
        name: '林舟',
        keywords: ['林舟'],
        content: '内容1',
        sourceChunkIds: ['chunk-a'],
      },
    ]);

    expect(structured.角色?.林舟?.['关键词']).toEqual(['林舟']);
    expect(structured.角色?.林舟?.['内容']).toBe('内容1');
  });
});
