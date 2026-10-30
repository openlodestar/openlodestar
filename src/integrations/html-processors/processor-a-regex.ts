/**
 * 处理器 A：基于正则表达式的传统 HTML 清理
 * 
 * 迁移自原有的 sanitizeHtml 函数，保留所有原始逻辑
 * 
 * 处理流程：
 * 1. 删除危险或无关标签：script、style、meta、link、svg、noscript、iframe、object、embed
 * 2. 删除 HTML 注释
 * 3. 提取 body 标签内的内容（如果存在）
 * 4. 智能保留有意义的属性
 * 5. 保留自闭合标签的完整结构
 * 6. 压缩空白字符，移除标签间的多余空格
 * 7. 删除空标签
 * 8. 解码 HTML 实体
 * 9. 规范化空白字符，限制输出长度最多 50000 字符
 */

import { type HtmlProcessor, HtmlProcessorType, type ProcessorResult, type ProcessorStats } from './types';

export class LegacyRegexProcessor implements HtmlProcessor {
  readonly type = HtmlProcessorType.LEGACY_REGEX;

  /**
   * 判断 CSS 类名是否为无意义的工具类
   */
  private isMeaninglessClass(className: string): boolean {
    if (!className) return true;
    
    const meaninglessPrefixes = [
      'p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-',
      'm-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-',
      'gap-', 'gap-x-', 'gap-y-', 'space-x-', 'space-y-',
      'w-', 'h-', 'max-w-', 'max-h-', 'min-w-', 'min-h-',
      'text-', 'font-', 'tracking-', 'leading-', 'list-',
      'whitespace-', 'break-',
      'block', 'inline', 'inline-block', 'inline-flex', 'inline-table',
      'flex', 'flex-', 'grid', 'grid-cols-', 'grid-rows-',
      'table', 'table-',
      'hidden', 'visible', 'invisible',
      'static', 'fixed', 'absolute', 'relative', 'sticky',
      'inset-', 'inset-x-', 'inset-y-',
      'top-', 'right-', 'bottom-', 'left-',
      'z-', 'order-',
      'justify-', 'items-', 'content-', 'self-',
      'align-', 'float-', 'clear-',
      'rounded', 'rounded-', 'border', 'border-',
      'divide-', 'divide-x', 'divide-y',
      'bg-', 'bg-opacity-', 'from-', 'via-', 'to-',
      'fill-', 'stroke-', 'stroke-width-',
      'shadow', 'shadow-', 'opacity-', 'blur', 'blur-',
      'brightness-', 'contrast-', 'drop-shadow', 'drop-shadow-',
      'grayscale', 'invert', 'sepia', 'hue-rotate-', 'saturate-',
      'transition', 'transition-', 'duration-', 'delay-', 'ease-',
      'animate-', 'transform', 'transform-',
      'rotate-', 'scale-', 'scale-x-', 'scale-y-',
      'translate-x-', 'translate-y-', 'skew-x-', 'skew-y-',
      'origin-',
      'cursor-', 'touch-', 'select-', 'resize', 'resize-',
      'scroll', 'scroll-', 'appearance-',
      'caret-', 'accent-', 'placeholder-',
      'decoration-', 'underline-offset-',
      'antialiased', 'subpixel-antialiased',
      'mix-blend-', 'bg-blend-',
      'backdrop-', 'backdrop-opacity-',
      'object-', 'overflow', 'overflow-', 'overflow-x-', 'overflow-y-',
      'outline-', 'ring', 'ring-', 'ring-opacity-', 'ring-offset-',
      'container', 'mx-auto', 'my-auto',
      'box-', 'isolate', 'isolation-',
      'pointer-events-', 'user-select-',
      'sr-only', 'not-sr-only',
      'hover:', 'focus:', 'active:', 'disabled:',
      'dark:', 'print:',
      'container', 'container-fluid', 'row', 'col', 'col-',
      'offset-', 'order-',
      'd-', 'flex-', 'justify-content-', 'align-items-', 'align-content-', 'align-self-',
      'm', 'mt-', 'mb-', 'ml-', 'mr-', 'mx-', 'my-',
      'fs-', 'fw-', 'text-', 'lh-',
      'text-lowercase', 'text-uppercase', 'text-capitalize',
      'btn', 'btn-',
      'fade', 'show', 'active', 'disabled',
      'valid-', 'invalid-', 'visually-hidden', 'stretched-link',
      'position-', 'top-', 'bottom-', 'start-', 'end-', 'translate-',
      'bg-gradient', 'clearfix', 'ratio', 'ratio-',
      'pe-', 'sc-', 'styled-', 'emotion-', 'css-',
    ];
    
    return meaninglessPrefixes.some(prefix => className.startsWith(prefix));
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
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gis, '');

    // 步骤 2: 删除 HTML 注释
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

    // 步骤 3: 提取 body 内容（如果存在）
    const bodyMatch = sanitized.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    sanitized = bodyMatch ? bodyMatch[1] : sanitized;

    // 步骤 4-5: 智能处理标签属性
    sanitized = sanitized.replace(/<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/g, (tag) => {
      const closingMatch = tag.match(/^<\/([a-zA-Z][a-zA-Z0-9]*)\s*>$/);
      if (closingMatch) {
        return tag;
      }

      const openingMatch = tag.match(/^<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>$/);
      if (!openingMatch) {
        return tag;
      }

      const tagName = openingMatch[1];
      const lowerTagName = tagName.toLowerCase();
      const attributesStr = openingMatch[2] || '';

      if (['script', 'style', 'meta', 'link', 'svg', 'noscript', 'iframe', 'object', 'embed'].includes(lowerTagName)) {
        return '';
      }

      if (!attributesStr.trim()) {
        return `<${tagName}>`;
      }

      const meaningfulAttributes: string[] = [];
      const attributeRegex = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let attrMatch;
      
      while ((attrMatch = attributeRegex.exec(attributesStr)) !== null) {
        const attrName = attrMatch[1].toLowerCase();
        const attrValue = attrMatch[2] || attrMatch[3] || attrMatch[4] || '';

        if (!attrValue && attrMatch[0].indexOf('=') === -1) {
          continue;
        }

        if (lowerTagName === 'img') {
          if (['src', 'alt'].includes(attrName)) {
            meaningfulAttributes.push(`${attrName}="${attrValue}"`);
          }
          continue;
        }

        if (lowerTagName === 'a') {
          if (attrName === 'href') {
            meaningfulAttributes.push(`${attrName}="${attrValue}"`);
          }
          continue;
        }

        if (lowerTagName === 'input') {
          if (['type', 'name', 'value', 'placeholder'].includes(attrName)) {
            meaningfulAttributes.push(`${attrName}="${attrValue}"`);
          }
          continue;
        }

        if (attrName === 'class') {
          const classes = attrValue.split(/\s+/).filter(cls => {
            return cls && !this.isMeaninglessClass(cls);
          });
          if (classes.length > 0) {
            meaningfulAttributes.push(`class="${classes.join(' ')}"`);
          }
          continue;
        }

        if (['id', 'title', 'name', 'value', 'placeholder', 'alt', 'role', 'aria-label', 'data-'].some(m => attrName === m || attrName.startsWith(m))) {
          meaningfulAttributes.push(`${attrName}="${attrValue}"`);
        }
      }

      if (meaningfulAttributes.length === 0) {
        return `<${tagName}>`;
      } else {
        return `<${tagName} ${meaningfulAttributes.join(' ')}>`;
      }
    });

    // 步骤 6: 压缩标签间的空白字符
    sanitized = sanitized.replace(/>\s+</g, '><');

    // 步骤 7: 递归删除嵌套的空标签
    let previousSanitized;
    do {
      previousSanitized = sanitized;
      sanitized = sanitized.replace(/<(p|div|span|h[1-6]|li|a|td|th|section|article|header|footer|nav|main|aside|button|input)(\s[^>]*)?>[\s\u00A0]*<\/\1>/gi, '');
    } while (sanitized !== previousSanitized);

    // 步骤 8: 解码 HTML 实体
    const entityMap: { [key: string]: string } = {
      '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"',
      '&#39;': "'", '&apos;': "'", '&copy;': '©', '&reg;': '®', '&trade;': '™',
      '&mdash;': '—', '&ndash;': '–', '&lsquo;': '\u2018', '&rsquo;': '\u2019',
      '&ldquo;': '"', '&rdquo;': '"', '&bull;': '•', '&hellip;': '…',
    };
    sanitized = sanitized.replace(/&[a-zA-Z0-9#]+;/g, (entity) => entityMap[entity] || entity);

    // 步骤 9: 规范化空白字符并限制长度
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
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
      },
    };
  }

  async process(html: string): Promise<ProcessorResult> {
    return Promise.resolve(this.processSync(html));
  }
}
