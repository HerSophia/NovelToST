import { z } from 'zod';
import { WorldbookSettingsSchema } from '../../stores/settings.store';
import type { NovelWorldbookSettings } from '../../types';
import {
  normalizeWorldbookPersistedTaskState,
  type SaveWorldbookTaskStateInput,
  type WorldbookPersistedTaskState,
} from './history-db.service';

const TASK_STATE_FILE_TYPE = 'novelToST/worldbook-task';
const SETTINGS_FILE_TYPE = 'novelToST/worldbook-settings';
const CURRENT_EXPORT_VERSION = 1;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function parseJson(raw: string, sourceLabel: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : '未知错误';
    throw new WorldbookTaskIOError('invalid_json', `${sourceLabel} JSON 解析失败：${reason}`);
  }
}

function toJsonString(payload: unknown, pretty = true): string {
  return JSON.stringify(payload, null, pretty ? 2 : 0);
}

function extractTaskStatePayload(raw: unknown): unknown {
  if (!isPlainObject(raw)) {
    return raw;
  }

  if (typeof raw.type === 'string' && raw.type !== TASK_STATE_FILE_TYPE && raw.payload !== undefined) {
    throw new WorldbookTaskIOError('invalid_payload', `任务状态文件类型不匹配：${raw.type}`);
  }

  if ('payload' in raw) {
    return raw.payload;
  }

  return raw;
}

function extractSettingsPayload(raw: unknown): unknown {
  if (!isPlainObject(raw)) {
    return raw;
  }

  if (typeof raw.type === 'string' && raw.type !== SETTINGS_FILE_TYPE && raw.worldbook !== undefined) {
    throw new WorldbookTaskIOError('invalid_payload', `设置文件类型不匹配：${raw.type}`);
  }

  if (isPlainObject(raw.worldbook)) {
    return raw.worldbook;
  }

  if (isPlainObject(raw.payload) && isPlainObject(raw.payload.worldbook)) {
    return raw.payload.worldbook;
  }

  return raw;
}

export type WorldbookTaskIOErrorCode = 'invalid_json' | 'invalid_payload';

export class WorldbookTaskIOError extends Error {
  readonly code: WorldbookTaskIOErrorCode;

  constructor(code: WorldbookTaskIOErrorCode, message: string) {
    super(message);
    this.name = 'WorldbookTaskIOError';
    this.code = code;
  }
}

export type WorldbookTaskStateExportFile = {
  type: typeof TASK_STATE_FILE_TYPE;
  version: number;
  exportedAt: string;
  payload: WorldbookPersistedTaskState;
};

export type WorldbookSettingsExportFile = {
  type: typeof SETTINGS_FILE_TYPE;
  version: number;
  exportedAt: string;
  worldbook: NovelWorldbookSettings;
};

export function exportTaskState(
  state: SaveWorldbookTaskStateInput | WorldbookPersistedTaskState,
  options: { pretty?: boolean } = {},
): string {
  const normalizedState = normalizeWorldbookPersistedTaskState({
    ...(state as Partial<WorldbookPersistedTaskState>),
    timestamp:
      typeof (state as Partial<WorldbookPersistedTaskState>).timestamp === 'number'
        ? (state as Partial<WorldbookPersistedTaskState>).timestamp
        : Date.now(),
  });

  const file: WorldbookTaskStateExportFile = {
    type: TASK_STATE_FILE_TYPE,
    version: CURRENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    payload: normalizedState,
  };

  return toJsonString(file, options.pretty ?? true);
}

export function importTaskState(raw: string): WorldbookPersistedTaskState {
  const parsed = parseJson(raw, '任务状态');
  const payload = extractTaskStatePayload(parsed);

  if (!isPlainObject(payload)) {
    throw new WorldbookTaskIOError('invalid_payload', '任务状态格式无效：payload 必须是对象');
  }

  return normalizeWorldbookPersistedTaskState(payload);
}

export function exportSettings(settings: NovelWorldbookSettings, options: { pretty?: boolean } = {}): string {
  const normalized = WorldbookSettingsSchema.parse(settings);

  const file: WorldbookSettingsExportFile = {
    type: SETTINGS_FILE_TYPE,
    version: CURRENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    worldbook: normalized,
  };

  return toJsonString(file, options.pretty ?? true);
}

export function importSettings(raw: string): NovelWorldbookSettings {
  const parsed = parseJson(raw, '世界书设置');
  const payload = extractSettingsPayload(parsed);

  const result = WorldbookSettingsSchema.safeParse(payload);
  if (!result.success) {
    throw new WorldbookTaskIOError('invalid_payload', `世界书设置格式无效：${formatZodError(result.error)}`);
  }

  return result.data;
}
