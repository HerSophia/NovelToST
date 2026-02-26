import { callAPI, callCustomAPI, callSillyTavernAPI } from '@/novelToST/core/worldbook/api.service';
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

describe('worldbook/api.service', () => {
  let originalGenerate: unknown;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalGenerate = (globalThis as { generate?: unknown }).generate;
    originalFetch = (globalThis as { fetch: typeof fetch }).fetch;
  });

  afterEach(() => {
    (globalThis as { generate?: unknown }).generate = originalGenerate;
    (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it('should call silly tavern API through global generate()', async () => {
    const generateMock = vi.fn(async () => ' tavern-reply ');
    (globalThis as { generate?: unknown }).generate = generateMock;

    const result = await callSillyTavernAPI('hello world', {
      timeoutMs: 5000,
      requestId: 'req-01',
    });

    expect(result.provider).toBe('sillytavern');
    expect(result.text).toBe('tavern-reply');
    expect(result.outputTokens).toBeGreaterThan(0);
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: 'req-01',
        user_input: 'hello world',
        should_stream: false,
        should_silence: true,
      }),
    );
  });

  it('should parse openai-compatible custom API response', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'custom-ok' } }] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const result = await callCustomAPI(
      'ping',
      makeWorldbookSettings({
        useTavernApi: false,
        customApiProvider: 'openai-compatible',
        customApiEndpoint: 'http://127.0.0.1:5000/v1',
        customApiModel: 'test-model',
        customApiKey: 'token',
        apiTimeout: 5000,
      }),
    );

    expect(result.provider).toBe('openai-compatible');
    expect(result.text).toBe('custom-ok');
    expect(result.outputTokens).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/chat/completions');
  });

  it('should classify rate limit error from custom API', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('rate limit exceeded', {
        status: 429,
        statusText: 'Too Many Requests',
      }),
    );
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    await expect(
      callCustomAPI(
        'ping',
        makeWorldbookSettings({
          useTavernApi: false,
          customApiProvider: 'openai-compatible',
          customApiEndpoint: 'http://127.0.0.1:5000/v1',
          customApiModel: 'test-model',
          apiTimeout: 5000,
        }),
      ),
    ).rejects.toMatchObject({
      name: 'WorldbookApiError',
      type: 'rate_limit',
    });
  });

  it('should classify JSON parse error when response body is invalid JSON', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('{not-json', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    await expect(
      callAPI(
        'ping',
        makeWorldbookSettings({
          useTavernApi: false,
          customApiProvider: 'openai-compatible',
          customApiEndpoint: 'http://127.0.0.1:5000/v1',
          customApiModel: 'test-model',
          apiTimeout: 5000,
        }),
      ),
    ).rejects.toMatchObject({
      name: 'WorldbookApiError',
      type: 'json_parse',
    });
  });
});
