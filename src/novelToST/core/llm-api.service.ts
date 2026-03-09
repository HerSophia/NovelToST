import type { NovelWorldbookSettings } from '../types';

export type LLMProvider = 'tavern' | 'custom';

type LLMNumericCustomSetting = 'same_as_preset' | 'unset' | number;

export type LLMCustomConfig = {
  apiurl?: string;
  key?: string;
  model?: string;
  source?: string;
  max_tokens?: LLMNumericCustomSetting;
  temperature?: LLMNumericCustomSetting;
  frequency_penalty?: LLMNumericCustomSetting;
  presence_penalty?: LLMNumericCustomSetting;
  top_p?: LLMNumericCustomSetting;
  top_k?: LLMNumericCustomSetting;
};

export type LLMRetryPolicy = {
  attempts?: number;
  backoffMs?: number;
};

export type RequestLLMTextOptions = {
  prompt: string;
  systemPrompt?: string;
  channel: string;
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  requestId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  retry?: LLMRetryPolicy;
  customConfig?: LLMCustomConfig | null;
  customProviderFallbackWarning?: string;
  strictCustomConfig?: boolean;
};

export type LLMRuntimeOptions = Omit<RequestLLMTextOptions, 'prompt' | 'channel'>;

export type LLMResponse = {
  text: string;
  rawText: string;
  channel: string;
  provider: LLMProvider;
  requestId: string;
  elapsedMs: number;
};

export type LLMRequestErrorType =
  | 'missing_api'
  | 'invalid_custom_config'
  | 'timeout'
  | 'aborted'
  | 'empty_response'
  | 'request_failed';

export class LLMRequestError extends Error {
  readonly type: LLMRequestErrorType;
  readonly channel: string;
  readonly provider: LLMProvider;
  readonly requestId: string;
  readonly cause: unknown;

  constructor(
    message: string,
    input: {
      type: LLMRequestErrorType;
      channel: string;
      provider: LLMProvider;
      requestId: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'LLMRequestError';
    this.type = input.type;
    this.channel = input.channel;
    this.provider = input.provider;
    this.requestId = input.requestId;
    this.cause = input.cause;
  }
}

type BuiltinPrompt = 'user_input';

type RolePrompt = {
  role: 'system' | 'assistant' | 'user';
  content: string;
};

type GenerateRawRequest = {
  generation_id?: string;
  user_input: string;
  should_silence: boolean;
  max_chat_history: number;
  model?: string;
  temperature?: number;
  custom_api?: {
    apiurl: string;
    key?: string;
    model: string;
    source?: string;
    max_tokens?: LLMNumericCustomSetting;
    temperature?: LLMNumericCustomSetting;
    frequency_penalty?: LLMNumericCustomSetting;
    presence_penalty?: LLMNumericCustomSetting;
    top_p?: LLMNumericCustomSetting;
    top_k?: LLMNumericCustomSetting;
  };
  ordered_prompts?: (BuiltinPrompt | RolePrompt)[];
};

type GenerateRawFn = (payload: GenerateRawRequest) => Promise<string>;
type StopGenerationByIdFn = (generationId: string) => boolean;

type ResolvedProviderRoute = {
  requestedProvider: LLMProvider;
  actualProvider: LLMProvider;
  customApi: GenerateRawRequest['custom_api'] | null;
};

type RetryPolicyState = {
  attempts: number;
  backoffMs: number;
};

function resolveGenerateRaw(): GenerateRawFn | null {
  const maybeGenerateRaw = (globalThis as { generateRaw?: GenerateRawFn }).generateRaw;
  return typeof maybeGenerateRaw === 'function' ? maybeGenerateRaw : null;
}

function resolveStopGenerationById(): StopGenerationByIdFn | null {
  const maybeStopById = (globalThis as { stopGenerationById?: StopGenerationByIdFn }).stopGenerationById;
  return typeof maybeStopById === 'function' ? maybeStopById : null;
}

function normalizeOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function normalizeTimeoutMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.max(1, Math.trunc(value));
  return normalized;
}

function normalizeRetryPolicy(retry: LLMRetryPolicy | undefined): RetryPolicyState {
  const attempts = typeof retry?.attempts === 'number' && Number.isFinite(retry.attempts)
    ? Math.max(1, Math.trunc(retry.attempts))
    : 1;

  const backoffMs = typeof retry?.backoffMs === 'number' && Number.isFinite(retry.backoffMs)
    ? Math.max(0, Math.trunc(retry.backoffMs))
    : 0;

  return {
    attempts,
    backoffMs,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  const message = toErrorMessage(error);
  return /aborted|abort/i.test(message);
}

function stopGenerationSafely(generationId: string): void {
  const stopById = resolveStopGenerationById();
  if (!stopById) {
    return;
  }

  try {
    stopById(generationId);
  } catch (error) {
    console.warn('[novelToST][llm-api] 调用 stopGenerationById 失败', error);
  }
}

function createRequestId(channel: string): string {
  const safeChannel = normalizeOptionalString(channel) || 'unknown';
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `novelToST-${safeChannel}-${Date.now()}-${randomSuffix}`;
}

function resolveAttemptRequestId(baseRequestId: string, attemptIndex: number, maxAttempts: number): string {
  if (maxAttempts <= 1) {
    return baseRequestId;
  }

  return `${baseRequestId}-attempt-${attemptIndex}`;
}

function normalizeCustomApiSource(source: string): string {
  const normalized = source.trim();
  if (!normalized) {
    return '';
  }

  const lowered = normalized.toLowerCase();
  return lowered === 'openai-compat' ? 'openai-compatible' : lowered;
}

export function resolveLLMCustomConfigFromWorldbookSettings(
  settings: Pick<
    NovelWorldbookSettings,
    'customApiProvider' | 'customApiKey' | 'customApiEndpoint' | 'customApiModel'
  >,
): LLMCustomConfig | null {
  const apiurl = normalizeOptionalString(settings.customApiEndpoint);
  const model = normalizeOptionalString(settings.customApiModel);

  if (!apiurl || !model) {
    return null;
  }

  const source = normalizeCustomApiSource(normalizeOptionalString(settings.customApiProvider));
  const key = normalizeOptionalString(settings.customApiKey);

  return {
    apiurl,
    model,
    source: source || undefined,
    key: key || undefined,
  };
}

function buildCustomApiPayload(
  options: RequestLLMTextOptions,
  normalizedModel: string,
  normalizedTemperature: number | undefined,
): GenerateRawRequest['custom_api'] | null {
  const customConfig = options.customConfig;
  if (!customConfig) {
    return null;
  }

  const apiurl = normalizeOptionalString(customConfig.apiurl);
  const model = normalizedModel || normalizeOptionalString(customConfig.model);
  if (!apiurl || !model) {
    return null;
  }

  const payload: NonNullable<GenerateRawRequest['custom_api']> = {
    apiurl,
    model,
  };

  const source = normalizeCustomApiSource(normalizeOptionalString(customConfig.source));
  if (source) {
    payload.source = source;
  }

  const key = normalizeOptionalString(customConfig.key);
  if (key) {
    payload.key = key;
  }

  if (customConfig.max_tokens !== undefined) {
    payload.max_tokens = customConfig.max_tokens;
  }

  if (customConfig.frequency_penalty !== undefined) {
    payload.frequency_penalty = customConfig.frequency_penalty;
  }

  if (customConfig.presence_penalty !== undefined) {
    payload.presence_penalty = customConfig.presence_penalty;
  }

  if (customConfig.top_p !== undefined) {
    payload.top_p = customConfig.top_p;
  }

  if (customConfig.top_k !== undefined) {
    payload.top_k = customConfig.top_k;
  }

  if (normalizedTemperature !== undefined) {
    payload.temperature = normalizedTemperature;
  } else if (customConfig.temperature !== undefined) {
    payload.temperature = customConfig.temperature;
  }

  return payload;
}

function resolveProviderRoute(
  options: RequestLLMTextOptions,
  channel: string,
  requestId: string,
  normalizedModel: string,
  normalizedTemperature: number | undefined,
): ResolvedProviderRoute {
  const requestedProvider = options.provider === 'custom' ? 'custom' : 'tavern';

  if (requestedProvider !== 'custom') {
    return {
      requestedProvider,
      actualProvider: 'tavern',
      customApi: null,
    };
  }

  const customApi = buildCustomApiPayload(options, normalizedModel, normalizedTemperature);
  if (customApi) {
    return {
      requestedProvider,
      actualProvider: 'custom',
      customApi,
    };
  }

  if (options.strictCustomConfig === true) {
    throw new LLMRequestError(`[${channel}] provider=custom 缺少有效 custom_api 配置（至少需要 apiurl + model）`, {
      type: 'invalid_custom_config',
      channel,
      provider: requestedProvider,
      requestId,
    });
  }

  const fallbackWarning =
    options.customProviderFallbackWarning ||
    `[novelToST][${channel}] provider=custom 缺少有效 custom_api 配置，当前回退 Tavern 预设通道`;
  console.warn(fallbackWarning);

  return {
    requestedProvider,
    actualProvider: 'tavern',
    customApi: null,
  };
}

function buildGenerateRawPayload(
  prompt: string,
  requestId: string,
  route: ResolvedProviderRoute,
  normalizedModel: string,
  normalizedSystemPrompt: string,
  normalizedTemperature: number | undefined,
): GenerateRawRequest {
  const payload: GenerateRawRequest = {
    generation_id: requestId,
    user_input: prompt,
    should_silence: true,
    max_chat_history: 0,
  };

  if (normalizedSystemPrompt) {
    payload.ordered_prompts = [
      { role: 'system', content: normalizedSystemPrompt },
      'user_input',
    ];
  }

  if (route.actualProvider === 'custom') {
    payload.custom_api = route.customApi ?? undefined;
    return payload;
  }

  if (normalizedModel) {
    payload.model = normalizedModel;
  }

  if (normalizedTemperature !== undefined) {
    payload.temperature = normalizedTemperature;
  }

  return payload;
}

function normalizeUnknownRequestError(
  error: unknown,
  context: {
    channel: string;
    provider: LLMProvider;
    requestId: string;
  },
): LLMRequestError {
  if (error instanceof LLMRequestError) {
    return error;
  }

  if (isAbortLikeError(error)) {
    return new LLMRequestError('请求已中止', {
      type: 'aborted',
      channel: context.channel,
      provider: context.provider,
      requestId: context.requestId,
      cause: error,
    });
  }

  const message = toErrorMessage(error).trim() || `[${context.channel}] LLM 请求失败`;
  return new LLMRequestError(message, {
    type: 'request_failed',
    channel: context.channel,
    provider: context.provider,
    requestId: context.requestId,
    cause: error,
  });
}

async function runGenerateRawWithGovernance(input: {
  generateRaw: GenerateRawFn;
  payload: GenerateRawRequest;
  channel: string;
  provider: LLMProvider;
  requestId: string;
  timeoutMs: number | null;
  signal?: AbortSignal;
}): Promise<string> {
  if (input.signal?.aborted) {
    stopGenerationSafely(input.requestId);
    throw new LLMRequestError('请求已中止', {
      type: 'aborted',
      channel: input.channel,
      provider: input.provider,
      requestId: input.requestId,
    });
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }

      if (input.signal) {
        input.signal.removeEventListener('abort', onAbort);
      }
    };

    const succeed = (value: string) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const onAbort = () => {
      stopGenerationSafely(input.requestId);
      fail(
        new LLMRequestError('请求已中止', {
          type: 'aborted',
          channel: input.channel,
          provider: input.provider,
          requestId: input.requestId,
        }),
      );
    };

    if (input.signal) {
      input.signal.addEventListener('abort', onAbort, { once: true });
    }

    const timeoutMs = input.timeoutMs;
    if (timeoutMs !== null) {
      timeoutId = globalThis.setTimeout(() => {
        stopGenerationSafely(input.requestId);
        const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
        fail(
          new LLMRequestError(`[${input.channel}] 请求超时 (${timeoutSeconds} 秒)`, {
            type: 'timeout',
            channel: input.channel,
            provider: input.provider,
            requestId: input.requestId,
          }),
        );
      }, timeoutMs);
    }

    input.generateRaw(input.payload).then(succeed).catch(fail);
  });
}

function shouldRetry(error: LLMRequestError): boolean {
  return error.type === 'timeout' || error.type === 'request_failed';
}

async function waitBackoff(input: {
  delayMs: number;
  signal?: AbortSignal;
  channel: string;
  provider: LLMProvider;
  requestId: string;
}): Promise<void> {
  if (input.delayMs <= 0) {
    return;
  }

  if (input.signal?.aborted) {
    stopGenerationSafely(input.requestId);
    throw new LLMRequestError('请求已中止', {
      type: 'aborted',
      channel: input.channel,
      provider: input.provider,
      requestId: input.requestId,
    });
  }

  await new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }

      if (input.signal) {
        input.signal.removeEventListener('abort', onAbort);
      }
    };

    const onAbort = () => {
      stopGenerationSafely(input.requestId);
      cleanup();
      reject(
        new LLMRequestError('请求已中止', {
          type: 'aborted',
          channel: input.channel,
          provider: input.provider,
          requestId: input.requestId,
        }),
      );
    };

    if (input.signal) {
      input.signal.addEventListener('abort', onAbort, { once: true });
    }

    timeoutId = globalThis.setTimeout(() => {
      cleanup();
      resolve();
    }, input.delayMs);
  });
}

export async function requestLLM(options: RequestLLMTextOptions): Promise<LLMResponse> {
  const channel = normalizeOptionalString(options.channel) || 'unknown';
  const normalizedModel = normalizeOptionalString(options.model);
  const normalizedSystemPrompt = normalizeOptionalString(options.systemPrompt);
  const normalizedTemperature = normalizeFiniteNumber(options.temperature);
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const retryPolicy = normalizeRetryPolicy(options.retry);
  const baseRequestId = normalizeOptionalString(options.requestId) || createRequestId(channel);

  const generateRaw = resolveGenerateRaw();
  if (!generateRaw) {
    throw new LLMRequestError(`[${channel}] 当前环境缺少 generateRaw 接口`, {
      type: 'missing_api',
      channel,
      provider: options.provider === 'custom' ? 'custom' : 'tavern',
      requestId: baseRequestId,
    });
  }

  const route = resolveProviderRoute(options, channel, baseRequestId, normalizedModel, normalizedTemperature);

  let lastError: LLMRequestError | null = null;

  for (let attemptIndex = 1; attemptIndex <= retryPolicy.attempts; attemptIndex += 1) {
    const attemptRequestId = resolveAttemptRequestId(baseRequestId, attemptIndex, retryPolicy.attempts);
    const startedAt = Date.now();

    const payload = buildGenerateRawPayload(
      options.prompt,
      attemptRequestId,
      route,
      normalizedModel,
      normalizedSystemPrompt,
      normalizedTemperature,
    );

    try {
      const rawResponse = await runGenerateRawWithGovernance({
        generateRaw,
        payload,
        channel,
        provider: route.actualProvider,
        requestId: attemptRequestId,
        timeoutMs,
        signal: options.signal,
      });

      const rawText = typeof rawResponse === 'string' ? rawResponse : String(rawResponse ?? '');
      const text = rawText.trim();

      if (!text) {
        throw new LLMRequestError('AI 返回空响应', {
          type: 'empty_response',
          channel,
          provider: route.actualProvider,
          requestId: attemptRequestId,
        });
      }

      return {
        text,
        rawText,
        channel,
        provider: route.actualProvider,
        requestId: attemptRequestId,
        elapsedMs: Math.max(0, Date.now() - startedAt),
      };
    } catch (error) {
      const normalizedError = normalizeUnknownRequestError(error, {
        channel,
        provider: route.actualProvider,
        requestId: attemptRequestId,
      });

      lastError = normalizedError;

      if (attemptIndex >= retryPolicy.attempts || !shouldRetry(normalizedError)) {
        throw normalizedError;
      }

      await waitBackoff({
        delayMs: retryPolicy.backoffMs * attemptIndex,
        signal: options.signal,
        channel,
        provider: route.actualProvider,
        requestId: attemptRequestId,
      });
    }
  }

  throw (
    lastError ??
    new LLMRequestError(`[${channel}] LLM 请求失败`, {
      type: 'request_failed',
      channel,
      provider: route.actualProvider,
      requestId: baseRequestId,
    })
  );
}

export async function requestLLMText(options: RequestLLMTextOptions): Promise<string> {
  const response = await requestLLM(options);
  return response.text;
}
