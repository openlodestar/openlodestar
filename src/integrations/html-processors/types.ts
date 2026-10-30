/**
 * HTML 处理器类型定义
 */

/**
 * HTML 处理器类型枚举
 */
export enum HtmlProcessorType {
  /**
   * 处理器 A：基于正则表达式的传统 HTML 清理
   * 特点：保留原始 HTML 结构，使用 250+ 行正则表达式清理
   */
  LEGACY_REGEX = 'legacy-regex',
  
  /**
   * 处理器 B：Readability + Turndown 方案
   * 特点：智能提取主要内容，转换为 Markdown，节省 60-80% token
   */
  READABILITY_TURNDOWN = 'readability-turndown',
}

/**
 * 处理器统计信息
 */
export interface ProcessorStats {
  /** 原始 HTML 长度（字符数） */
  originalLength: number;
  
  /** 处理后内容长度（字符数） */
  processedLength: number;
  
  /** 压缩率（0-1 之间，越小越好） */
  compressionRatio: number;
  
  /** 处理耗时（毫秒） */
  processingTimeMs: number;
  
  /** 预估 token 数（基于经验公式） */
  estimatedTokens: number;
  
  /** 处理器类型 */
  processorType: HtmlProcessorType;
}

/**
 * 处理器结果
 */
export interface ProcessorResult {
  /** 处理后的内容 */
  content: string;
  
  /** 处理统计信息 */
  stats: ProcessorStats;
  
  /** 处理过程中的警告信息 */
  warnings?: string[];
  
  /** 元数据（如 Readability 提取的标题、作者等） */
  metadata?: Record<string, any>;
}

/**
 * HTML 处理器接口
 */
export interface HtmlProcessor {
  /**
   * 处理器类型
   */
  readonly type: HtmlProcessorType;
  
  /**
   * 处理 HTML 内容
   * @param html - 原始 HTML 字符串
   * @returns 处理结果
   */
  process(html: string): Promise<ProcessorResult>;
  
  /**
   * 同步处理 HTML 内容（用于不需要异步操作的处理器）
   * @param html - 原始 HTML 字符串
   * @returns 处理结果
   */
  processSync?(html: string): ProcessorResult;
}
