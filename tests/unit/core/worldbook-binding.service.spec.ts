import {
  bindChatWorldbook,
  getChatWorldbookBindingSnapshot,
} from '@/novelToST/core/worldbook-binding.service';
import { stMocks } from '../../setup/st-globals.mock';

describe('worldbook-binding.service', () => {
  it('should read current chat binding snapshot with normalized worldbook name', async () => {
    stMocks.getChatWorldbookName.mockReturnValue(' 主世界书 ');

    const snapshot = await getChatWorldbookBindingSnapshot();

    expect(snapshot).toEqual({
      chatName: 'current',
      boundWorldbookName: '主世界书',
      hasBinding: true,
    });
  });

  it('should fallback to unbound snapshot when host returns empty value', async () => {
    stMocks.getChatWorldbookName.mockReturnValue('   ');

    const snapshot = await getChatWorldbookBindingSnapshot();

    expect(snapshot).toEqual({
      chatName: 'current',
      boundWorldbookName: null,
      hasBinding: false,
    });
  });

  it('should bind selected worldbook to current chat and return refreshed snapshot', async () => {
    stMocks.getChatWorldbookName.mockReturnValue(null);
    stMocks.rebindChatWorldbook.mockImplementation(async (_chatName, worldbookName) => {
      stMocks.getChatWorldbookName.mockReturnValue(worldbookName);
    });

    const snapshot = await bindChatWorldbook(' 主世界书 ');

    expect(stMocks.rebindChatWorldbook).toHaveBeenCalledTimes(1);
    expect(stMocks.rebindChatWorldbook).toHaveBeenCalledWith('current', '主世界书');
    expect(snapshot).toMatchObject({
      boundWorldbookName: '主世界书',
      hasBinding: true,
    });
  });

  it('should throw readable error when binding fails', async () => {
    stMocks.rebindChatWorldbook.mockRejectedValue(new Error('host unavailable'));

    await expect(bindChatWorldbook('主世界书')).rejects.toThrow('应用当前聊天世界书绑定失败：host unavailable');
  });
});
