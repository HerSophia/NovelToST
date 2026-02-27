import type { NovelWorldbookSettings } from '../../types';
import type {
  WorldbookApiErrorType,
  WorldbookApiQuickTestResult,
  WorldbookApiResponse,
  WorldbookModelListResult,
} from '../../types/worldbook';
import { estimateTokenCount } from './token.service';

const DEFAULT_TIMEOUT_MS = 120000;
const RATE_LIMIT_PATTERNS = ['rate limit', 'resource_exhausted', 'too many requests', 'quota exceeded', '限流'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTimeoutMs(timeoutMs: number | undefined): number {
  const fallback = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return Math.max(1000, Math.trunc(fallback));
}

function isRateLimitStatus(status: number): boolean {
  return status === 429;
}

function isRateLimitMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return RATE_LIMIT_PATTERNS.some(keyword => lower.includes(keyword));
}

function ensureEndpointWithProtocol(endpoint: string, defaultProtocol: 'http://' | 'https://' = 'https://'): string {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `${defaultProtocol}${trimmed}`;
}

function ensureTextResponse(text: string, provider: string, raw: unknown): WorldbookApiResponse {
  const normalized = text.trim();
  if (!normalized) {
    throw new WorldbookApiError('API 返回空响应', {
      type: 'empty_response',
      provider,
    });
  }

  return {
    provider,
    text: normalized,
    outputTokens: estimateTokenCount(normalized),
    raw,
  };
}

function extractGeminiCandidateText(candidate: unknown): string {
  if (!isRecord(candidate)) {
    return '';
  }

  const content = candidate.content;
  if (!isRecord(content)) {
    return '';
  }

  const parts = content.parts;
  if (!Array.isArray(parts)) {
    return '';
  }

  const texts = parts
    .map((part) => {
      if (!isRecord(part) || typeof part.text !== 'string') {
        return '';
      }
      return part.text;
    })
    .filter(Boolean);

  return texts.join('\n').trim();
}

function extractOpenAIChoiceText(choice: unknown): string {
  if (!isRecord(choice)) {
    return '';
  }

  const message = choice.message;
  if (isRecord(message) && typeof message.content === 'string') {
    return message.content.trim();
  }

  if (typeof choice.text === 'string') {
    return choice.text.trim();
  }

  const delta = choice.delta;
  if (isRecord(delta) && typeof delta.content === 'string') {
    return delta.content.trim();
  }

  return '';
}

function extractTextFromPayload(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (Array.isArray(payload)) {
    const merged = payload.map(item => extractTextFromPayload(item)).filter(Boolean).join('\n').trim();
    return merged;
  }

  if (!isRecord(payload)) {
    return '';
  }

  if (Array.isArray(payload.candidates)) {
    for (const candidate of payload.candidates) {
      const text = extractGeminiCandidateText(candidate);
      if (text) {
        return text;
      }
    }
  }

  if (Array.isArray(payload.choices)) {
    for (const choice of payload.choices) {
      const text = extractOpenAIChoiceText(choice);
      if (text) {
        return text;
      }
    }
  }

  const fallbackKeys = ['response', 'content', 'text', 'output', 'generated_text', 'result', 'completion'];
  for (const key of fallbackKeys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  if (isRecord(payload.message)) {
    const messageContent = payload.message.content;
    if (typeof messageContent === 'string' && messageContent.trim()) {
      return messageContent.trim();
    }
  }

  if (payload.data !== undefined) {
    const nested = extractTextFromPayload(payload.data);
    if (nested) {
      return nested;
    }
  }

  return '';
}

function parseSSEPayload(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const output: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) {
      continue;
    }

    const dataPart = trimmed.slice(5).trim();
    if (!dataPart || dataPart === '[DONE]') {
      continue;
    }

    try {
      const parsed = JSON.parse(dataPart) as unknown;
      const text = extractTextFromPayload(parsed);
      if (text) {
        output.push(text);
      }
      continue;
    } catch {
      output.push(dataPart);
    }
  }

  return output.join('').trim();
}

async function parseHttpResponse(response: Response, provider: string): Promise<WorldbookApiResponse> {
  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new WorldbookApiError('API 返回空响应', {
      type: 'empty_response',
      provider,
      statusCode: response.status,
    });
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  const looksLikeSSE = contentType.includes('text/event-stream') || trimmed.startsWith('data:');

  if (looksLikeSSE) {
    const sseText = parseSSEPayload(rawText);
    return ensureTextResponse(sseText, provider, rawText);
  }

  const looksLikeJson = contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!looksLikeJson) {
    return ensureTextResponse(trimmed, provider, rawText);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawText) as unknown;
  } catch (error) {
    throw new WorldbookApiError('API 响应 JSON 解析失败', {
      type: 'json_parse',
      provider,
      statusCode: response.status,
      responseSnippet: rawText.slice(0, 240),
      cause: error,
    });
  }

  const parsedText = extractTextFromPayload(payload);
  return ensureTextResponse(parsedText, provider, payload);
}

function toWorldbookApiError(error: unknown, provider: string, timeoutMs: number): WorldbookApiError {
  if (error instanceof WorldbookApiError) {
    return error;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new WorldbookApiError(`API 请求超时 (${Math.round(timeoutMs / 1000)} 秒)`, {
      type: 'timeout',
      provider,
      cause: error,
    });
  }

  if (error instanceof Error) {
    const message = error.message || '未知错误';

    if (message === 'ABORTED') {
      return new WorldbookApiError('请求已中止', {
        type: 'aborted',
        provider,
        cause: error,
      });
    }

    if (isRateLimitMessage(message)) {
      return new WorldbookApiError(message, {
        type: 'rate_limit',
        provider,
        cause: error,
      });
    }

    return new WorldbookApiError(message, {
      type: 'network',
      provider,
      cause: error,
    });
  }

  return new WorldbookApiError('未知 API 错误', {
    type: 'unknown',
    provider,
    cause: error,
  });
}

async function raceWithTimeoutAndAbort<T>(
  requestPromise: Promise<T>,
  options: {
    provider: string;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<T> {
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);

  if (options.signal?.aborted) {
    throw new WorldbookApiError('请求已中止', {
      type: 'aborted',
      provider: options.provider,
    });
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let removeAbortListener: () => void = () => {};

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(
        new WorldbookApiError(`API 请求超时 (${Math.round(timeoutMs / 1000)} 秒)`, {
          type: 'timeout',
          provider: options.provider,
        }),
      );
    }, timeoutMs);
  });

  const abortPromise =
    options.signal == null
      ? null
      : new Promise<never>((_, reject) => {
          const onAbort = () => {
            reject(
              new WorldbookApiError('请求已中止', {
                type: 'aborted',
                provider: options.provider,
              }),
            );
          };
          options.signal?.addEventListener('abort', onAbort, { once: true });
          removeAbortListener = () => {
            options.signal?.removeEventListener('abort', onAbort);
          };
        });

  try {
    const participants = [requestPromise, timeoutPromise] as Array<Promise<T>>;
    if (abortPromise) {
      participants.push(abortPromise as Promise<T>);
    }

    return await Promise.race(participants);
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }

    removeAbortListener();
  }
}

type CustomRequestConfig = {
  provider: string;
  url: string;
  init: RequestInit;
};

function buildCustomRequest(prompt: string, settings: NovelWorldbookSettings): CustomRequestConfig {
  const providerRaw = (settings.customApiProvider || 'gemini').trim().toLowerCase();
  const provider = providerRaw === 'openai-compat' ? 'openai-compatible' : providerRaw;
  const model = settings.customApiModel?.trim();
  const apiKey = settings.customApiKey?.trim();
  const endpoint = settings.customApiEndpoint?.trim();

  switch (provider) {
    case 'deepseek': {
      if (!apiKey) {
        throw new WorldbookApiError('DeepSeek API Key 未设置', {
          type: 'network',
          provider,
        });
      }

      return {
        provider,
        url: 'https://api.deepseek.com/chat/completions',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model || 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 8192,
          }),
        },
      };
    }

    case 'gemini': {
      if (!apiKey) {
        throw new WorldbookApiError('Gemini API Key 未设置', {
          type: 'network',
          provider,
        });
      }

      const geminiModel = model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
      return {
        provider,
        url,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 65536,
            },
          }),
        },
      };
    }

    case 'gemini-proxy': {
      if (!endpoint) {
        throw new WorldbookApiError('Gemini Proxy Endpoint 未设置', {
          type: 'network',
          provider,
        });
      }

      if (!apiKey) {
        throw new WorldbookApiError('Gemini Proxy API Key 未设置', {
          type: 'network',
          provider,
        });
      }

      const geminiProxyModel = model || 'gemini-2.5-flash';
      const normalizedEndpoint = ensureEndpointWithProtocol(endpoint);
      const endpointWithoutSlash = normalizedEndpoint.endsWith('/')
        ? normalizedEndpoint.slice(0, -1)
        : normalizedEndpoint;
      const useOpenAIFormat = endpointWithoutSlash.endsWith('/v1');

      if (useOpenAIFormat) {
        return {
          provider,
          url: `${endpointWithoutSlash}/chat/completions`,
          init: {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: geminiProxyModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3,
              max_tokens: 65536,
            }),
          },
        };
      }

      const baseUrl = `${endpointWithoutSlash}/${geminiProxyModel}:generateContent`;
      const url = baseUrl.includes('?') ? `${baseUrl}&key=${apiKey}` : `${baseUrl}?key=${apiKey}`;

      return {
        provider,
        url,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 65536,
            },
          }),
        },
      };
    }

    case 'openai-compatible':
    case 'openai':
    default: {
      let openaiEndpoint = endpoint || 'http://127.0.0.1:5000/v1/chat/completions';
      openaiEndpoint = ensureEndpointWithProtocol(openaiEndpoint, 'http://');

      if (!openaiEndpoint.includes('/chat/completions')) {
        if (openaiEndpoint.endsWith('/v1')) {
          openaiEndpoint = `${openaiEndpoint}/chat/completions`;
        } else {
          openaiEndpoint = `${openaiEndpoint.replace(/\/$/, '')}/chat/completions`;
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      return {
        provider,
        url: openaiEndpoint,
        init: {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: model || 'local-model',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 64000,
            stream: false,
          }),
        },
      };
    }
  }
}

function normalizeCustomProvider(provider: string | undefined): string {
  const normalized = (provider || 'gemini').trim().toLowerCase();
  return normalized === 'openai-compat' ? 'openai-compatible' : normalized;
}

function buildOpenAIModelsEndpoint(endpoint: string): string {
  let modelsUrl = endpoint.trim() || 'http://127.0.0.1:5000/v1';
  modelsUrl = ensureEndpointWithProtocol(modelsUrl, 'http://');

  if (modelsUrl.endsWith('/chat/completions')) {
    return modelsUrl.replace(/\/chat\/completions$/, '/models');
  }

  if (modelsUrl.endsWith('/v1')) {
    return `${modelsUrl}/models`;
  }

  if (!modelsUrl.endsWith('/models')) {
    return `${modelsUrl.replace(/\/$/, '')}/models`;
  }

  return modelsUrl;
}

type ModelListRequestConfig = {
  provider: string;
  url: string;
  init: RequestInit;
};

function buildModelListRequest(settings: NovelWorldbookSettings): ModelListRequestConfig {
  const provider = normalizeCustomProvider(settings.customApiProvider);
  const apiKey = settings.customApiKey?.trim();
  const endpoint = settings.customApiEndpoint?.trim();

  switch (provider) {
    case 'gemini': {
      if (!apiKey) {
        throw new WorldbookApiError('Gemini API Key 未设置', {
          type: 'network',
          provider,
        });
      }

      return {
        provider,
        url: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      };
    }

    case 'gemini-proxy': {
      if (!endpoint) {
        throw new WorldbookApiError('Gemini Proxy Endpoint 未设置', {
          type: 'network',
          provider,
        });
      }

      if (!apiKey) {
        throw new WorldbookApiError('Gemini Proxy API Key 未设置', {
          type: 'network',
          provider,
        });
      }

      const normalizedEndpoint = ensureEndpointWithProtocol(endpoint);
      const endpointWithoutSlash = normalizedEndpoint.endsWith('/')
        ? normalizedEndpoint.slice(0, -1)
        : normalizedEndpoint;

      return {
        provider,
        url: endpointWithoutSlash.endsWith('/models')
          ? endpointWithoutSlash
          : `${endpointWithoutSlash}/models`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        },
      };
    }

    case 'deepseek': {
      if (!apiKey) {
        throw new WorldbookApiError('DeepSeek API Key 未设置', {
          type: 'network',
          provider,
        });
      }

      return {
        provider,
        url: 'https://api.deepseek.com/models',
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        },
      };
    }

    case 'openai-compatible':
    case 'openai':
    default: {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      return {
        provider,
        url: buildOpenAIModelsEndpoint(endpoint || 'http://127.0.0.1:5000/v1'),
        init: {
          method: 'GET',
          headers,
        },
      };
    }
  }
}

function normalizeModelName(value: unknown): string {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return '';
    }

    return normalized.startsWith('models/') ? normalized.slice('models/'.length) : normalized;
  }

  if (!isRecord(value)) {
    return '';
  }

  const candidates = [value.id, value.model, value.name, value.display_name, value.base_model];
  for (const candidate of candidates) {
    const normalized = normalizeModelName(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function extractModelNames(payload: unknown): string[] {
  if (typeof payload === 'string') {
    return Array.from(new Set(payload
      .split(/[\n,，]+/)
      .map(item => normalizeModelName(item))
      .filter(Boolean)));
  }

  const candidates: unknown[] = [];

  if (Array.isArray(payload)) {
    candidates.push(...payload);
  } else if (isRecord(payload)) {
    if (Array.isArray(payload.data)) {
      candidates.push(...payload.data);
    }
    if (Array.isArray(payload.models)) {
      candidates.push(...payload.models);
    }
    if (Array.isArray(payload.result)) {
      candidates.push(...payload.result);
    }
    if (isRecord(payload.data) && Array.isArray(payload.data.models)) {
      candidates.push(...payload.data.models);
    }
  }

  const normalized = candidates
    .map(item => normalizeModelName(item))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

async function parseModelListResponse(response: Response, provider: string): Promise<WorldbookModelListResult> {
  const rawText = await response.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      provider,
      models: [],
      raw: rawText,
    };
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  const looksLikeJson = contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!looksLikeJson) {
    return {
      provider,
      models: extractModelNames(trimmed),
      raw: rawText,
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawText) as unknown;
  } catch (error) {
    throw new WorldbookApiError('模型列表响应 JSON 解析失败', {
      type: 'json_parse',
      provider,
      statusCode: response.status,
      responseSnippet: rawText.slice(0, 240),
      cause: error,
    });
  }

  return {
    provider,
    models: extractModelNames(payload),
    raw: payload,
  };
}

function getSillyTavernGenerator(requestId?: string): (prompt: string) => Promise<string> {
  const maybeGenerate = (globalThis as { generate?: (config: Record<string, unknown>) => Promise<string> }).generate;

  if (typeof maybeGenerate === 'function') {
    return async (prompt: string) =>
      maybeGenerate({
        generation_id: requestId,
        user_input: prompt,
        should_stream: false,
        should_silence: true,
      });
  }

  const globalWithSt = globalThis as {
    SillyTavern?: {
      getContext?: () => {
        generateQuietPrompt?: (prompt: string, _a?: boolean, _b?: boolean) => Promise<string>;
        generateRaw?: (prompt: string, _preset?: string, _stream?: boolean) => Promise<string>;
      };
    };
  };

  const context = globalWithSt.SillyTavern?.getContext?.();
  if (context?.generateQuietPrompt) {
    return (prompt: string) => context.generateQuietPrompt?.(prompt, false, false) as Promise<string>;
  }

  if (context?.generateRaw) {
    return (prompt: string) => context.generateRaw?.(prompt, '', false) as Promise<string>;
  }

  throw new WorldbookApiError('无法访问可用的酒馆生成接口', {
    type: 'network',
    provider: 'sillytavern',
  });
}

export class WorldbookApiError extends Error {
  readonly type: WorldbookApiErrorType;
  readonly provider: string;
  readonly statusCode: number | null;
  readonly responseSnippet: string | null;

  constructor(
    message: string,
    options: {
      type: WorldbookApiErrorType;
      provider: string;
      statusCode?: number;
      responseSnippet?: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'WorldbookApiError';
    this.type = options.type;
    this.provider = options.provider;
    this.statusCode = options.statusCode ?? null;
    this.responseSnippet = options.responseSnippet ?? null;

    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export async function callSillyTavernAPI(
  prompt: string,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    requestId?: string;
  } = {},
): Promise<WorldbookApiResponse> {
  const provider = 'sillytavern';
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);

  try {
    const generator = getSillyTavernGenerator(options.requestId);
    const raw = await raceWithTimeoutAndAbort(generator(prompt), {
      provider,
      timeoutMs,
      signal: options.signal,
    });

    if (typeof raw !== 'string') {
      throw new WorldbookApiError('酒馆 API 返回了非文本响应', {
        type: 'empty_response',
        provider,
      });
    }

    return ensureTextResponse(raw, provider, raw);
  } catch (error) {
    throw toWorldbookApiError(error, provider, timeoutMs);
  }
}

export async function callCustomAPI(
  prompt: string,
  settings: NovelWorldbookSettings,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<WorldbookApiResponse> {
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs ?? settings.apiTimeout);
  const requestConfig = buildCustomRequest(prompt, settings);
  const provider = requestConfig.provider;

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const onAbort = () => {
    controller.abort();
  };

  if (options.signal) {
    options.signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const response = await fetch(requestConfig.url, {
      ...requestConfig.init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      if (isRateLimitStatus(response.status) || isRateLimitMessage(responseBody)) {
        throw new WorldbookApiError(`API 限流 (${response.status})`, {
          type: 'rate_limit',
          provider,
          statusCode: response.status,
          responseSnippet: responseBody.slice(0, 240),
        });
      }

      throw new WorldbookApiError(`API 请求失败: ${response.status} ${response.statusText}`, {
        type: 'http_error',
        provider,
        statusCode: response.status,
        responseSnippet: responseBody.slice(0, 240),
      });
    }

    return await parseHttpResponse(response, provider);
  } catch (error) {
    throw toWorldbookApiError(error, provider, timeoutMs);
  } finally {
    globalThis.clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener('abort', onAbort);
    }
  }
}

export async function fetchCustomApiModels(
  settings: NovelWorldbookSettings,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<WorldbookModelListResult> {
  if (settings.useTavernApi) {
    throw new WorldbookApiError('当前使用 SillyTavern API，无需拉取自定义模型列表', {
      type: 'network',
      provider: 'sillytavern',
    });
  }

  const timeoutMs = normalizeTimeoutMs(options.timeoutMs ?? settings.apiTimeout);
  const requestConfig = buildModelListRequest(settings);
  const provider = requestConfig.provider;

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const onAbort = () => {
    controller.abort();
  };

  if (options.signal) {
    options.signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const response = await fetch(requestConfig.url, {
      ...requestConfig.init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      if (isRateLimitStatus(response.status) || isRateLimitMessage(responseBody)) {
        throw new WorldbookApiError(`模型列表请求被限流 (${response.status})`, {
          type: 'rate_limit',
          provider,
          statusCode: response.status,
          responseSnippet: responseBody.slice(0, 240),
        });
      }

      throw new WorldbookApiError(`模型列表请求失败: ${response.status} ${response.statusText}`, {
        type: 'http_error',
        provider,
        statusCode: response.status,
        responseSnippet: responseBody.slice(0, 240),
      });
    }

    return await parseModelListResponse(response, provider);
  } catch (error) {
    throw toWorldbookApiError(error, provider, timeoutMs);
  } finally {
    globalThis.clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener('abort', onAbort);
    }
  }
}

export async function quickTestWorldbookApi(
  settings: NovelWorldbookSettings,
  options: {
    prompt?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
    requestId?: string;
  } = {},
): Promise<WorldbookApiQuickTestResult> {
  const prompt = options.prompt?.trim() || '请只回复：OK';
  const startedAt = Date.now();
  const response = await callAPI(prompt, settings, options);

  return {
    provider: response.provider,
    elapsedMs: Math.max(0, Date.now() - startedAt),
    responseText: response.text,
    outputTokens: response.outputTokens,
  };
}

export async function callAPI(
  prompt: string,
  settings: NovelWorldbookSettings,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    requestId?: string;
  } = {},
): Promise<WorldbookApiResponse> {
  if (settings.useTavernApi) {
    return callSillyTavernAPI(prompt, {
      timeoutMs: options.timeoutMs ?? settings.apiTimeout,
      signal: options.signal,
      requestId: options.requestId,
    });
  }

  return callCustomAPI(prompt, settings, {
    timeoutMs: options.timeoutMs ?? settings.apiTimeout,
    signal: options.signal,
  });
}
