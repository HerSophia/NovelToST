import {
  DEFAULT_WORLDBOOK_CATEGORIES,
  generateDynamicJsonTemplate,
  getCategoryLightState,
  getEnabledCategories,
  getEnabledCategoryNamesFromSettings,
  normalizeWorldbookCategories,
  setCategoryLightState,
} from '@/novelToST/core/worldbook/category.service';

describe('worldbook/category.service', () => {
  it('should normalize category list and fallback to defaults', () => {
    const fallback = normalizeWorldbookCategories(null);
    expect(fallback.length).toBe(DEFAULT_WORLDBOOK_CATEGORIES.length);

    const normalized = normalizeWorldbookCategories([
      {
        name: '  自定义分类  ',
        enabled: true,
        keywordsExample: '关键词A,关键词B',
      },
      {
        name: '自定义分类',
      },
      {
        invalid: true,
      },
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      name: '自定义分类',
      enabled: true,
    });
    expect(normalized[0]?.keywordsExample).toEqual(['关键词A', '关键词B']);
  });

  it('should return enabled category names with plot/style settings', () => {
    const categories = normalizeWorldbookCategories([
      { name: '角色', enabled: true },
      { name: '地点', enabled: false },
      { name: '组织', enabled: true },
    ]);

    const enabled = getEnabledCategories(categories).map((item) => item.name);
    expect(enabled).toEqual(['角色', '组织']);

    const names = getEnabledCategoryNamesFromSettings(categories, {
      enablePlotOutline: true,
      enableLiteraryStyle: false,
    });

    expect(names).toEqual(['角色', '组织', '剧情大纲']);
  });

  it('should generate dynamic json template for enabled categories only', () => {
    const categories = normalizeWorldbookCategories([
      {
        name: '角色',
        enabled: true,
        entryExample: '角色名',
        keywordsExample: ['角色名'],
        contentGuide: '角色说明',
      },
      {
        name: '道具',
        enabled: false,
      },
    ]);

    const template = generateDynamicJsonTemplate(categories);

    expect(template).toContain('"角色"');
    expect(template).toContain('"角色名"');
    expect(template).toContain('角色说明');
    expect(template).not.toContain('"道具"');
  });

  it('should support category light state read/write', () => {
    const next = setCategoryLightState('角色', true, null);
    expect(next).toEqual({ 角色: true });

    expect(getCategoryLightState('角色', next)).toBe(true);
    expect(getCategoryLightState('地点', next)).toBe(false);
  });
});
