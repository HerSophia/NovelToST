import { extractTagContents, parseTagInput } from '@/novelToST/core/extract.service';

describe('extract.service', () => {
  describe('parseTagInput', () => {
    it('should return empty array when input is blank', () => {
      expect(parseTagInput('   ')).toEqual([]);
    });

    it('should parse tags with mixed separators', () => {
      const tags = parseTagInput('content, detail；正文\nmeta  ;  custom');
      expect(tags).toEqual(['content', 'detail', '正文', 'meta', 'custom']);
    });
  });

  describe('extractTagContents', () => {
    it('should extract matched contents by tag order', () => {
      const text = `
        <content> 第一段 </content>
        <detail lang="zh">第二段</detail>
        <CONTENT>第三段</CONTENT>
      `;

      const extracted = extractTagContents(text, ['content', 'detail'], '\n--\n');
      expect(extracted).toBe('第一段\n--\n第三段\n--\n第二段');
    });

    it('should return empty string when no tags matched', () => {
      const extracted = extractTagContents('<content>hello</content>', ['detail']);
      expect(extracted).toBe('');
    });
  });
});
