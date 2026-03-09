import type { Ref } from 'vue';
import type {
  ChapterDetail,
  MasterOutlineNode,
  OutlineAIConfig,
  OutlineMissingDetailPolicy,
  OutlineMentionConfig,
  OutlineSession,
  Storyline,
} from '../../../types/outline';

export interface OutlineMutationContext {
  enabled: Ref<boolean>;
  missingDetailPolicy: Ref<OutlineMissingDetailPolicy>;
  storylines: Ref<Storyline[]>;
  masterOutline: Ref<MasterOutlineNode[]>;
  sessions: Ref<OutlineSession[]>;
  activeSessionId: Ref<string | null>;
  detailsByChapter: Ref<Record<number, ChapterDetail>>;
  ai: Ref<OutlineAIConfig>;
  mentionConfig: Ref<OutlineMentionConfig>;
  lockedStorylineIds: Ref<string[]>;
  lockedNodeIds: Ref<string[]>;
  touchUpdatedAt: () => void;
}
