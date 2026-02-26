import { splitTextToChapters } from '@/novelToST/core/worldbook/parse.service';

describe('worldbook/parse.service', () => {
  it('should split text by default chapter regex', () => {
    const text = ['第1章 初遇', '主角来到城市。', '', '第2章 试炼', '冲突升级。'].join('\n');

    const chapters = splitTextToChapters(text, {
      chapterRegexPattern: 'ignored',
      useCustomChapterRegex: false,
    });

    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toContain('第1章');
    expect(chapters[1].title).toContain('第2章');
  });

  it('should fallback to single chapter when no chapter marker found', () => {
    const chapters = splitTextToChapters('这是一段没有章节标题的正文。', {
      chapterRegexPattern: 'ignored',
      useCustomChapterRegex: false,
    });

    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('第1章');
  });

  it('should support custom chapter regex', () => {
    const text = ['CHAPTER 1', 'alpha', '', 'CHAPTER 2', 'beta'].join('\n');

    const chapters = splitTextToChapters(text, {
      chapterRegexPattern: 'CHAPTER\\s+\\d+',
      useCustomChapterRegex: true,
      fallbackTitlePrefix: 'Chapter ',
      fallbackTitleSuffix: '',
    });

    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toContain('CHAPTER 1');
    expect(chapters[1].title).toContain('CHAPTER 2');
  });
});
