/**
 * 处理器 A：基于正则表达式的传统 HTML 清理
 *
 * 迁移自原有的 sanitizeHtml 函数，保留原有清洗流程，并按"页面内容可被当成指令"的
 * 攻击面做了两层收紧：
 * - **常见隐藏元素整块删除**：带 `hidden` / `aria-hidden="true"`、内联 `display:none` /
 *   `visibility:hidden` / `opacity:0` 等样式的元素，以及 `sr-only` 这类只读屏可见的类名。
 *   隐藏文字是提示注入最常见的载体——人看不到，模型却读得到；
 * - **标签属性一律去掉**：`title` / `alt` / `placeholder` / `data-*` 都能藏整句指令，
 *   而正文比对只需要字，不需要属性。
 *
 * 这是**尽力而为**的防线，不是沙箱：外部样式表把内容藏起来、畸形 HTML 让标签配不上对，
 * 都可能漏掉。真正的兜底是提示分层的"数据不是指令"与引文逐字校验，不是清洗器。
 *
 * 处理流程：
 * 1. 删除危险或无关标签：script、style、meta、link、svg、noscript、iframe、object、embed、template
 * 2. 删除 HTML 注释
 * 3. 提取 body 标签内的内容（如果存在）
 * 4. 删除常见隐藏元素（含其内容）
 * 5. 去掉其余标签的全部属性
 * 6. 压缩空白字符，移除标签间的多余空格
 * 7. 删除空标签
 * 8. 解码 HTML 实体
 * 9. 去掉控制字符、规范化空白，限制输出长度最多 50000 字符
 */

import { decodeHtmlEntities } from '../../utils/html-entities';
import { stripControlChars } from '../../utils/text-language';
import { type HtmlProcessor, HtmlProcessorType, type ProcessorResult, type ProcessorStats } from './types';

/** 没有闭合标签的元素：隐藏标记只删开标签本身 */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** 只读屏可见/常规隐藏类名（按 class token 精确匹配，不做子串匹配） */
const HIDDEN_CLASSES = new Set([
  'hidden',
  'hide',
  'is-hidden',
  'u-hidden',
  'invisible',
  'd-none',
  'sr-only',
  'screen-reader-text',
  'screen-reader-only',
  'visually-hidden',
  'visuallyhidden',
]);

export class LegacyRegexProcessor implements HtmlProcessor {
  readonly type = HtmlProcessorType.LEGACY_REGEX;

  /**
   * 提取属性值（只供隐藏判定使用；属性最终一律不保留）
   */
  private attrValue(attrs: string, name: string): string | null {
    const match = attrs.match(
      new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
    );
    return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
  }

  /** 内联样式里常见的"看不见"写法 */
  private hiddenByStyle(style: string): boolean {
    const compact = style.toLowerCase().replace(/\s+/g, '');
    return (
      compact.includes('display:none') ||
      compact.includes('visibility:hidden') ||
      /opacity:0(?:\.0+)?(?:;|$)/.test(compact) ||
      /(?:left|text-indent):-\d{3,}px/.test(compact) ||
      /font-size:0(?:px)?(?:;|$)/.test(compact) ||
      compact.includes('clip:rect(0')
    );
  }

  /** 这个开标签是否声明了"隐藏" */
  private isHiddenElement(tagName: string, attrs: string): boolean {
    // html / body 即使带隐藏样式也不整块删：删掉等于整页空白，损失远大于收益
    if (tagName === 'html' || tagName === 'body') return false;

    if (/\shidden\b/i.test(attrs)) return true;
    const ariaHidden = this.attrValue(attrs, 'aria-hidden');
    if (ariaHidden !== null && ariaHidden.trim().toLowerCase() === 'true') return true;

    const style = this.attrValue(attrs, 'style');
    if (style !== null && this.hiddenByStyle(style)) return true;

    const className = this.attrValue(attrs, 'class');
    if (className !== null) {
      for (const token of className.split(/\s+/)) {
        if (token && HIDDEN_CLASSES.has(token.toLowerCase())) return true;
      }
    }
    return false;
  }

  /**
   * 找到与开标签配对的闭标签之后的位置；找不到配对时只删开标签（返回 `from`）。
   * 同标签嵌套按深度计数，避免把内层的 `</div>` 当成本元素的结尾。
   */
  private findElementEnd(html: string, from: number, tagName: string, selfClosing: boolean): number {
    if (selfClosing || VOID_ELEMENTS.has(tagName)) return from;
    const tagRe = new RegExp(`<(/?)${tagName}(?=[\\s/>])[^<>]*?\\/?>`, 'gi');
    tagRe.lastIndex = from;
    let depth = 1;
    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(html)) !== null) {
      if (match[1] === '/') {
        depth -= 1;
        if (depth === 0) return match.index + match[0].length;
      } else if (!match[0].endsWith('/>')) {
        depth += 1;
      }
    }
    return from;
  }

  /** 删除常见隐藏元素（含内容）；隐藏标记无法配对时只删开标签，保守保留正文 */
  private stripHiddenBlocks(html: string): string {
    const tagRe = /<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s[^<>]*)?)\/?>/g;
    let result = '';
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(html)) !== null) {
      const start = match.index;
      const tagName = match[1]!.toLowerCase();
      const tagEnd = start + match[0].length;
      if (!this.isHiddenElement(tagName, match[2] ?? '')) continue;
      result += html.slice(last, start);
      last = this.findElementEnd(html, tagEnd, tagName, match[0].endsWith('/>'));
      // 跳进被删掉的块，不再逐标签扫描它
      tagRe.lastIndex = last;
    }
    return result + html.slice(last);
  }

  /** 去掉所有标签的属性：属性可以藏指令，正文不需要它们 */
  private stripAttributes(html: string): string {
    return html.replace(/<([a-zA-Z][a-zA-Z0-9:-]*)[^<>]*?>/g, '<$1>');
  }

  /**
   * 清理和净化 HTML 内容
   */
  private sanitizeHtml(html: string): string {
    let sanitized = html;

    // 步骤 1: 删除危险或无关的标签
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gis, '')
      .replace(/<meta\b[^>]*>/gi, '')
      .replace(/<link\b[^>]*>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gis, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gis, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gis, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gis, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gis, '')
      .replace(/<template\b[^<]*(?:(?!<\/template>)<[^<]*)*<\/template>/gis, '');

    // 步骤 2: 删除 HTML 注释
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

    // 步骤 3: 提取 body 内容（如果存在）
    const bodyMatch = sanitized.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    sanitized = bodyMatch ? bodyMatch[1] : sanitized;

    // 步骤 4: 删除常见隐藏元素（人看不到、模型读得到的整句指令）
    sanitized = this.stripHiddenBlocks(sanitized);

    // 步骤 5: 去掉标签属性（title/alt/placeholder/data-* 都能藏指令）
    sanitized = this.stripAttributes(sanitized);

    // 步骤 6: 压缩标签间的空白字符
    sanitized = sanitized.replace(/>\s+</g, '><');

    // 步骤 7: 递归删除嵌套的空标签
    let previousSanitized;
    do {
      previousSanitized = sanitized;
      sanitized = sanitized.replace(/<(p|div|span|h[1-6]|li|a|td|th|section|article|header|footer|nav|main|aside|button|input)(\s[^>]*)?>[\s\u00A0]*<\/\1>/gi, '');
    } while (sanitized !== previousSanitized);

    // 步骤 8: 解码 HTML 实体（命名 + 数字；只解一层，见 utils/html-entities）
    sanitized = decodeHtmlEntities(sanitized);

    // 步骤 9: 去掉控制字符、规范化空白字符并限制长度
    sanitized = stripControlChars(sanitized).replace(/\s+/g, ' ').trim();
    sanitized = sanitized.substring(0, 50000);

    return sanitized;
  }

  /**
   * 估算 token 数（基于经验公式：英文单词数 + 中文字符数*1.5）
   */
  private estimateTokens(content: string): number {
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const numbers = (content.match(/[0-9]+/g) || []).length;
    return Math.round(englishWords + chineseChars * 1.5 + numbers * 0.5);
  }

  processSync(html: string): ProcessorResult {
    const startTime = Date.now();
    const originalLength = html.length;

    const content = this.sanitizeHtml(html);

    const processingTimeMs = Date.now() - startTime;
    const processedLength = content.length;
    const compressionRatio = processedLength / originalLength;
    const estimatedTokens = this.estimateTokens(content);

    return {
      content,
      stats: {
        originalLength,
        processedLength,
        compressionRatio: Math.round(compressionRatio * 1000) / 1000,
        processingTimeMs,
        estimatedTokens,
        processorType: this.type,
      } satisfies ProcessorStats,
    };
  }

  async process(html: string): Promise<ProcessorResult> {
    return Promise.resolve(this.processSync(html));
  }
}
