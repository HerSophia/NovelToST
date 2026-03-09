import type { OutlineMentionKind } from '../../../types/outline';

export function getWorkbenchMentionKindLabel(kind: OutlineMentionKind): string {
  if (kind === 'worldbook_entry') {
    return '世界书条目';
  }

  if (kind === 'worldbook') {
    return '世界书';
  }

  if (kind === 'foundation') {
    return '故事基底';
  }

  if (kind === 'storyline') {
    return '故事线';
  }

  return kind === 'detail' ? '章节细纲' : '大纲节点';
}
