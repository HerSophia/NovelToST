/**
 * Host environment ignore shim for strict project typecheck.
 *
 * This file intentionally provides loose ambient declarations for
 * SillyTavern/TavernHelper host APIs used by this repository.
 * It is NOT the source of truth for host contracts.
 */

type ChatRole = 'assistant' | 'user' | 'system' | string;

declare type ChatMessage = {
  message_id: number;
  role: ChatRole;
  name: string;
  message: string;
  [key: string]: unknown;
};

declare type ScriptButton = {
  name: string;
  visible?: boolean;
  [key: string]: unknown;
};

declare type EventOnReturn = {
  stop: () => void;
  [key: string]: unknown;
};

declare type VariableOption = {
  type?: 'script' | 'chat' | 'message' | string;
  script_id?: string;
  chat_id?: string | number;
  message_id?: number | 'latest';
  [key: string]: unknown;
};

declare function getLastMessageId(): number;

declare function getChatMessages(
  range?: string | number,
  options?: {
    role?: ChatMessage['role'] | 'all';
    [key: string]: unknown;
  },
): ChatMessage[];

declare function createChatMessages(
  messages: Array<{
    role: ChatMessage['role'];
    message: string;
    [key: string]: unknown;
  }>,
): Promise<void>;

declare function retrieveDisplayedMessage(messageId: number): {
  text: () => string;
};

declare function triggerSlash(command: string): Promise<void>;

declare function getScriptId(): string;

declare function getVariables(option?: VariableOption): Record<string, unknown>;

declare function insertOrAssignVariables(
  variables: Record<string, unknown>,
  option?: VariableOption,
): Record<string, unknown>;

declare function replaceScriptButtons(buttons: ScriptButton[]): void;

declare function eventOn(eventName: string, callback: (...args: any[]) => void): EventOnReturn;

declare function getButtonEvent(name: string): string;

declare function eventEmit(eventName: string, ...args: unknown[]): void;

declare function eventMakeFirst(eventName: string, callback: (...args: any[]) => void): EventOnReturn;

declare function replaceScriptInfo(markdown: string): void;

declare function getTavernHelperVersion(): Promise<string>;

declare function substitudeMacros(text: string): string;

declare function errorCatched<T extends (...args: any[]) => any>(fn: T): T;

declare const toastr: {
  success: (message?: string, title?: string) => void;
  warning: (message?: string, title?: string) => void;
  error: (message?: string, title?: string) => void;
  info: (message?: string, title?: string) => void;
  [key: string]: unknown;
};

declare const tavern_events: {
  CHAT_CHANGED: string;
  CHARACTER_MESSAGE_RENDERED: string;
  MESSAGE_EDITED: string;
  MESSAGE_DELETED: string;
  MORE_MESSAGES_LOADED: string;
  STREAM_TOKEN_RECEIVED: string;
  [key: string]: string;
};

declare const SillyTavern: {
  chat: unknown[];
  getCurrentChatId: () => unknown;
  getContext?: () => {
    generateQuietPrompt?: (...args: unknown[]) => Promise<string> | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
