import type {
  ChapterDetail,
  MasterOutlineNode,
  OutlineMessage,
  OutlineMessageRole,
  OutlineSnapshot,
  OutlineMentionRef,
  OutlineMentionSnapshot,
  OutlineSessionType,
  Storyline,
} from '../../../types/outline';

export type CreateOutlineSessionInput = {
  type?: OutlineSessionType;
  title?: string;
  seed?: string;
  targetChapter?: number | null;
};

export type AppendOutlineMessageInput = {
  id?: string;
  role: OutlineMessageRole;
  text: string;
  createdAt?: string;
  /** 调试字段：结构化解析失败时记录错误 */
  parseError?: string | null;
  /** 调试字段：结构化解析失败时保留原始响应 */
  rawResponse?: string;
  /** Mention 字段：发送时记录引用对象（轻量引用） */
  mentions?: OutlineMentionRef[];
  /** Mention 字段：发送时固化的引用快照（用于重试可复现） */
  mentionSnapshots?: OutlineMentionSnapshot[];
  /** Mention 字段：解析/固化过程中产生的告警 */
  mentionWarnings?: string[];
};

export type AppendOutlineSnapshotInput = {
  id?: string;
  createdAt?: string;
  storylines?: Storyline[];
  masterOutline?: MasterOutlineNode[];
  detailsByChapter?: Record<number, ChapterDetail>;
};

export type ApplyOutlineSnapshotOptions = {
  /** 默认 false：仅应用 storylines + masterOutline，不覆盖 detailsByChapter */
  applyDetails?: boolean;
};

export type RemoveLastOutlineChatRoundResult = {
  removedMessages: OutlineMessage[];
  removedSnapshot: OutlineSnapshot | null;
  lastUserInstruction: string | null;
};
