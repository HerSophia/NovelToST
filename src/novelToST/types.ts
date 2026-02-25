export type ExtractMode = 'all' | 'tags';

export type ExportFormat = 'txt' | 'json';

export type NovelSettings = {
  totalChapters: number;
  currentChapter: number;
  prompt: string;
  autoSaveInterval: number;
  maxRetries: number;
  minChapterLength: number;

  exportAll: boolean;
  exportStartFloor: number;
  exportEndFloor: number;
  exportIncludeUser: boolean;
  exportIncludeAI: boolean;

  extractMode: ExtractMode;
  extractTags: string;
  tagSeparator: string;

  replyWaitTime: number;
  stabilityCheckInterval: number;
  stabilityRequiredCount: number;
  enableSendToastDetection: boolean;
  sendToastWaitTimeout: number;
  sendPostToastWaitTime: number;
  enableReplyToastDetection: boolean;
  replyToastWaitTimeout: number;
  replyPostToastWaitTime: number;

  maxWaitForResponseStart: number;
  maxWaitForStable: number;
  retryBackoffMs: number;

  reloadOnChatChange: boolean;
  persistDebounceMs: number;
  useRawContent: boolean;
};

export type ChapterRecord = {
  floor: number;
  index: number;
  role: ChatMessage['role'];
  name: string;
  content: string;
  message_id: number;
};

export type GenerationErrorRecord = {
  chapter: number;
  message: string;
  timestamp: string;
};

export type GenerationStats = {
  startTime: number | null;
  endTime: number | null;
  chaptersGenerated: number;
  totalCharacters: number;
  errors: GenerationErrorRecord[];
};

export type ExportSnapshot = {
  format: ExportFormat;
  filename: string;
  chapterCount: number;
  totalCharacters: number;
  exportedAt: string;
};

export type GenerationRuntimeStatus = 'idle' | 'running' | 'paused' | 'stopping' | 'completed' | 'error';
