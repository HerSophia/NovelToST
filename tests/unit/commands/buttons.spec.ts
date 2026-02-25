import { registerNovelButtons } from '@/novelToST/commands/buttons';
import { stMocks } from '../../setup/st-globals.mock';

describe('buttons command', () => {
  it('should register button listeners and dispatch handlers', () => {
    const handlers = {
      start: vi.fn(async () => {}),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      exportTXT: vi.fn(),
    };

    const callbacks = new Map<string, () => void>();
    const stopFns: Array<ReturnType<typeof vi.fn>> = [];

    stMocks.getButtonEvent.mockImplementation(name => `evt:${name}`);
    stMocks.eventOn.mockImplementation((eventName: string, callback: () => void) => {
      callbacks.set(eventName, callback);
      const stop = vi.fn();
      stopFns.push(stop);
      return { stop };
    });

    const registration = registerNovelButtons(handlers);

    expect(stMocks.replaceScriptButtons).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'NovelToST-开始生成' }),
        expect.objectContaining({ name: 'NovelToST-暂停' }),
        expect.objectContaining({ name: 'NovelToST-恢复' }),
        expect.objectContaining({ name: 'NovelToST-停止' }),
        expect.objectContaining({ name: 'NovelToST-导出TXT' }),
      ]),
    );

    callbacks.get('evt:NovelToST-开始生成')?.();
    callbacks.get('evt:NovelToST-暂停')?.();
    callbacks.get('evt:NovelToST-恢复')?.();
    callbacks.get('evt:NovelToST-停止')?.();
    callbacks.get('evt:NovelToST-导出TXT')?.();

    expect(handlers.start).toHaveBeenCalledTimes(1);
    expect(handlers.pause).toHaveBeenCalledTimes(1);
    expect(handlers.resume).toHaveBeenCalledTimes(1);
    expect(handlers.stop).toHaveBeenCalledTimes(1);
    expect(handlers.exportTXT).toHaveBeenCalledTimes(1);

    registration.unregister();

    stopFns.forEach(stop => {
      expect(stop).toHaveBeenCalledTimes(1);
    });
    expect(stMocks.replaceScriptButtons).toHaveBeenLastCalledWith([]);
  });
});
