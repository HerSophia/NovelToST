import type { ChapterParseOptions, ChapterSegment } from '../../types/worldbook';

export const DEFAULT_CHAPTER_REGEX_PATTERN = '第[零一二三四五六七八九十百千万0-9]+[章回卷节部篇]';

type ChapterBoundary = {
  start: number;
  title: string;
};

function normalizeText(rawText: string): string {
  return rawText.replace(/\r\n?/g, '\n').trim();
}

function buildChapterRegex(options: ChapterParseOptions): RegExp {
  const pattern = options.useCustomChapterRegex
    ? options.chapterRegexPattern || DEFAULT_CHAPTER_REGEX_PATTERN
    : DEFAULT_CHAPTER_REGEX_PATTERN;

  try {
    return new RegExp(pattern, 'gm');
  } catch (error) {
    console.warn('[novelToST] 自定义章节正则无效，已使用默认章节规则', error);
    return new RegExp(DEFAULT_CHAPTER_REGEX_PATTERN, 'gm');
  }
}

function collectBoundaries(text: string, chapterRegex: RegExp): ChapterBoundary[] {
  const boundaries: ChapterBoundary[] = [];

  let match: RegExpExecArray | null;
  while ((match = chapterRegex.exec(text)) !== null) {
    const matched = (match[0] ?? '').trim();
    if (!matched) {
      chapterRegex.lastIndex += 1;
      continue;
    }

    const lineStart = text.lastIndexOf('\n', match.index) + 1;
    const nextLineBreak = text.indexOf('\n', match.index);
    const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
    const lineText = text.slice(lineStart, lineEnd).trim();
    const title = lineText || matched;

    const duplicated = boundaries[boundaries.length - 1]?.start === lineStart;
    if (!duplicated) {
      boundaries.push({ start: lineStart, title });
    }
  }

  return boundaries;
}

function createFallbackTitle(index: number, options: ChapterParseOptions): string {
  const prefix = options.fallbackTitlePrefix ?? '第';
  const suffix = options.fallbackTitleSuffix ?? '章';
  return `${prefix}${index}${suffix}`;
}

function pushChapter(
  chapters: ChapterSegment[],
  content: string,
  startOffset: number,
  endOffset: number,
  title: string,
): void {
  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }

  chapters.push({
    index: chapters.length,
    title,
    content: trimmed,
    startOffset,
    endOffset,
  });
}

export function splitTextToChapters(rawText: string, options: ChapterParseOptions): ChapterSegment[] {
  const text = normalizeText(rawText);
  if (!text) {
    return [];
  }

  const chapterRegex = buildChapterRegex(options);
  const boundaries = collectBoundaries(text, chapterRegex);

  if (boundaries.length === 0) {
    return [
      {
        index: 0,
        title: createFallbackTitle(1, options),
        content: text,
        startOffset: 0,
        endOffset: text.length,
      },
    ];
  }

  const chapters: ChapterSegment[] = [];

  const firstBoundary = boundaries[0];
  if (firstBoundary.start > 0) {
    const prefaceContent = text.slice(0, firstBoundary.start);
    pushChapter(chapters, prefaceContent, 0, firstBoundary.start, '序章');
  }

  boundaries.forEach((boundary, index) => {
    const nextBoundary = boundaries[index + 1];
    const start = boundary.start;
    const end = nextBoundary?.start ?? text.length;
    const chapterContent = text.slice(start, end);
    const fallbackTitle = createFallbackTitle(index + 1, options);
    pushChapter(chapters, chapterContent, start, end, boundary.title || fallbackTitle);
  });

  if (chapters.length === 0) {
    return [
      {
        index: 0,
        title: createFallbackTitle(1, options),
        content: text,
        startOffset: 0,
        endOffset: text.length,
      },
    ];
  }

  return chapters.map((chapter, index) => ({
    ...chapter,
    index,
    title: chapter.title || createFallbackTitle(index + 1, options),
  }));
}
