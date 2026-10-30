// src/integrations/html-processors/index.ts
/**
 * HTML 清理处理器（只有一个实现：legacy-regex）
 *
 * 快照存的是**模型实际读过的那份清洗正文**。清洗必须是确定性的：
 * 同一页 HTML 任何时候清洗出来都逐字一致，否则引文逐字命中（证据必须自抓、引文必须逐字）会
 * 因处理差异大面积失败，最后逼出"放宽匹配"这种自我削弱的改动。
 */

import { LegacyRegexProcessor } from './processor-a-regex';
import { HtmlProcessorType, type HtmlProcessor, type ProcessorResult } from './types';

export { HtmlProcessorType } from './types';
export type { HtmlProcessor, ProcessorResult } from './types';

/** 创建处理器实例（保留工厂形态，便于将来添加别的实现） */
export function createProcessor(type: HtmlProcessorType = HtmlProcessorType.LEGACY_REGEX): HtmlProcessor {
  switch (type) {
    case HtmlProcessorType.LEGACY_REGEX:
      return new LegacyRegexProcessor();
    default:
      throw new Error(`Unsupported HTML processor: ${String(type)}`);
  }
}
