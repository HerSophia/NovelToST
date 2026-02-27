import _ from 'lodash';
import { vi } from 'vitest';

const createDisplayedMessage = () => ({
  text: () => '',
});

const tavernEvents = {
  CHAT_CHANGED: 'CHAT_CHANGED',
  CHARACTER_MESSAGE_RENDERED: 'CHARACTER_MESSAGE_RENDERED',
  MESSAGE_EDITED: 'MESSAGE_EDITED',
  MESSAGE_DELETED: 'MESSAGE_DELETED',
  MORE_MESSAGES_LOADED: 'MORE_MESSAGES_LOADED',
  STREAM_TOKEN_RECEIVED: 'STREAM_TOKEN_RECEIVED',
} as const;

export const stMocks = {
  getLastMessageId: vi.fn<() => number>(),
  getChatMessages: vi.fn<(range: string | number, options?: { role?: ChatMessage['role'] | 'all' }) => ChatMessage[]>(),
  createChatMessages: vi.fn<(messages: Array<{ role: ChatMessage['role']; message: string }>) => Promise<void>>(),
  retrieveDisplayedMessage: vi.fn<(messageId: number) => { text: () => string }>(),
  triggerSlash: vi.fn<(command: string) => Promise<void>>(),
  getScriptId: vi.fn<() => string>(),
  getVariables: vi.fn<() => Record<string, unknown>>(),
  replaceScriptButtons: vi.fn<(buttons: ScriptButton[]) => void>(),
  eventOn: vi.fn<(eventName: string, callback: (...args: any[]) => void) => EventOnReturn>(),
  getButtonEvent: vi.fn<(name: string) => string>(),
  insertOrAssignVariables: vi.fn<
    (variables: Record<string, unknown>, option: VariableOption) => Record<string, unknown>
  >(),
  replaceScriptInfo: vi.fn<(markdown: string) => void>(),
  getTavernHelperVersion: vi.fn<() => Promise<string>>(),
  eventEmit: vi.fn<(eventName: string, ...args: unknown[]) => void>(),
  eventMakeFirst: vi.fn<(eventName: string, callback: (...args: any[]) => void) => EventOnReturn>(),
  substitudeMacros: vi.fn<(text: string) => string>(),
  errorCatched: vi.fn<(fn: (...args: any[]) => any) => (...args: any[]) => any>(),
  SillyTavern: {
    getCurrentChatId: vi.fn<() => unknown>(),
    chat: [] as unknown[],
  },
  tavern_events: { ...tavernEvents },
  toastr: {
    success: vi.fn<(message?: string, title?: string) => void>(),
    warning: vi.fn<(message?: string, title?: string) => void>(),
    error: vi.fn<(message?: string, title?: string) => void>(),
    info: vi.fn<(message?: string, title?: string) => void>(),
  },
};

export function installSTGlobalMocks(): void {
  const globalRef = globalThis as unknown as Record<string, unknown>;

  globalRef._ = _;
  globalRef.getLastMessageId = stMocks.getLastMessageId;
  globalRef.getChatMessages = stMocks.getChatMessages;
  globalRef.createChatMessages = stMocks.createChatMessages;
  globalRef.retrieveDisplayedMessage = stMocks.retrieveDisplayedMessage;
  globalRef.triggerSlash = stMocks.triggerSlash;
  globalRef.getScriptId = stMocks.getScriptId;
  globalRef.getVariables = stMocks.getVariables;
  globalRef.replaceScriptButtons = stMocks.replaceScriptButtons;
  globalRef.eventOn = stMocks.eventOn;
  globalRef.getButtonEvent = stMocks.getButtonEvent;
  globalRef.insertOrAssignVariables = stMocks.insertOrAssignVariables;
  globalRef.replaceScriptInfo = stMocks.replaceScriptInfo;
  globalRef.getTavernHelperVersion = stMocks.getTavernHelperVersion;
  globalRef.eventEmit = stMocks.eventEmit;
  globalRef.eventMakeFirst = stMocks.eventMakeFirst;
  globalRef.substitudeMacros = stMocks.substitudeMacros;
  globalRef.errorCatched = stMocks.errorCatched;
  globalRef.SillyTavern = stMocks.SillyTavern;
  globalRef.tavern_events = stMocks.tavern_events;
  globalRef.toastr = stMocks.toastr;
}

export function resetSTGlobalMockState(): void {
  stMocks.getLastMessageId.mockReset();
  stMocks.getLastMessageId.mockReturnValue(-1);

  stMocks.getChatMessages.mockReset();
  stMocks.getChatMessages.mockReturnValue([]);

  stMocks.createChatMessages.mockReset();
  stMocks.createChatMessages.mockResolvedValue();

  stMocks.retrieveDisplayedMessage.mockReset();
  stMocks.retrieveDisplayedMessage.mockImplementation(() => createDisplayedMessage());

  stMocks.triggerSlash.mockReset();
  stMocks.triggerSlash.mockResolvedValue();

  stMocks.getScriptId.mockReset();
  stMocks.getScriptId.mockReturnValue('novel-to-st-test-script');

  stMocks.getVariables.mockReset();
  stMocks.getVariables.mockReturnValue({});

  stMocks.replaceScriptButtons.mockReset();

  stMocks.eventOn.mockReset();
  stMocks.eventOn.mockImplementation(() => ({ stop: vi.fn() }));

  stMocks.getButtonEvent.mockReset();
  stMocks.getButtonEvent.mockImplementation(name => name);

  stMocks.insertOrAssignVariables.mockReset();
  stMocks.insertOrAssignVariables.mockImplementation((variables: Record<string, unknown>) => variables);

  stMocks.replaceScriptInfo.mockReset();

  stMocks.getTavernHelperVersion.mockReset();
  stMocks.getTavernHelperVersion.mockResolvedValue('0.0.0');

  stMocks.eventEmit.mockReset();

  stMocks.eventMakeFirst.mockReset();
  stMocks.eventMakeFirst.mockImplementation(() => ({ stop: vi.fn() }));

  stMocks.substitudeMacros.mockReset();
  stMocks.substitudeMacros.mockImplementation(text => text);

  stMocks.errorCatched.mockReset();
  stMocks.errorCatched.mockImplementation(fn => fn);

  stMocks.SillyTavern.getCurrentChatId.mockReset();
  stMocks.SillyTavern.getCurrentChatId.mockReturnValue('test-chat-id');
  stMocks.SillyTavern.chat = [];

  stMocks.toastr.success.mockReset();
  stMocks.toastr.warning.mockReset();
  stMocks.toastr.error.mockReset();
  stMocks.toastr.info.mockReset();
}
