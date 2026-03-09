import type { OutlineMentionKind } from '../../../types/outline';

export type WorkbenchMentionSourceFilterId = 'all' | 'foundation' | 'worldbook' | 'node';

export type WorkbenchMentionSourceFilter = {
  id: WorkbenchMentionSourceFilterId;
  label: string;
  kinds?: OutlineMentionKind[];
};

export const WORKBENCH_MENTION_SOURCE_FILTERS: WorkbenchMentionSourceFilter[] = [
  { id: 'all', label: '全部' },
  { id: 'foundation', label: '故事基底', kinds: ['foundation'] },
  { id: 'worldbook', label: '世界书', kinds: ['worldbook', 'worldbook_entry'] },
  { id: 'node', label: '大纲节点', kinds: ['node'] },
];
