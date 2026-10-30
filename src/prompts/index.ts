// src/prompts/index.ts
/**
 * Prompt 加载器
 *
 * 模板是 YAML 文件，落在 `src/prompts/<agentType>/base/`；`agentType` 目前有两个：
 * - `lodestar`：审计链的六个模板（提问、具体化、原子化、比对、检索增强提取、来源枚举）
 * - `shared`：跨链路共用的双语查询翻译模板
 *
 * 渲染支持：
 * - `{{variable}}` 变量插值；
 * - `{{rules}}` 自动填入模板 `rules` 列表里 `enabled: true` 的规则（连续编号）；
 * - 模板公共字段 `role` / `role_multimodal` / `output_format` 自动注入；
 * - 机制块 `{{#mechanism <id>}} … {{/mechanism}}`：未消融时剥标记留内容，消融时整块移除。
 *
 * 关键词 `enabled` 是硬要求：缺字段的规则会被静默丢弃——模板照样渲染、调用照样成功，
 * 只是纪律没送进模型。`src/lodestar/prompts.test.ts` 用断言钉住这一点。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { type AblationState, type MechanismId } from '../ablation';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** Prompt 模板基础信息 */
export interface PromptMetadata {
  name: string;
  version: string;
  last_updated: string;
  updated_by?: string;
  description?: string;
}

/** Prompt 规则 */
export interface PromptRule {
  name: string;
  enabled: boolean;
  content: string;
  description?: string;
}

/** LLM 参数配置 */
export interface LLMParams {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

/** Prompt 模板配置 */
export interface PromptTemplate extends PromptMetadata {
  template?: string;
  template_text_only?: string;
  template_with_image?: string;
  rules?: PromptRule[];
  llm_params?: LLMParams;
  [key: string]: unknown;
}

/** 加载器配置 */
export interface PromptLoaderConfig {
  agentType: 'lodestar' | 'shared';
  /** 自定义基础路径（测试用） */
  basePath?: string;
  enableCache?: boolean;
  cacheTtl?: number;
}

/** 渲染变量 */
export interface RenderVariables {
  [key: string]: unknown;
}

/** 渲染选项 */
export interface RenderOptions {
  /** 消融状态：机制块剥离依据；不传 = 无消融 */
  ablations?: AblationState;
}

function getPromptsBasePath(agentType: string, customBasePath?: string): string {
  if (customBasePath) return customBasePath;
  return path.join(moduleDir, agentType, 'base');
}

export class PromptLoader {
  private cache = new Map<string, { template: PromptTemplate; loadedAt: number }>();
  private basePath: string;
  private config: PromptLoaderConfig;

  constructor(config: PromptLoaderConfig) {
    this.config = { enableCache: true, cacheTtl: 3600, ...config };
    this.basePath = getPromptsBasePath(this.config.agentType, this.config.basePath);
  }

  /** 加载指定名称的模板（同名文件解析一次后缓存） */
  load(name: string): PromptTemplate {
    const cacheKey = `${this.config.agentType}:${name}`;
    const cached = this.cache.get(cacheKey);
    if (cached && this.config.enableCache) {
      const age = (Date.now() - cached.loadedAt) / 1000;
      if (age < (this.config.cacheTtl ?? 3600)) return cached.template;
    }

    const filePath = path.join(this.basePath, `${name}.yaml`);
    if (!fs.existsSync(filePath)) {
      const error = new Error(`Prompt template not found: ${filePath}`);
      (error as Error & { templateName?: string }).templateName = name;
      throw error;
    }
    const template = yaml.load(fs.readFileSync(filePath, 'utf-8')) as PromptTemplate;
    this.cache.set(cacheKey, { template, loadedAt: Date.now() });
    return template;
  }

  /**
   * 启用的规则列表（连续编号）。
   * 规则内容支持机制块语法：消融后整条为空的规则被跳过并重新编号。
   */
  getEnabledRules(template: PromptTemplate, ablations?: AblationState): string {
    if (!template.rules) return '';
    return template.rules
      .filter((rule) => rule.enabled)
      .map((rule) => this.stripMechanismBlocks(rule.content, ablations).trim())
      .filter((content) => content.length > 0)
      .map((content, index) => `${index + 1}. ${content}`)
      .join('\n');
  }

  /**
   * 剥离机制块（`{{#mechanism <id>}} … {{/mechanism}}`）
   *
   * - 未消融（或不传 ablations）：剥掉块标记，内容保留；
   * - 已消融：整块移除，不留残文本（约束文字与清单同生共死）。
   */
  private stripMechanismBlocks(content: string, ablations?: AblationState): string {
    if (!content.includes('{{#mechanism')) return content;
    const isOff = (mechanismId: string): boolean =>
      ablations?.isOff(mechanismId as MechanismId) ?? false;

    const linePattern =
      /^[ \t]*\{\{#mechanism ([a-zA-Z0-9_-]+)\}\}[ \t]*\r?\n([\s\S]*?)^[ \t]*\{\{\/mechanism\}\}[ \t]*(?:\r?\n|$)/gm;
    content = content.replace(linePattern, (_match, mechanismId: string, body: string) =>
      isOff(mechanismId) ? '' : body,
    );
    const inlinePattern = /\{\{#mechanism ([a-zA-Z0-9_-]+)\}\}([\s\S]*?)\{\{\/mechanism\}\}/g;
    return content.replace(inlinePattern, (_match, mechanismId: string, body: string) =>
      isOff(mechanismId) ? '' : body,
    );
  }

  /** 渲染模板 */
  render(name: string, variables: RenderVariables = {}, options?: RenderOptions): string {
    const template = this.load(name);
    let content = template.template || template.template_text_only || '';

    for (const field of ['role', 'role_multimodal', 'output_format']) {
      const value = template[field];
      if (typeof value === 'string') {
        content = content.replace(new RegExp(`\\{\\{${field}\\}\\}`, 'g'), value);
      }
    }

    if (variables.enabledRules) {
      const enabled = template.rules?.filter((rule) =>
        (variables.enabledRules as string[]).includes(rule.name),
      ) ?? [];
      const rulesText = this.stripMechanismBlocks(
        enabled.map((rule, index) => `${index + 1}. ${rule.content}`).join('\n'),
        options?.ablations,
      );
      content = content.replace(/\{\{rules\}\}/g, rulesText);
    } else {
      content = content.replace(/\{\{rules\}\}/g, this.getEnabledRules(template, options?.ablations));
    }

    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined && typeof value === 'string') {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }

    content = this.stripMechanismBlocks(content, options?.ablations);
    // 清理未替换的变量
    return content.replace(/\{\{[^}]+\}\}/g, '');
  }

  /** 获取模板的 LLM 参数 */
  getLLMParams(name: string): LLMParams {
    return this.load(name).llm_params ?? {};
  }

  /** 获取模板元数据 */
  getMetadata(name: string): PromptMetadata {
    const template = this.load(name);
    return {
      name: template.name,
      version: template.version,
      last_updated: template.last_updated,
      ...(template.updated_by ? { updated_by: template.updated_by } : {}),
      ...(template.description ? { description: template.description } : {}),
    };
  }

  /** 列出模板名（不含扩展名） */
  listTemplates(): string[] {
    if (!fs.existsSync(this.basePath)) return [];
    return fs
      .readdirSync(this.basePath)
      .filter((file) => file.endsWith('.yaml'))
      .map((file) => file.replace('.yaml', ''));
  }

  /** 清空缓存 */
  clearCache(): void {
    this.cache.clear();
  }
}

/** 创建 Lodestar（审计链）专用的 PromptLoader */
export function createLodestarLoader(): PromptLoader {
  return new PromptLoader({ agentType: 'lodestar' });
}

/** 创建跨链路共用（shared）的 PromptLoader */
export function createSharedLoader(): PromptLoader {
  return new PromptLoader({ agentType: 'shared' });
}

let globalLodestarLoader: PromptLoader | null = null;
let globalSharedLoader: PromptLoader | null = null;

/** 获取 Lodestar 全局 Loader */
export function getLodestarLoader(): PromptLoader {
  if (!globalLodestarLoader) globalLodestarLoader = createLodestarLoader();
  return globalLodestarLoader;
}

/** 获取 shared 全局 Loader */
export function getSharedLoader(): PromptLoader {
  if (!globalSharedLoader) globalSharedLoader = createSharedLoader();
  return globalSharedLoader;
}
