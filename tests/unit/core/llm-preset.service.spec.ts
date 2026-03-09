import {
  applyLLMPresetToWorldbookSettings,
  captureLLMPresetFromWorldbookSettings,
  ensureUniqueLLMPresetName,
  normalizeLLMPresetName,
  removeLLMPreset,
  upsertLLMPreset,
} from '@/novelToST/core/llm-preset.service';
import type { NovelLLMConfigPreset } from '@/novelToST/types';

describe('llm-preset.service', () => {
  it('should normalize preset names and fallback to default', () => {
    expect(normalizeLLMPresetName('  ')).toBe('未命名配置');
    expect(normalizeLLMPresetName('  自定义配置  ')).toBe('自定义配置');
  });

  it('should ensure unique preset names with numeric suffix', () => {
    const presets: NovelLLMConfigPreset[] = [
      {
        id: 'preset-1',
        name: '主力配置',
        useTavernApi: true,
        apiTimeout: 120000,
        customApiProvider: 'gemini',
        customApiEndpoint: '',
        customApiModel: 'gemini-2.5-flash',
        customApiKey: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'preset-2',
        name: '主力配置 (2)',
        useTavernApi: false,
        apiTimeout: 120000,
        customApiProvider: 'openai',
        customApiEndpoint: 'https://example.com/v1/chat/completions',
        customApiModel: 'gpt-4o-mini',
        customApiKey: 'sk-test',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    expect(ensureUniqueLLMPresetName('主力配置', presets)).toBe('主力配置 (3)');
    expect(ensureUniqueLLMPresetName('主力配置', presets, 'preset-1')).toBe('主力配置');
  });

  it('should capture preset from worldbook settings', () => {
    const preset = captureLLMPresetFromWorldbookSettings(
      {
        useTavernApi: false,
        apiTimeout: 150000,
        customApiProvider: ' openai ',
        customApiEndpoint: ' https://example.com/v1/chat/completions ',
        customApiModel: ' gpt-4.1 ',
        customApiKey: ' sk-abc ',
      },
      {
        id: 'preset-captured',
        name: '  云端 OpenAI  ',
        now: '2026-02-01T00:00:00.000Z',
      },
    );

    expect(preset).toEqual({
      id: 'preset-captured',
      name: '云端 OpenAI',
      useTavernApi: false,
      apiTimeout: 150000,
      customApiProvider: 'openai',
      customApiEndpoint: 'https://example.com/v1/chat/completions',
      customApiModel: 'gpt-4.1',
      customApiKey: 'sk-abc',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
  });

  it('should convert preset into worldbook settings patch payload', () => {
    const patch = applyLLMPresetToWorldbookSettings({
      useTavernApi: false,
      apiTimeout: 800,
      customApiProvider: '  ',
      customApiEndpoint: ' https://proxy.example.com/v1 ',
      customApiModel: ' ',
      customApiKey: '  token ',
    });

    expect(patch).toEqual({
      useTavernApi: false,
      apiTimeout: 1000,
      customApiProvider: 'gemini',
      customApiEndpoint: 'https://proxy.example.com/v1',
      customApiModel: 'gemini-2.5-flash',
      customApiKey: 'token',
    });
  });

  it('should support upsert and remove preset operations', () => {
    const basePreset: NovelLLMConfigPreset = {
      id: 'preset-1',
      name: '初始配置',
      useTavernApi: true,
      apiTimeout: 120000,
      customApiProvider: 'gemini',
      customApiEndpoint: '',
      customApiModel: 'gemini-2.5-flash',
      customApiKey: '',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const appended = upsertLLMPreset([], basePreset);
    expect(appended).toHaveLength(1);

    const updated = upsertLLMPreset(appended, {
      ...basePreset,
      name: '更新后的配置',
      updatedAt: '2026-03-02T00:00:00.000Z',
    });
    expect(updated).toHaveLength(1);
    expect(updated[0]?.name).toBe('更新后的配置');

    const removed = removeLLMPreset(updated, 'preset-1');
    expect(removed).toHaveLength(0);
  });
});
