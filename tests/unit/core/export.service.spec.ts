import { buildJsonContent, buildTxtContent, exportJSON, exportTXT } from '@/novelToST/core/export.service';
import type { ChapterRecord } from '@/novelToST/types';
import { stMocks } from '../../setup/st-globals.mock';

const chapters: ChapterRecord[] = [
  {
    floor: 1,
    index: 1,
    role: 'assistant',
    name: 'AI',
    content: '第一章内容',
    message_id: 1,
  },
  {
    floor: 2,
    index: 2,
    role: 'user',
    name: 'User',
    content: '第二章内容',
    message_id: 2,
  },
];

describe('export.service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should build TXT content with summary and chapter blocks', () => {
    const content = buildTxtContent(chapters);

    expect(content).toContain('导出时间: ');
    expect(content).toContain('总章节: 2');
    expect(content).toContain(`总字数: ${'第一章内容'.length + '第二章内容'.length}`);
    expect(content).toContain('══ [1楼] AI ══');
    expect(content).toContain('══ [2楼] 用户 ══');
  });

  it('should build JSON content with metadata and chapters', () => {
    const content = buildJsonContent(chapters);
    const parsed = JSON.parse(content) as {
      time: string;
      chapterCount: number;
      chapters: ChapterRecord[];
    };

    expect(parsed.chapterCount).toBe(2);
    expect(parsed.time).toEqual(expect.any(String));
    expect(parsed.chapters).toEqual(chapters);
  });

  it('should export TXT and return snapshot', () => {
    const createObjectURL = vi.fn(() => 'blob:txt');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    vi.spyOn(Date, 'now').mockReturnValue(1735600000000);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const snapshot = exportTXT(chapters);

    expect(snapshot.format).toBe('txt');
    expect(snapshot.filename).toBe('novel_2ch_1735600000000.txt');
    expect(snapshot.chapterCount).toBe(2);
    expect(snapshot.totalCharacters).toBe('第一章内容'.length + '第二章内容'.length);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:txt');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(stMocks.toastr.success).toHaveBeenCalledWith('已导出 TXT（2 条）');
  });

  it('should export JSON silently without success toast', () => {
    const createObjectURL = vi.fn(() => 'blob:json');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    vi.spyOn(Date, 'now').mockReturnValue(1735600000001);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const snapshot = exportJSON(chapters, { silent: true });

    expect(snapshot.format).toBe('json');
    expect(snapshot.filename).toBe('novel_1735600000001.json');
    expect(snapshot.chapterCount).toBe(2);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:json');
    expect(stMocks.toastr.success).not.toHaveBeenCalled();
  });
});
