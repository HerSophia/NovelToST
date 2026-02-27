import {
  callAPI,
  callCustomAPI,
  callSillyTavernAPI,
  fetchCustomApiModels,
  quickTestWorldbookApi,
} from '@/novelToST/core/worldbook/api.service';
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

function createFetchMock(responseFactory: () => Response | Promise<Response>) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    return responseFactory();
  });
}

function getFirstFetchCall(fetchMock: ReturnType<typeof createFetchMock>): [RequestInfo | URL, RequestInit?] {
  return fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit?];
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
    const fetchMock = createFetchMock(() =>
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
    const [requestUrl] = getFirstFetchCall(fetchMock);
    expect(String(requestUrl)).toContain('/chat/completions');
  });

  it('should fetch model list from openai-compatible endpoint', async () => {
    const fetchMock = createFetchMock(() =>
      new Response(JSON.stringify({ data: [{ id: 'qwen-max' }, { id: 'deepseek-chat' }] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchCustomApiModels(
      makeWorldbookSettings({
        useTavernApi: false,
        customApiProvider: 'openai-compatible',
        customApiEndpoint: 'http://127.0.0.1:5000/v1',
        customApiKey: 'token',
      }),
    );

    expect(result.provider).toBe('openai-compatible');
    expect(result.models).toEqual(['qwen-max', 'deepseek-chat']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = getFirstFetchCall(fetchMock);
    expect(String(requestUrl)).toContain('/v1/models');
    expect(requestInit).toMatchObject({ method: 'GET' });
  });

  it('should normalize gemini model names when fetching model list', async () => {
    const fetchMock = createFetchMock(() =>
      new Response(JSON.stringify({
        models: [
          { name: 'models/gemini-2.5-flash' },
          { name: 'models/gemini-2.5-pro' },
        ],
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchCustomApiModels(
      makeWorldbookSettings({
        useTavernApi: false,
        customApiProvider: 'gemini',
        customApiKey: 'gemini-token',
      }),
    );

    expect(result.provider).toBe('gemini');
    expect(result.models).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);
    const [requestUrl] = getFirstFetchCall(fetchMock);
    expect(String(requestUrl)).toContain('v1beta/models?key=gemini-token');
  });

  it('should run quick API test and return elapsed time', async () => {
    const fetchMock = createFetchMock(() =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const result = await quickTestWorldbookApi(makeWorldbookSettings({
      useTavernApi: false,
      customApiProvider: 'openai-compatible',
      customApiEndpoint: 'http://127.0.0.1:5000/v1',
      customApiModel: 'test-model',
      apiTimeout: 5000,
    }));

    expect(result.provider).toBe('openai-compatible');
    expect(result.responseText).toBe('OK');
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('should classify rate limit error from custom API', async () => {
    const fetchMock = createFetchMock(() =>
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
    const fetchMock = createFetchMock(() =>
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
