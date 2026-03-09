import { useFoundationControl } from '@/novelToST/composables/useFoundationControl';
import { useFoundationStore } from '@/novelToST/stores/foundation.store';
import { stMocks } from '../../setup/st-globals.mock';

describe('useFoundationControl', () => {
  const generateRawMock = vi.fn<(payload: { user_input?: string }) => Promise<string>>();

  beforeEach(() => {
    generateRawMock.mockReset();
    vi.stubGlobal('generateRaw', generateRawMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should append user/assistant messages and apply foundation patch on success', async () => {
    const store = useFoundationStore();
    const control = useFoundationControl();

    generateRawMock.mockResolvedValue(JSON.stringify({
      assistantReply: '我已补全主角显性目标。',
      foundationPatch: {
        protagonist: {
          visibleGoal: '在三个月内稳住边军',
        },
      },
    }));

    control.messageInput.value = '请补全主角显性目标';
    const succeeded = await control.runCollaborate();

    expect(succeeded).toBe(true);
    expect(store.messages).toHaveLength(2);
    expect(store.messages[0]?.role).toBe('user');
    expect(store.messages[1]?.role).toBe('assistant');
    expect(store.foundation.protagonist.visibleGoal).toBe('在三个月内稳住边军');
    expect(control.lastParseWarning.value).toBeNull();
    expect(stMocks.toastr.success).toHaveBeenCalled();
  });

  it('should keep foundation unchanged when parsing fails', async () => {
    const store = useFoundationStore();
    const control = useFoundationControl();

    generateRawMock.mockResolvedValue('建议先明确主角与对手的冲突再补字段。');

    control.messageInput.value = '给我建议';
    const succeeded = await control.runCollaborate();

    expect(succeeded).toBe(true);
    expect(store.foundation.core.logline).toBe('');
    expect(store.messages).toHaveLength(2);
    expect(store.messages[1]?.parseError).toContain('未提取到 JSON');
    expect(control.lastParseWarning.value).toBe(
      '本轮有建议，但没有自动写入表单。你已经填写的内容没有变化。可手动参考本轮回复，或再试一次。',
    );
    expect(stMocks.toastr.warning).toHaveBeenCalled();
    expect(stMocks.toastr.warning).toHaveBeenCalledWith(
      '本轮有建议，但没有自动写入表单。你已经填写的内容没有变化。可手动参考本轮回复，或再试一次。',
    );
  });

  it('should update only target module when running module assist', async () => {
    const store = useFoundationStore();
    const control = useFoundationControl();

    generateRawMock.mockResolvedValue(JSON.stringify({
      assistantReply: '我已补全主角模块。',
      foundationPatch: {
        protagonist: {
          arcDirection: '从防御到主动出击',
        },
        core: {
          logline: '不应被写入',
        },
      },
    }));

    const succeeded = await control.runModuleAssist('protagonist');

    expect(succeeded).toBe(true);
    expect(store.foundation.protagonist.arcDirection).toBe('从防御到主动出击');
    expect(store.foundation.core.logline).toBe('');
    expect(control.aiBusyModuleId.value).toBeNull();
    expect(control.lastParseWarning.value).toBe(
      '本轮只保留了符合格式的部分内容。已写入的内容已经更新，其余内容不会受影响。',
    );
    expect(stMocks.toastr.success).toHaveBeenCalled();
  });

  it('should prevent reentry while aiBusy is true', async () => {
    const control = useFoundationControl();

    let resolveRaw!: (value: string) => void;
    generateRawMock.mockImplementation(
      () =>
        new Promise<string>(resolve => {
          resolveRaw = resolve;
        }),
    );

    control.messageInput.value = '第一条请求';
    const firstRun = control.runCollaborate();

    const secondRun = await control.runCollaborate({ instruction: '第二条请求' });
    expect(secondRun).toBe(false);
    expect(stMocks.toastr.warning).toHaveBeenCalled();

    resolveRaw(
      JSON.stringify({
        assistantReply: '已处理第一条请求。',
        foundationPatch: {
          core: {
            logline: '第一条请求返回',
          },
        },
      }),
    );

    const firstResult = await firstRun;
    expect(firstResult).toBe(true);
  });

  it('should clear messages and reset parse warning', async () => {
    const store = useFoundationStore();
    const control = useFoundationControl();

    generateRawMock.mockResolvedValue('这轮仅给出自然语言建议。');

    control.messageInput.value = '先给建议';
    await control.runCollaborate();

    expect(control.messageInput.value).toBe('');
    expect(control.lastParseWarning.value).toBe(
      '本轮有建议，但没有自动写入表单。你已经填写的内容没有变化。可手动参考本轮回复，或再试一次。',
    );
    expect(store.messages).toHaveLength(2);

    control.clearMessages();

    expect(store.messages).toEqual([]);
    expect(control.lastParseWarning.value).toBeNull();
  });
});
