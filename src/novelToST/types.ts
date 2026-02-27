export type ExtractMode = 'all' | 'tags';

export type ExportFormat = 'txt' | 'json';

export type WorldbookParallelMode = 'independent' | 'batch';

export type WorldbookEntryConfig = {
  position?: number;
  depth?: number;
  order?: number;
  autoIncrementOrder?: boolean;
};

export type NovelWorldbookSettings = {
  chunkSize: number;
  enablePlotOutline: boolean;
  enableLiteraryStyle: boolean;
  language: string;
  customWorldbookPrompt: string;
  customPlotPrompt: string;
  customStylePrompt: string;
  useVolumeMode: boolean;
  apiTimeout: number;
  parallelEnabled: boolean;
  parallelConcurrency: number;
  parallelMode: WorldbookParallelMode;
  startChunkIndex: number;
  useTavernApi: boolean;
  customMergePrompt: string;
  categoryLightSettings: Record<string, boolean> | null;
  defaultWorldbookEntries: string;
  customRerollPrompt: string;
  customApiProvider: string;
  customApiKey: string;
  customApiEndpoint: string;
  customApiModel: string;
  forceChapterMarker: boolean;
  chapterRegexPattern: string;
  useCustomChapterRegex: boolean;
  defaultWorldbookEntriesUI: unknown[];
  categoryDefaultConfig: Record<string, WorldbookEntryConfig>;
  entryPositionConfig: Record<string, WorldbookEntryConfig>;
  customSuffixPrompt: string;
  allowRecursion: boolean;
  filterResponseTags: string;
  debugMode: boolean;
};

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

  worldbook: NovelWorldbookSettings;
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
  pausedAt: number | null;
  totalPausedMs: number;
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
