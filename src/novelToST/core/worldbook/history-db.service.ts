import type {
  MemoryChunk,
  WorldbookCategory,
  WorldbookEntry,
  WorldbookProcessError,
  WorldbookProcessStats,
  WorldbookRuntimeStatus,
  WorldbookTaskState,
} from '../../types/worldbook';

export const WORLDBOOK_HISTORY_DB_NAME = 'TxtToWorldbookDB';
export const WORLDBOOK_HISTORY_DB_VERSION = 1;

export const WORLDBOOK_HISTORY_STORE_NAME = 'history';
export const WORLDBOOK_META_STORE_NAME = 'meta';
export const WORLDBOOK_STATE_STORE_NAME = 'state';
export const WORLDBOOK_ROLL_STORE_NAME = 'rolls';
export const WORLDBOOK_CATEGORIES_STORE_NAME = 'categories';
export const WORLDBOOK_ENTRY_ROLL_STORE_NAME = 'entryRolls';

const CURRENT_STATE_KEY = 'currentState';
const CURRENT_FILE_HASH_KEY = 'currentFileHash';
const CUSTOM_CATEGORIES_KEY = 'customCategories';
const DEFAULT_ALLOWED_DUPLICATE_HISTORY_TITLES = ['记忆-优化', '记忆-演变总结'];

type WorldbookHistoryStoreName =
  | typeof WORLDBOOK_HISTORY_STORE_NAME
  | typeof WORLDBOOK_META_STORE_NAME
  | typeof WORLDBOOK_STATE_STORE_NAME
  | typeof WORLDBOOK_ROLL_STORE_NAME
  | typeof WORLDBOOK_CATEGORIES_STORE_NAME
  | typeof WORLDBOOK_ENTRY_ROLL_STORE_NAME;

type StoreKey = string | number;
type StoreRecord = Record<string, unknown>;

type StoreConfig = {
  keyPath: string;
  autoIncrement?: boolean;
  indexes?: string[];
};

const STORE_CONFIGS: Record<WorldbookHistoryStoreName, StoreConfig> = {
  [WORLDBOOK_HISTORY_STORE_NAME]: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: ['timestamp', 'memoryIndex', 'memoryTitle'],
  },
  [WORLDBOOK_META_STORE_NAME]: {
    keyPath: 'key',
  },
  [WORLDBOOK_STATE_STORE_NAME]: {
    keyPath: 'key',
  },
  [WORLDBOOK_ROLL_STORE_NAME]: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: ['memoryIndex', 'timestamp'],
  },
  [WORLDBOOK_CATEGORIES_STORE_NAME]: {
    keyPath: 'key',
  },
  [WORLDBOOK_ENTRY_ROLL_STORE_NAME]: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: ['entryKey', 'timestamp'],
  },
};

const RUNTIME_STATUSES: WorldbookRuntimeStatus[] = ['idle', 'preparing', 'running', 'paused', 'stopping', 'completed', 'error'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function toNonNegativeInteger(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(value));
}

function toNullableInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.trunc(value);
}

function normalizeRuntimeStatus(status: unknown): WorldbookRuntimeStatus {
  if (typeof status === 'string' && RUNTIME_STATUSES.includes(status as WorldbookRuntimeStatus)) {
    return status as WorldbookRuntimeStatus;
  }

  return 'idle';
}

function normalizeProcessError(error: unknown): WorldbookProcessError | null {
  if (!isPlainObject(error)) {
    return null;
  }

  const chunkId = typeof error.chunkId === 'string' ? error.chunkId : '';
  const message = typeof error.message === 'string' ? error.message : '';

  if (!chunkId && !message) {
    return null;
  }

  return {
    chunkId,
    chunkIndex: toNonNegativeInteger(error.chunkIndex, 0),
    message,
    timestamp: typeof error.timestamp === 'string' && error.timestamp ? error.timestamp : new Date().toISOString(),
  };
}

export function createDefaultWorldbookTaskState(): WorldbookTaskState {
  return {
    status: 'idle',
    totalChunks: 0,
    processedChunks: 0,
    failedChunks: 0,
    currentChunkId: null,
    startedAt: null,
    endedAt: null,
    errorMessage: null,
  };
}

export function createDefaultWorldbookProcessStats(): WorldbookProcessStats {
  return {
    startTime: null,
    endTime: null,
    processedChunks: 0,
    successfulChunks: 0,
    failedChunks: 0,
    generatedEntries: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    errors: [],
  };
}

function normalizeWorldbookTaskState(raw: unknown): WorldbookTaskState {
  const fallback = createDefaultWorldbookTaskState();
  if (!isPlainObject(raw)) {
    return fallback;
  }

  return {
    status: normalizeRuntimeStatus(raw.status),
    totalChunks: toNonNegativeInteger(raw.totalChunks, 0),
    processedChunks: toNonNegativeInteger(raw.processedChunks, 0),
    failedChunks: toNonNegativeInteger(raw.failedChunks, 0),
    currentChunkId: typeof raw.currentChunkId === 'string' && raw.currentChunkId ? raw.currentChunkId : null,
    startedAt: toNullableInteger(raw.startedAt),
    endedAt: toNullableInteger(raw.endedAt),
    errorMessage: typeof raw.errorMessage === 'string' && raw.errorMessage ? raw.errorMessage : null,
  };
}

function normalizeWorldbookProcessStats(raw: unknown): WorldbookProcessStats {
  const fallback = createDefaultWorldbookProcessStats();
  if (!isPlainObject(raw)) {
    return fallback;
  }

  const errors = Array.isArray(raw.errors)
    ? raw.errors.map(normalizeProcessError).filter((item): item is WorldbookProcessError => item !== null)
    : [];

  return {
    startTime: toNullableInteger(raw.startTime),
    endTime: toNullableInteger(raw.endTime),
    processedChunks: toNonNegativeInteger(raw.processedChunks, 0),
    successfulChunks: toNonNegativeInteger(raw.successfulChunks, 0),
    failedChunks: toNonNegativeInteger(raw.failedChunks, 0),
    generatedEntries: toNonNegativeInteger(raw.generatedEntries, 0),
    totalInputTokens: toNonNegativeInteger(raw.totalInputTokens, 0),
    totalOutputTokens: toNonNegativeInteger(raw.totalOutputTokens, 0),
    errors,
  };
}

function normalizeWorldbookData(value: unknown): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    return null;
  }

  return deepClone(value);
}

function normalizeWorldbookVolumes(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPlainObject).map((item) => deepClone(item));
}

export type WorldbookPersistedTaskState = {
  processedIndex: number;
  memoryQueue: MemoryChunk[];
  generatedEntries: WorldbookEntry[];
  categories: WorldbookCategory[];
  generatedWorldbook: Record<string, unknown> | null;
  worldbookVolumes: Array<Record<string, unknown>>;
  currentVolumeIndex: number;
  taskState: WorldbookTaskState;
  stats: WorldbookProcessStats;
  fileHash: string | null;
  novelName: string;
  timestamp: number;
};

export type SaveWorldbookTaskStateInput = Partial<Omit<WorldbookPersistedTaskState, 'timestamp'>> & {
  processedIndex: number;
  timestamp?: number;
};

export function normalizeWorldbookPersistedTaskState(
  raw: Partial<WorldbookPersistedTaskState> | Record<string, unknown>,
): WorldbookPersistedTaskState {
  const input = isPlainObject(raw) ? raw : {};

  const memoryQueue = Array.isArray(input.memoryQueue) ? (deepClone(input.memoryQueue) as MemoryChunk[]) : [];
  const generatedEntries = Array.isArray(input.generatedEntries) ? (deepClone(input.generatedEntries) as WorldbookEntry[]) : [];
  const categories = Array.isArray(input.categories) ? (deepClone(input.categories) as WorldbookCategory[]) : [];

  return {
    processedIndex: toNonNegativeInteger(input.processedIndex, 0),
    memoryQueue,
    generatedEntries,
    categories,
    generatedWorldbook: normalizeWorldbookData(input.generatedWorldbook),
    worldbookVolumes: normalizeWorldbookVolumes(input.worldbookVolumes),
    currentVolumeIndex: toNonNegativeInteger(input.currentVolumeIndex, 0),
    taskState: normalizeWorldbookTaskState(input.taskState),
    stats: normalizeWorldbookProcessStats(input.stats),
    fileHash: typeof input.fileHash === 'string' ? input.fileHash : null,
    novelName: typeof input.novelName === 'string' ? input.novelName : '',
    timestamp: toNonNegativeInteger(input.timestamp, Date.now()),
  };
}

export type WorldbookHistoryRecord = {
  id: number;
  timestamp: number;
  memoryIndex: number;
  memoryTitle: string;
  previousWorldbook: Record<string, unknown>;
  newWorldbook: Record<string, unknown>;
  changedEntries: unknown[];
  fileHash: string | null;
  volumeIndex: number;
};

export type SaveWorldbookHistoryInput = {
  memoryIndex: number;
  memoryTitle: string;
  previousWorldbook?: Record<string, unknown> | null;
  newWorldbook?: Record<string, unknown> | null;
  changedEntries?: unknown[];
  fileHash?: string | null;
  volumeIndex?: number;
  timestamp?: number;
  allowDuplicateTitles?: string[];
};

export type WorldbookRollRecord = {
  id: number;
  memoryIndex: number;
  result: unknown;
  timestamp: number;
};

export type WorldbookEntryRollRecord = {
  id: number;
  entryKey: string;
  category: string;
  entryName: string;
  memoryIndex: number;
  result: unknown;
  customPrompt: string;
  timestamp: number;
};

type WorldbookStateStoreRecord = WorldbookPersistedTaskState & {
  key: string;
};

type WorldbookMetaRecord = {
  key: string;
  value: unknown;
};

function normalizeHistoryRecord(raw: unknown): WorldbookHistoryRecord | null {
  if (!isPlainObject(raw)) {
    return null;
  }

  const id = toNonNegativeInteger(raw.id, 0);
  if (id <= 0) {
    return null;
  }

  return {
    id,
    timestamp: toNonNegativeInteger(raw.timestamp, Date.now()),
    memoryIndex: toNonNegativeInteger(raw.memoryIndex, 0),
    memoryTitle: typeof raw.memoryTitle === 'string' ? raw.memoryTitle : '',
    previousWorldbook: normalizeWorldbookData(raw.previousWorldbook) ?? {},
    newWorldbook: normalizeWorldbookData(raw.newWorldbook) ?? {},
    changedEntries: Array.isArray(raw.changedEntries) ? deepClone(raw.changedEntries) : [],
    fileHash: typeof raw.fileHash === 'string' ? raw.fileHash : null,
    volumeIndex: toNonNegativeInteger(raw.volumeIndex, 0),
  };
}

function normalizeRollRecord(raw: unknown): WorldbookRollRecord | null {
  if (!isPlainObject(raw)) {
    return null;
  }

  const id = toNonNegativeInteger(raw.id, 0);
  if (id <= 0) {
    return null;
  }

  return {
    id,
    memoryIndex: toNonNegativeInteger(raw.memoryIndex, 0),
    result: deepClone(raw.result),
    timestamp: toNonNegativeInteger(raw.timestamp, Date.now()),
  };
}

function normalizeEntryRollRecord(raw: unknown): WorldbookEntryRollRecord | null {
  if (!isPlainObject(raw)) {
    return null;
  }

  const id = toNonNegativeInteger(raw.id, 0);
  if (id <= 0) {
    return null;
  }

  const category = typeof raw.category === 'string' ? raw.category : '';
  const entryName = typeof raw.entryName === 'string' ? raw.entryName : '';
  const entryKey = typeof raw.entryKey === 'string' && raw.entryKey ? raw.entryKey : `${category}:${entryName}`;

  return {
    id,
    entryKey,
    category,
    entryName,
    memoryIndex: toNonNegativeInteger(raw.memoryIndex, 0),
    result: deepClone(raw.result),
    customPrompt: typeof raw.customPrompt === 'string' ? raw.customPrompt : '',
    timestamp: toNonNegativeInteger(raw.timestamp, Date.now()),
  };
}

export type WorldbookHistoryDbBackend = {
  init: () => Promise<void>;
  add: (storeName: WorldbookHistoryStoreName, value: StoreRecord) => Promise<number>;
  put: (storeName: WorldbookHistoryStoreName, value: StoreRecord) => Promise<void>;
  get: <T>(storeName: WorldbookHistoryStoreName, key: StoreKey) => Promise<T | null>;
  getAll: <T>(storeName: WorldbookHistoryStoreName) => Promise<T[]>;
  delete: (storeName: WorldbookHistoryStoreName, key: StoreKey) => Promise<void>;
  clear: (storeName: WorldbookHistoryStoreName) => Promise<void>;
  close: () => void;
};

export function createMemoryWorldbookHistoryDbBackend(): WorldbookHistoryDbBackend {
  const stores = Object.fromEntries(
    (Object.keys(STORE_CONFIGS) as WorldbookHistoryStoreName[]).map((storeName) => [storeName, new Map<StoreKey, StoreRecord>()]),
  ) as Record<WorldbookHistoryStoreName, Map<StoreKey, StoreRecord>>;

  const counters = Object.fromEntries(
    (Object.keys(STORE_CONFIGS) as WorldbookHistoryStoreName[]).map((storeName) => [storeName, 0]),
  ) as Record<WorldbookHistoryStoreName, number>;

  const resolveKey = (storeName: WorldbookHistoryStoreName, value: StoreRecord, allowAutoIncrement: boolean): StoreKey => {
    const config = STORE_CONFIGS[storeName];
    const current = value[config.keyPath];

    if (typeof current === 'string' || typeof current === 'number') {
      return current;
    }

    if (allowAutoIncrement && config.autoIncrement) {
      counters[storeName] += 1;
      return counters[storeName];
    }

    throw new Error(`[novelToST] ${storeName} 缺少主键字段 ${config.keyPath}`);
  };

  return {
    async init() {
      return;
    },

    async add(storeName: WorldbookHistoryStoreName, value: StoreRecord) {
      const store = stores[storeName];
      const key = resolveKey(storeName, value, true);
      if (store.has(key)) {
        throw new Error(`[novelToST] ${storeName} 主键冲突: ${String(key)}`);
      }

      const config = STORE_CONFIGS[storeName];
      const nextValue = {
        ...deepClone(value),
        [config.keyPath]: key,
      };

      store.set(key, nextValue);
      return typeof key === 'number' ? key : toNonNegativeInteger(Number(key), 0);
    },

    async put(storeName: WorldbookHistoryStoreName, value: StoreRecord) {
      const store = stores[storeName];
      const key = resolveKey(storeName, value, true);
      const config = STORE_CONFIGS[storeName];
      store.set(
        key,
        {
          ...deepClone(value),
          [config.keyPath]: key,
        },
      );
    },

    async get<T>(storeName: WorldbookHistoryStoreName, key: StoreKey): Promise<T | null> {
      const value = stores[storeName].get(key);
      if (value === undefined) {
        return null;
      }
      return deepClone(value) as T;
    },

    async getAll<T>(storeName: WorldbookHistoryStoreName): Promise<T[]> {
      return Array.from(stores[storeName].values()).map((value) => deepClone(value) as T);
    },

    async delete(storeName: WorldbookHistoryStoreName, key: StoreKey) {
      stores[storeName].delete(key);
    },

    async clear(storeName: WorldbookHistoryStoreName) {
      stores[storeName].clear();
    },

    close() {
      return;
    },
  };
}

type IndexedDbBackendOptions = {
  dbName: string;
  dbVersion: number;
  indexedDBFactory?: IDBFactory;
};

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB 请求失败'));
    };
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB 事务已中止'));
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB 事务失败'));
    };
  });
}

function normalizeGeneratedKey(key: IDBValidKey): number {
  if (typeof key === 'number' && Number.isFinite(key)) {
    return Math.trunc(key);
  }

  if (typeof key === 'string' && key) {
    const asNumber = Number(key);
    if (Number.isFinite(asNumber)) {
      return Math.trunc(asNumber);
    }
  }

  throw new Error(`[novelToST] IndexedDB 返回了无法识别的主键: ${String(key)}`);
}

function createIndexedDbWorldbookHistoryDbBackend(options: IndexedDbBackendOptions): WorldbookHistoryDbBackend {
  const factory = options.indexedDBFactory ?? globalThis.indexedDB;
  if (!factory) {
    throw new Error('[novelToST] 当前运行环境不支持 indexedDB');
  }

  let dbPromise: Promise<IDBDatabase> | null = null;
  let dbRef: IDBDatabase | null = null;

  const openDatabase = async (): Promise<IDBDatabase> => {
    if (dbRef) {
      return dbRef;
    }

    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(options.dbName, options.dbVersion);

      request.onupgradeneeded = () => {
        const db = request.result;
        const transaction = request.transaction;

        for (const storeName of Object.keys(STORE_CONFIGS) as WorldbookHistoryStoreName[]) {
          const config = STORE_CONFIGS[storeName];
          let store: IDBObjectStore;

          if (!db.objectStoreNames.contains(storeName)) {
            store = db.createObjectStore(storeName, {
              keyPath: config.keyPath,
              autoIncrement: Boolean(config.autoIncrement),
            });
          } else if (transaction) {
            store = transaction.objectStore(storeName);
          } else {
            continue;
          }

          for (const indexName of config.indexes ?? []) {
            if (!store.indexNames.contains(indexName)) {
              store.createIndex(indexName, indexName, { unique: false });
            }
          }
        }
      };

      request.onsuccess = () => {
        dbRef = request.result;
        dbRef.onversionchange = () => {
          dbRef?.close();
          dbRef = null;
          dbPromise = null;
        };
        resolve(dbRef);
      };

      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB 打开失败'));
      };
    });

    try {
      return await dbPromise;
    } catch (error) {
      dbPromise = null;
      throw error;
    }
  };

  const getStore = async (
    storeName: WorldbookHistoryStoreName,
    mode: IDBTransactionMode,
  ): Promise<{ store: IDBObjectStore; transaction: IDBTransaction }> => {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], mode);
    return {
      store: transaction.objectStore(storeName),
      transaction,
    };
  };

  return {
    async init() {
      await openDatabase();
    },

    async add(storeName: WorldbookHistoryStoreName, value: StoreRecord) {
      const { store, transaction } = await getStore(storeName, 'readwrite');
      const request = store.add(deepClone(value));
      const key = await requestToPromise(request);
      await waitForTransaction(transaction);
      return normalizeGeneratedKey(key);
    },

    async put(storeName: WorldbookHistoryStoreName, value: StoreRecord) {
      const { store, transaction } = await getStore(storeName, 'readwrite');
      await requestToPromise(store.put(deepClone(value)));
      await waitForTransaction(transaction);
    },

    async get<T>(storeName: WorldbookHistoryStoreName, key: StoreKey): Promise<T | null> {
      const { store, transaction } = await getStore(storeName, 'readonly');
      const result = await requestToPromise(store.get(key));
      await waitForTransaction(transaction);
      if (result === undefined) {
        return null;
      }
      return deepClone(result) as T;
    },

    async getAll<T>(storeName: WorldbookHistoryStoreName): Promise<T[]> {
      const { store, transaction } = await getStore(storeName, 'readonly');
      const result = await requestToPromise(store.getAll());
      await waitForTransaction(transaction);
      return deepClone(result) as T[];
    },

    async delete(storeName: WorldbookHistoryStoreName, key: StoreKey) {
      const { store, transaction } = await getStore(storeName, 'readwrite');
      await requestToPromise(store.delete(key));
      await waitForTransaction(transaction);
    },

    async clear(storeName: WorldbookHistoryStoreName) {
      const { store, transaction } = await getStore(storeName, 'readwrite');
      await requestToPromise(store.clear());
      await waitForTransaction(transaction);
    },

    close() {
      dbRef?.close();
      dbRef = null;
      dbPromise = null;
    },
  };
}

export type CreateWorldbookHistoryDbServiceOptions = {
  dbName?: string;
  dbVersion?: number;
  indexedDBFactory?: IDBFactory;
  backend?: WorldbookHistoryDbBackend;
  allowDuplicateTitles?: string[];
};

export function createWorldbookHistoryDBService(options: CreateWorldbookHistoryDbServiceOptions = {}) {
  const dbName = options.dbName ?? WORLDBOOK_HISTORY_DB_NAME;
  const dbVersion = options.dbVersion ?? WORLDBOOK_HISTORY_DB_VERSION;

  const backend =
    options.backend ??
    (options.indexedDBFactory || globalThis.indexedDB
      ? createIndexedDbWorldbookHistoryDbBackend({
          dbName,
          dbVersion,
          indexedDBFactory: options.indexedDBFactory,
        })
      : createMemoryWorldbookHistoryDbBackend());

  const allowDuplicateHistoryTitles = new Set(options.allowDuplicateTitles ?? DEFAULT_ALLOWED_DUPLICATE_HISTORY_TITLES);

  let initialized = false;

  const ensureReady = async () => {
    if (initialized) {
      return;
    }

    await backend.init();
    initialized = true;
  };

  const saveState = async (state: SaveWorldbookTaskStateInput): Promise<void> => {
    await ensureReady();

    const normalized = normalizeWorldbookPersistedTaskState({
      ...state,
      timestamp: state.timestamp ?? Date.now(),
    });

    const record: WorldbookStateStoreRecord = {
      key: CURRENT_STATE_KEY,
      ...normalized,
    };

    await backend.put(WORLDBOOK_STATE_STORE_NAME, record);
  };

  const loadState = async (): Promise<WorldbookPersistedTaskState | null> => {
    await ensureReady();

    const record = await backend.get<WorldbookStateStoreRecord>(WORLDBOOK_STATE_STORE_NAME, CURRENT_STATE_KEY);
    if (!record) {
      return null;
    }

    return normalizeWorldbookPersistedTaskState(record);
  };

  const clearState = async (): Promise<void> => {
    await ensureReady();
    await backend.delete(WORLDBOOK_STATE_STORE_NAME, CURRENT_STATE_KEY);
  };

  const saveHistory = async (input: SaveWorldbookHistoryInput): Promise<number> => {
    await ensureReady();

    const memoryTitle = input.memoryTitle.trim();
    if (!memoryTitle) {
      throw new Error('[novelToST] history memoryTitle 不能为空');
    }

    const allowDuplicateTitles = new Set(input.allowDuplicateTitles ?? Array.from(allowDuplicateHistoryTitles));
    if (!allowDuplicateTitles.has(memoryTitle)) {
      const duplicates = (await getAllHistory()).filter((record) => record.memoryTitle === memoryTitle);
      for (const duplicate of duplicates) {
        await backend.delete(WORLDBOOK_HISTORY_STORE_NAME, duplicate.id);
      }
    }

    const record: Omit<WorldbookHistoryRecord, 'id'> = {
      timestamp: toNonNegativeInteger(input.timestamp, Date.now()),
      memoryIndex: toNonNegativeInteger(input.memoryIndex, 0),
      memoryTitle,
      previousWorldbook: normalizeWorldbookData(input.previousWorldbook) ?? {},
      newWorldbook: normalizeWorldbookData(input.newWorldbook) ?? {},
      changedEntries: Array.isArray(input.changedEntries) ? deepClone(input.changedEntries) : [],
      fileHash: typeof input.fileHash === 'string' ? input.fileHash : null,
      volumeIndex: toNonNegativeInteger(input.volumeIndex, 0),
    };

    return backend.add(WORLDBOOK_HISTORY_STORE_NAME, record);
  };

  const getAllHistory = async (): Promise<WorldbookHistoryRecord[]> => {
    await ensureReady();

    const records = await backend.getAll<unknown>(WORLDBOOK_HISTORY_STORE_NAME);
    return records
      .map(normalizeHistoryRecord)
      .filter((item): item is WorldbookHistoryRecord => item !== null)
      .sort((a, b) => a.id - b.id);
  };

  const getHistoryById = async (id: number): Promise<WorldbookHistoryRecord | null> => {
    await ensureReady();

    const normalizedId = toNonNegativeInteger(id, 0);
    if (normalizedId <= 0) {
      return null;
    }

    const record = await backend.get<unknown>(WORLDBOOK_HISTORY_STORE_NAME, normalizedId);
    return normalizeHistoryRecord(record);
  };

  const clearAllHistory = async (): Promise<void> => {
    await ensureReady();
    await backend.clear(WORLDBOOK_HISTORY_STORE_NAME);
  };

  const rollbackToHistory = async (historyId: number): Promise<WorldbookHistoryRecord> => {
    const history = await getHistoryById(historyId);
    if (!history) {
      throw new Error('找不到指定的历史记录');
    }

    const allHistory = await getAllHistory();
    const toDelete = allHistory.filter((record) => record.id >= history.id);

    for (const record of toDelete) {
      await backend.delete(WORLDBOOK_HISTORY_STORE_NAME, record.id);
    }

    return deepClone(history);
  };

  const cleanDuplicateHistory = async (allowDuplicateTitles = Array.from(allowDuplicateHistoryTitles)): Promise<number> => {
    const allowSet = new Set(allowDuplicateTitles);
    const grouped = new Map<string, WorldbookHistoryRecord[]>();

    for (const record of await getAllHistory()) {
      if (!grouped.has(record.memoryTitle)) {
        grouped.set(record.memoryTitle, []);
      }
      grouped.get(record.memoryTitle)?.push(record);
    }

    let deletedCount = 0;

    for (const [memoryTitle, records] of grouped.entries()) {
      if (allowSet.has(memoryTitle) || records.length <= 1) {
        continue;
      }

      const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp || b.id - a.id);
      const toDelete = sorted.slice(1);
      for (const record of toDelete) {
        await backend.delete(WORLDBOOK_HISTORY_STORE_NAME, record.id);
        deletedCount += 1;
      }
    }

    return deletedCount;
  };

  const saveFileHash = async (hash: string): Promise<void> => {
    await ensureReady();
    await backend.put(WORLDBOOK_META_STORE_NAME, {
      key: CURRENT_FILE_HASH_KEY,
      value: hash,
    });
  };

  const getSavedFileHash = async (): Promise<string | null> => {
    await ensureReady();
    const record = await backend.get<WorldbookMetaRecord>(WORLDBOOK_META_STORE_NAME, CURRENT_FILE_HASH_KEY);
    if (!record || typeof record.value !== 'string') {
      return null;
    }

    return record.value;
  };

  const clearFileHash = async (): Promise<void> => {
    await ensureReady();
    await backend.delete(WORLDBOOK_META_STORE_NAME, CURRENT_FILE_HASH_KEY);
  };

  const saveCustomCategories = async (categories: unknown[]): Promise<void> => {
    await ensureReady();
    await backend.put(WORLDBOOK_CATEGORIES_STORE_NAME, {
      key: CUSTOM_CATEGORIES_KEY,
      value: deepClone(categories),
    });
  };

  const getCustomCategories = async (): Promise<unknown[] | null> => {
    await ensureReady();
    const record = await backend.get<WorldbookMetaRecord>(WORLDBOOK_CATEGORIES_STORE_NAME, CUSTOM_CATEGORIES_KEY);
    if (!record || !Array.isArray(record.value)) {
      return null;
    }

    return deepClone(record.value);
  };

  const saveRollResult = async (memoryIndex: number, result: unknown): Promise<number> => {
    await ensureReady();

    return backend.add(WORLDBOOK_ROLL_STORE_NAME, {
      memoryIndex: toNonNegativeInteger(memoryIndex, 0),
      result: deepClone(result),
      timestamp: Date.now(),
    });
  };

  const getRollResults = async (memoryIndex: number): Promise<WorldbookRollRecord[]> => {
    await ensureReady();

    const normalizedMemoryIndex = toNonNegativeInteger(memoryIndex, 0);
    const records = await backend.getAll<unknown>(WORLDBOOK_ROLL_STORE_NAME);

    return records
      .map(normalizeRollRecord)
      .filter((item): item is WorldbookRollRecord => item !== null)
      .filter((item) => item.memoryIndex === normalizedMemoryIndex)
      .sort((a, b) => b.timestamp - a.timestamp || b.id - a.id);
  };

  const clearRollResults = async (memoryIndex: number): Promise<void> => {
    const results = await getRollResults(memoryIndex);
    for (const result of results) {
      await backend.delete(WORLDBOOK_ROLL_STORE_NAME, result.id);
    }
  };

  const clearAllRolls = async (): Promise<void> => {
    await ensureReady();
    await backend.clear(WORLDBOOK_ROLL_STORE_NAME);
  };

  const saveEntryRollResult = async (
    category: string,
    entryName: string,
    memoryIndex: number,
    result: unknown,
    customPrompt = '',
  ): Promise<number> => {
    await ensureReady();

    const safeCategory = category.trim();
    const safeEntryName = entryName.trim();

    return backend.add(WORLDBOOK_ENTRY_ROLL_STORE_NAME, {
      entryKey: `${safeCategory}:${safeEntryName}`,
      category: safeCategory,
      entryName: safeEntryName,
      memoryIndex: toNonNegativeInteger(memoryIndex, 0),
      result: deepClone(result),
      customPrompt,
      timestamp: Date.now(),
    });
  };

  const getEntryRollResults = async (category: string, entryName: string): Promise<WorldbookEntryRollRecord[]> => {
    await ensureReady();

    const safeEntryKey = `${category.trim()}:${entryName.trim()}`;
    const records = await backend.getAll<unknown>(WORLDBOOK_ENTRY_ROLL_STORE_NAME);

    return records
      .map(normalizeEntryRollRecord)
      .filter((item): item is WorldbookEntryRollRecord => item !== null)
      .filter((item) => item.entryKey === safeEntryKey)
      .sort((a, b) => b.timestamp - a.timestamp || b.id - a.id);
  };

  const clearEntryRollResults = async (category: string, entryName: string): Promise<void> => {
    const results = await getEntryRollResults(category, entryName);
    for (const result of results) {
      await backend.delete(WORLDBOOK_ENTRY_ROLL_STORE_NAME, result.id);
    }
  };

  const clearAllEntryRolls = async (): Promise<void> => {
    await ensureReady();
    await backend.clear(WORLDBOOK_ENTRY_ROLL_STORE_NAME);
  };

  const deleteEntryRollById = async (rollId: number): Promise<void> => {
    await ensureReady();

    const normalizedId = toNonNegativeInteger(rollId, 0);
    if (normalizedId <= 0) {
      return;
    }

    await backend.delete(WORLDBOOK_ENTRY_ROLL_STORE_NAME, normalizedId);
  };

  const getEntryRollById = async (rollId: number): Promise<WorldbookEntryRollRecord | null> => {
    await ensureReady();

    const normalizedId = toNonNegativeInteger(rollId, 0);
    if (normalizedId <= 0) {
      return null;
    }

    const record = await backend.get<unknown>(WORLDBOOK_ENTRY_ROLL_STORE_NAME, normalizedId);
    return normalizeEntryRollRecord(record);
  };

  const openDB = async (): Promise<void> => {
    await ensureReady();
  };

  const close = (): void => {
    backend.close();
    initialized = false;
  };

  return {
    dbName,
    storeName: WORLDBOOK_HISTORY_STORE_NAME,
    metaStoreName: WORLDBOOK_META_STORE_NAME,
    stateStoreName: WORLDBOOK_STATE_STORE_NAME,
    rollStoreName: WORLDBOOK_ROLL_STORE_NAME,
    categoriesStoreName: WORLDBOOK_CATEGORIES_STORE_NAME,
    entryRollStoreName: WORLDBOOK_ENTRY_ROLL_STORE_NAME,

    openDB,
    close,

    saveState,
    loadState,
    clearState,

    saveHistory,
    getAllHistory,
    getHistoryById,
    clearAllHistory,
    rollbackToHistory,
    cleanDuplicateHistory,

    saveFileHash,
    getSavedFileHash,
    clearFileHash,

    saveCustomCategories,
    getCustomCategories,

    saveRollResult,
    getRollResults,
    clearRollResults,
    clearAllRolls,

    saveEntryRollResult,
    getEntryRollResults,
    clearEntryRollResults,
    clearAllEntryRolls,
    deleteEntryRollById,
    getEntryRollById,
  };
}

export type WorldbookHistoryDBService = ReturnType<typeof createWorldbookHistoryDBService>;

export const worldbookHistoryDB = createWorldbookHistoryDBService();
