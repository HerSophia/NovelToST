import {
  applyDefaultWorldbookEntries,
  buildEntryConfigKey,
  getCategoryAutoIncrement,
  getCategoryBaseOrder,
  parseLegacyDefaultWorldbookEntries,
  resolveEntryConfig,
  setCategoryDefaultConfig,
  setEntryConfig,
} from '@/novelToST/core/worldbook/entry-config.service';

describe('worldbook/entry-config.service', () => {
  it('should resolve config with entry > category > definition > default priority', () => {
    const categoryDefinitions = [
      {
        name: '角色',
        enabled: true,
        isBuiltin: true,
        entryExample: '角色名',
        keywordsExample: ['角色名'],
        contentGuide: '',
        defaultPosition: 2,
        defaultDepth: 6,
        defaultOrder: 80,
        autoIncrementOrder: false,
      },
    ];

    const categoryDefaultConfig = {
      角色: {
        position: 1,
        depth: 5,
        order: 120,
        autoIncrementOrder: true,
      },
    };

    const entryPositionConfig = {
      [buildEntryConfigKey('角色', '林舟')]: {
        depth: 3,
      },
    };

    const resolved = resolveEntryConfig({
      category: '角色',
      entryName: '林舟',
      categoryDefinitions,
      categoryDefaultConfig,
      entryPositionConfig,
    });

    expect(resolved).toEqual({
      position: 1,
      depth: 3,
      order: 120,
      autoIncrementOrder: true,
    });
  });

  it('should read category auto increment and base order', () => {
    const categoryDefinitions = [
      {
        name: '剧情大纲',
        enabled: true,
        isBuiltin: false,
        entryExample: '第1章',
        keywordsExample: ['第1章'],
        contentGuide: '',
        defaultPosition: 0,
        defaultDepth: 4,
        defaultOrder: 100,
        autoIncrementOrder: true,
      },
    ];

    const categoryDefaultConfig = {
      剧情大纲: {
        order: 200,
      },
    };

    expect(getCategoryAutoIncrement('剧情大纲', categoryDefaultConfig, categoryDefinitions)).toBe(true);
    expect(getCategoryBaseOrder('剧情大纲', categoryDefaultConfig, categoryDefinitions)).toBe(200);
  });

  it('should apply default entries from UI and sync entry position config', () => {
    const result = applyDefaultWorldbookEntries({
      settings: {
        defaultWorldbookEntriesUI: [
          {
            category: '角色',
            name: '林舟',
            keywords: ['林舟', '主角'],
            content: '主角设定',
            position: 1,
            depth: 6,
            order: 150,
          },
        ],
        defaultWorldbookEntries: '',
      },
      baseEntries: [
        {
          id: 'base-1',
          category: '地点',
          name: '青州城',
          keywords: ['青州城'],
          content: '主城',
          sourceChunkIds: ['wb-chunk-1'],
        },
      ],
      entryPositionConfig: {},
    });

    expect(result.source).toBe('ui');
    expect(result.appliedCount).toBe(1);
    expect(result.entries).toHaveLength(2);

    const roleEntry = result.entries.find((entry) => entry.category === '角色' && entry.name === '林舟');
    expect(roleEntry).toMatchObject({
      keywords: ['林舟', '主角'],
      content: '主角设定',
      position: 1,
      depth: 6,
      order: 150,
    });

    expect(result.nextEntryPositionConfig[buildEntryConfigKey('角色', '林舟')]).toMatchObject({
      position: 1,
      depth: 6,
      order: 150,
    });
  });

  it('should fallback to legacy default entries json when ui entries are empty', () => {
    const legacy = JSON.stringify({
      角色: {
        林舟: {
          关键词: ['林舟'],
          内容: '主角',
        },
      },
    });

    const parsedLegacy = parseLegacyDefaultWorldbookEntries(legacy);
    expect(parsedLegacy).toHaveLength(1);

    const result = applyDefaultWorldbookEntries({
      settings: {
        defaultWorldbookEntriesUI: [],
        defaultWorldbookEntries: legacy,
      },
    });

    expect(result.source).toBe('legacy');
    expect(result.appliedCount).toBe(1);
    expect(result.entries[0]).toMatchObject({
      category: '角色',
      name: '林舟',
      content: '主角',
    });

    const emptyResult = applyDefaultWorldbookEntries({
      settings: {
        defaultWorldbookEntriesUI: [],
        defaultWorldbookEntries: '{invalid-json',
      },
    });

    expect(emptyResult.source).toBe('none');
    expect(emptyResult.entries).toHaveLength(0);
  });

  it('should update maps through setEntryConfig and setCategoryDefaultConfig', () => {
    const entryMap = setEntryConfig(undefined, '角色', '林舟', {
      position: 2,
      order: 90,
    });
    expect(entryMap[buildEntryConfigKey('角色', '林舟')]).toMatchObject({
      position: 2,
      order: 90,
    });

    const categoryMap = setCategoryDefaultConfig(undefined, '角色', {
      depth: 5,
      autoIncrementOrder: true,
    });
    expect(categoryMap.角色).toMatchObject({
      depth: 5,
      autoIncrementOrder: true,
    });
  });
});
