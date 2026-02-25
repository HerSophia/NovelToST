import type { ChapterRecord, ExportFormat, ExportSnapshot } from '../types';

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function createSnapshot(format: ExportFormat, filename: string, chapters: ChapterRecord[]): ExportSnapshot {
  const totalCharacters = chapters.reduce((sum, chapter) => sum + chapter.content.length, 0);
  return {
    format,
    filename,
    chapterCount: chapters.length,
    totalCharacters,
    exportedAt: new Date().toISOString(),
  };
}

export function buildTxtContent(chapters: ChapterRecord[]): string {
  const totalCharacters = chapters.reduce((sum, chapter) => sum + chapter.content.length, 0);
  const lines = [
    `导出时间: ${new Date().toLocaleString()}`,
    `总章节: ${chapters.length}`,
    `总字数: ${totalCharacters}`,
    `${'═'.repeat(40)}`,
    '',
  ];

  for (const chapter of chapters) {
    lines.push(`══ [${chapter.floor}楼] ${chapter.role === 'user' ? '用户' : 'AI'} ══`);
    lines.push('');
    lines.push(chapter.content);
    lines.push('');
  }

  return lines.join('\n');
}

export function buildJsonContent(chapters: ChapterRecord[]): string {
  return JSON.stringify(
    {
      time: new Date().toISOString(),
      chapterCount: chapters.length,
      chapters,
    },
    null,
    2,
  );
}

export function exportTXT(chapters: ChapterRecord[], options: { silent?: boolean } = {}): ExportSnapshot {
  const filename = `novel_${chapters.length}ch_${Date.now()}.txt`;
  downloadFile(buildTxtContent(chapters), filename, 'text/plain');

  if (!options.silent) {
    toastr.success(`已导出 TXT（${chapters.length} 条）`);
  }

  return createSnapshot('txt', filename, chapters);
}

export function exportJSON(chapters: ChapterRecord[], options: { silent?: boolean } = {}): ExportSnapshot {
  const filename = `novel_${Date.now()}.json`;
  downloadFile(buildJsonContent(chapters), filename, 'application/json');

  if (!options.silent) {
    toastr.success(`已导出 JSON（${chapters.length} 条）`);
  }

  return createSnapshot('json', filename, chapters);
}
