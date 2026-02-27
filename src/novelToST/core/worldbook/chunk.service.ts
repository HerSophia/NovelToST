import type { BuildMemoryChunksOptions, ChapterSegment, MemoryChunk, MemoryChunkSource } from '../../types/worldbook';
import { splitTextToChapters } from './parse.service';
import { estimateTokenCount } from './token.service';

export type ChunkMergeDirection = 'up' | 'down';

export type MergeAdjacentChunksResult = {
  chunks: MemoryChunk[];
  mergedChunk: MemoryChunk;
  mergedIndex: number;
  baseChunkId: string;
  removedChunkId: string;
};

type ChunkPart = {
  content: string;
  startOffset: number;
  endOffset: number;
};

type ChunkChapterOptions = {
  chunkSize: number;
  minChunkSize?: number;
};

function normalizeChunkSize(chunkSize: number): number {
  return Math.max(1, Math.trunc(chunkSize || 0));
}

function splitLargeText(content: string, maxLength: number): ChunkPart[] {
  const parts: ChunkPart[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    let end = Math.min(content.length, cursor + maxLength);

    if (end < content.length) {
      const softThreshold = cursor + Math.floor(maxLength * 0.6);
      const paragraphBreak = content.lastIndexOf('\n\n', end);
      const lineBreak = content.lastIndexOf('\n', end);

      if (paragraphBreak > softThreshold) {
        end = paragraphBreak + 2;
      } else if (lineBreak > softThreshold) {
        end = lineBreak + 1;
      }
    }

    const rawSlice = content.slice(cursor, end);
    const contentTrimmedStart = rawSlice.trimStart();
    const contentTrimmed = contentTrimmedStart.trimEnd();

    if (contentTrimmed) {
      const leading = rawSlice.length - contentTrimmedStart.length;
      const trailing = contentTrimmedStart.length - contentTrimmed.length;
      parts.push({
        content: contentTrimmed,
        startOffset: cursor + leading,
        endOffset: end - trailing,
      });
    }

    cursor = end;
    while (cursor < content.length && /\s/.test(content[cursor])) {
      cursor += 1;
    }
  }

  return parts;
}

function makeChunkTitle(sources: MemoryChunkSource[]): string {
  if (sources.length === 0) {
    return '分块';
  }
  if (sources.length === 1) {
    return sources[0].chapterTitle;
  }
  return `${sources[0].chapterTitle} ~ ${sources[sources.length - 1].chapterTitle}`;
}

function buildChunk(index: number, content: string, source: MemoryChunkSource[]): MemoryChunk {
  return {
    id: `wb-chunk-${index + 1}`,
    index,
    title: makeChunkTitle(source),
    content,
    estimatedTokens: estimateTokenCount(content),
    source,
    processed: false,
    failed: false,
    processing: false,
    retryCount: 0,
    errorMessage: null,
  };
}

function mergeSmallTailChunks(chunks: MemoryChunk[], minChunkSize: number): MemoryChunk[] {
  if (chunks.length <= 1 || minChunkSize <= 0) {
    return chunks;
  }

  const merged: MemoryChunk[] = [];

  for (const chunk of chunks) {
    const lastChunk = merged[merged.length - 1];
    if (lastChunk && chunk.content.length < minChunkSize) {
      const mergedSource = [...lastChunk.source, ...chunk.source];
      const mergedContent = `${lastChunk.content}\n\n${chunk.content}`.trim();
      merged[merged.length - 1] = {
        ...lastChunk,
        title: makeChunkTitle(mergedSource),
        content: mergedContent,
        source: mergedSource,
        estimatedTokens: estimateTokenCount(mergedContent),
      };
      continue;
    }

    merged.push(chunk);
  }

  return merged.map((chunk, index) => ({
    ...chunk,
    id: `wb-chunk-${index + 1}`,
    index,
  }));
}

export function chunkChapterSegments(chapters: ChapterSegment[], options: ChunkChapterOptions): MemoryChunk[] {
  const chunkSize = normalizeChunkSize(options.chunkSize);
  const minChunkSize = Math.max(0, Math.trunc(options.minChunkSize ?? Math.floor(chunkSize * 0.25)));

  if (chapters.length === 0) {
    return [];
  }

  const chunks: MemoryChunk[] = [];
  let bufferContent = '';
  let bufferSource: MemoryChunkSource[] = [];

  const flushBuffer = () => {
    const trimmed = bufferContent.trim();
    if (!trimmed) {
      bufferContent = '';
      bufferSource = [];
      return;
    }

    chunks.push(buildChunk(chunks.length, trimmed, bufferSource));
    bufferContent = '';
    bufferSource = [];
  };

  for (const chapter of chapters) {
    const chapterContent = chapter.content.trim();
    if (!chapterContent) {
      continue;
    }

    if (chapterContent.length > chunkSize) {
      flushBuffer();

      const pieces = splitLargeText(chapterContent, chunkSize);
      pieces.forEach((piece) => {
        const source: MemoryChunkSource[] = [
          {
            chapterIndex: chapter.index,
            chapterTitle: chapter.title,
            startOffset: chapter.startOffset + piece.startOffset,
            endOffset: chapter.startOffset + piece.endOffset,
          },
        ];
        chunks.push(buildChunk(chunks.length, piece.content, source));
      });

      continue;
    }

    const candidate = bufferContent ? `${bufferContent}\n\n${chapterContent}` : chapterContent;
    if (candidate.length > chunkSize && bufferContent) {
      flushBuffer();
    }

    bufferContent = bufferContent ? `${bufferContent}\n\n${chapterContent}` : chapterContent;
    bufferSource.push({
      chapterIndex: chapter.index,
      chapterTitle: chapter.title,
      startOffset: chapter.startOffset,
      endOffset: chapter.endOffset,
    });
  }

  flushBuffer();

  return mergeSmallTailChunks(chunks, minChunkSize);
}

function normalizeMergedSources(sources: MemoryChunkSource[]): MemoryChunkSource[] {
  const seen = new Set<string>();
  const result: MemoryChunkSource[] = [];

  for (const source of sources) {
    const key = `${source.chapterIndex}-${source.startOffset}-${source.endOffset}-${source.chapterTitle}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({
      chapterIndex: source.chapterIndex,
      chapterTitle: source.chapterTitle,
      startOffset: source.startOffset,
      endOffset: source.endOffset,
    });
  }

  return result.sort((a, b) => {
    if (a.chapterIndex !== b.chapterIndex) {
      return a.chapterIndex - b.chapterIndex;
    }
    if (a.startOffset !== b.startOffset) {
      return a.startOffset - b.startOffset;
    }
    return a.endOffset - b.endOffset;
  });
}

export function mergeAdjacentChunks(
  chunks: ReadonlyArray<MemoryChunk>,
  chunkIndex: number,
  direction: ChunkMergeDirection,
): MergeAdjacentChunksResult {
  if (chunks.length < 2) {
    throw new Error('至少需要两个记忆块才能执行合并');
  }

  const current = chunks[chunkIndex];
  if (!current) {
    throw new Error('未找到要合并的记忆块');
  }

  const baseIndex = direction === 'up' ? chunkIndex - 1 : chunkIndex;
  const appendIndex = direction === 'up' ? chunkIndex : chunkIndex + 1;
  const baseChunk = chunks[baseIndex];
  const appendChunk = chunks[appendIndex];

  if (!baseChunk || !appendChunk) {
    throw new Error(direction === 'up' ? '当前已是首块，无法向上合并' : '当前已是末块，无法向下合并');
  }

  const mergedSource = normalizeMergedSources([...baseChunk.source, ...appendChunk.source]);
  const mergedContent = `${baseChunk.content}\n\n${appendChunk.content}`.trim();
  const mergedChunk: MemoryChunk = {
    ...baseChunk,
    title: makeChunkTitle(mergedSource),
    content: mergedContent,
    source: mergedSource,
    estimatedTokens: estimateTokenCount(mergedContent),
    processed: false,
    failed: false,
    processing: false,
    retryCount: 0,
    errorMessage: null,
  };

  const nextChunks = chunks
    .filter((_, index) => index !== appendIndex)
    .map((chunk, index) => ({
      ...(index === baseIndex ? mergedChunk : chunk),
      index,
    }));

  return {
    chunks: nextChunks,
    mergedChunk: nextChunks[baseIndex],
    mergedIndex: baseIndex,
    baseChunkId: baseChunk.id,
    removedChunkId: appendChunk.id,
  };
}

export function buildMemoryChunksFromText(rawText: string, options: BuildMemoryChunksOptions): MemoryChunk[] {
  const chapters = splitTextToChapters(rawText, {
    chapterRegexPattern: options.chapterRegexPattern,
    useCustomChapterRegex: options.useCustomChapterRegex,
  });

  return chunkChapterSegments(chapters, {
    chunkSize: options.chunkSize,
    minChunkSize: options.minChunkSize,
  });
}
