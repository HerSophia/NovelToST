// ── 统一消息角色 ──

export type ConversationMessageRole = 'user' | 'assistant' | 'system';

// ── 统一消息展示模型 ──

export type ConversationMessageVM = {
  id: string;
  role: ConversationMessageRole;
  text: string;
  createdAt?: string;
  parseError?: string | null;
  parseWarnings?: string[];
  rawResponse?: string;
};

// ── 回合展示模型 ──

export type ConversationRoundStatus = 'applied' | 'partial' | 'failed';

export type ConversationRoundVM = {
  roundId: string;
  userMessageId: string;
  assistantMessageId: string;
  status: ConversationRoundStatus;
  warningText?: string | null;
};

// ── 统一视图状态 ──

export type ConversationViewState = {
  messageInput: string;
  aiBusy: boolean;
  aiBusyAction: string | null;
  lastParseWarning: string | null;
  canRetryLastRound: boolean;
  canDeleteLastRound: boolean;
};

// ── 工坊能力开关 ──

export type ConversationCapabilities = {
  hasSessions: boolean;
  hasMentions: boolean;
  canRetryLastRound: boolean;
  canDeleteLastRound: boolean;
  hasSnapshotPreview: boolean;
};
