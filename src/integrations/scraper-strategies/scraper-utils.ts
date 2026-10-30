// src/integrations/scraper-strategies/scraper-utils.ts
/**
 * 抓取共享工具：HTML → 清洗正文
 *
 * 证据快照与模型读到的正文必须同源：`captureEvidencePage` 把这段清洗结果落盘，
 * 比对模型读的也是它——引文逐字命中才是可辩护的。
 */

import { createProcessor, HtmlProcessorType } from '../html-processors';

/**
 * 清理网页内容：去脚本/样式/注释，保留正文结构，解码常见实体，压缩空白。
 * 确定性：同一输入永远得到同一输出。
 */
export async function processHtml(html: string): Promise<string> {
  const processor = createProcessor(HtmlProcessorType.LEGACY_REGEX);
  const result = await processor.process(html);
  return result.content;
}
