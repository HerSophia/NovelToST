import {
  requestLLM,
  requestLLMText,
  resolveLLMCustomConfigFromWorldbookSettings,
} from '@/novelToST/core/llm-api.service';

describe('llm-api.service', () => {
  const generateRawMock = vi.fn<(payload: Record<string, unknown>) => Promise<string>>();
  const stopGenerationByIdMock = vi.fn<(generationId: string) => boolean>();

  beforeEach(() => {
    generateRawMock.mockReset();
    stopGenerationByIdMock.mockReset();
    stopGenerationByIdMock.mockReturnValue(true);

    vi.stubGlobal('generateRaw', generateRawMock);
    vi.stubGlobal('stopGenerationById', stopGenerationByIdMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should request tavern provider with normalized payload and return trimmed text', async () => {
    generateRawMock.mockResolvedValue('  AI 输出  ');

    const response = await requestLLM({
      prompt: '测试提示词',
      channel: 'outline',
      provider: 'tavern',
      model: '  model-a  ',
      temperature: 0.7,
      requestId: 'outline-request-1',
    });

    expect(response).toMatchObject({
      text: 'AI 输出',
      rawText: '  AI 输出  ',
      channel: 'outline',
      provider: 'tavern',
      requestId: 'outline-request-1',
    });
    expect(response.elapsedMs).toBeGreaterThanOrEqual(0);

    expect(generateRawMock).toHaveBeenCalledTimes(1);
    expect(generateRawMock).toHaveBeenCalledWith({
      generation_id: 'outline-request-1',
      user_input: '测试提示词',
      should_silence: true,
      max_chat_history: 0,
      model: 'model-a',
      temperature: 0.7,
    });
  });

  it('should send system prompt via ordered_prompts when provided', async () => {
    generateRawMock.mockResolvedValue('system-ok');

    const result = await requestLLMText({
      prompt: '用户指令',
      systemPrompt: '系统上下文：当前 Storylines 和 Nodes',
      channel: 'outline',
      requestId: 'system-request-1',
    });

    expect(result).toBe('system-ok');
    expect(generateRawMock).toHaveBeenCalledTimes(1);
    expect(generateRawMock).toHaveBeenCalledWith({
      generation_id: 'system-request-1',
      user_input: '用户指令',
      should_silence: true,
      max_chat_history: 0,
      ordered_prompts: [{ role: 'system', content: '系统上下文：当前 Storylines 和 Nodes' }, 'user_input'],
    });
  });

  it('should route provider=custom via generateRaw custom_api config', async () => {
    generateRawMock.mockResolvedValue('custom-ok');

    const result = await requestLLMText({
      prompt: '测试提示词',
      channel: 'outline',
      provider: 'custom',
      model: 'override-model',
      temperature: 0.25,
      requestId: 'custom-request-1',
      customConfig: {
        apiurl: 'https://example.com/v1/chat/completions',
        key: 'custom-key',
        model: 'base-model',
        source: 'openai-compat',
      },
    });

    expect(result).toBe('custom-ok');
    expect(generateRawMock).toHaveBeenCalledTimes(1);

    const payload = generateRawMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload?.generation_id).toBe('custom-request-1');
    expect(payload?.user_input).toBe('测试提示词');
    expect(payload?.custom_api).toMatchObject({
      apiurl: 'https://example.com/v1/chat/completions',
      key: 'custom-key',
      model: 'override-model',
      source: 'openai-compatible',
      temperature: 0.25,
    });
    expect(payload?.model).toBeUndefined();
  });

  it('should warn and fallback to tavern when provider=custom misses config', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      return;
    });
    generateRawMock.mockResolvedValue('fallback-ok');

    await requestLLMText({
      prompt: '测试提示词',
      channel: 'outline',
      provider: 'custom',
      requestId: 'fallback-request',
      customProviderFallbackWarning: 'custom-provider-fallback',
    });

    expect(warnSpy).toHaveBeenCalledWith('custom-provider-fallback');
    expect(generateRawMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: 'fallback-request',
        user_input: '测试提示词',
        should_silence: true,
        max_chat_history: 0,
      }),
    );
    const payload = generateRawMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload?.custom_api).toBeUndefined();

    warnSpy.mockRestore();
  });

  it('should throw when generateRaw interface is missing', async () => {
    vi.unstubAllGlobals();

    await expect(
      requestLLMText({
        prompt: '测试提示词',
        channel: 'outline',
      }),
    ).rejects.toThrow('[outline] 当前环境缺少 generateRaw 接口');
  });

  it('should throw when response text is empty', async () => {
    generateRawMock.mockResolvedValue('    ');

    await expect(
      requestLLMText({
        prompt: '测试提示词',
        channel: 'outline',
      }),
    ).rejects.toThrow('AI 返回空响应');
  });

  it('should timeout and call stopGenerationById when timeoutMs is reached', async () => {
    vi.useFakeTimers();
    generateRawMock.mockImplementation(() => new Promise<string>(() => {}));

    const pending = requestLLMText({
      prompt: '测试提示词',
      channel: 'outline',
      requestId: 'timeout-request',
      timeoutMs: 50,
    });

    const timeoutExpectation = expect(pending).rejects.toThrow('请求超时');

    await vi.advanceTimersByTimeAsync(60);

    await timeoutExpectation;
    expect(stopGenerationByIdMock).toHaveBeenCalledWith('timeout-request');
  });

  it('should abort request and stop generation when signal is aborted', async () => {
    generateRawMock.mockImplementation(() => new Promise<string>(() => {}));

    const controller = new AbortController();
    const pending = requestLLMText({
      prompt: '测试提示词',
      channel: 'outline',
      requestId: 'abort-request',
      signal: controller.signal,
    });

    controller.abort();

    await expect(pending).rejects.toThrow('请求已中止');
    expect(stopGenerationByIdMock).toHaveBeenCalledWith('abort-request');
  });

  it('should retry with attempt-specific generation id', async () => {
    generateRawMock.mockRejectedValueOnce(new Error('temporary error'));
    generateRawMock.mockResolvedValueOnce('retry-ok');

    const result = await requestLLMText({
      prompt: '测试提示词',
      channel: 'outline',
      requestId: 'retry-request',
      retry: {
        attempts: 2,
        backoffMs: 0,
      },
    });

    expect(result).toBe('retry-ok');
    expect(generateRawMock).toHaveBeenCalledTimes(2);

    expect(generateRawMock.mock.calls[0]?.[0]).toMatchObject({
      generation_id: 'retry-request-attempt-1',
    });
    expect(generateRawMock.mock.calls[1]?.[0]).toMatchObject({
      generation_id: 'retry-request-attempt-2',
    });
  });

  it('should resolve custom config from worldbook settings', () => {
    const config = resolveLLMCustomConfigFromWorldbookSettings({
      customApiProvider: 'openai-compat',
      customApiKey: 'api-key',
      customApiEndpoint: 'https://example.com/v1/chat/completions',
      customApiModel: 'gpt-4.1',
    });

    expect(config).toEqual({
      apiurl: 'https://example.com/v1/chat/completions',
      key: 'api-key',
      model: 'gpt-4.1',
      source: 'openai-compatible',
    });

    expect(
      resolveLLMCustomConfigFromWorldbookSettings({
        customApiProvider: 'openai',
        customApiKey: 'api-key',
        customApiEndpoint: '',
        customApiModel: 'gpt-4.1',
      }),
    ).toBeNull();
  });
});
