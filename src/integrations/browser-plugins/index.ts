// src/integrations/browser-plugins/index.ts
/**
 * 浏览器渲染插件注册表
 *
 * 与搜索提供者同一套扩展方式：实现 `BrowserRenderer`，调用 `registerBrowserPlugin('名字', factory)`
 * 注册即可，引擎不 import 具体实现。缺省插件名 `playwright` 由**独立工作区包**
 * `plugins/browser-playwright` 提供（它自己声明 playwright 依赖），核心包不安装 playwright。
 *
 * 解析顺序（`resolveBrowserPlugin`）：
 * 1. 注册表里已有 → 直接用（显式注册优先，第三方插件与测试夹具都走这条）；
 * 2. 没有 → 按包名约定加载 `@openlodestar/browser-<名字>`，读出它的 `createRenderer()` 后注册；
 * 3. 两种都没有 → 报错并给出安装与注册两条路（不静默退回缺省实现）。
 */

import type { BrowserRenderer } from './types';

export type { BrowserRenderer, BrowserRenderOptions } from './types';

/** 插件工厂（每次按需建一个新实例） */
export type BrowserPluginFactory = () => BrowserRenderer;

/** 插件包入口的最小形状（约定：导出 `createRenderer` 或默认导出工厂） */
export interface BrowserPluginModule {
  createRenderer?: BrowserPluginFactory;
  default?: BrowserPluginFactory;
}

/** 缺省插件名 */
export const DEFAULT_BROWSER_PLUGIN = 'playwright';

/** 插件包命名约定：名字 `foo` → 包 `@openlodestar/browser-foo` */
export const BROWSER_PLUGIN_PACKAGE_PREFIX = '@openlodestar/browser-';

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const registry = new Map<string, BrowserPluginFactory>();

/** 名字大小写与首尾空白不敏感（与搜索提供者一致） */
export function normalizeBrowserPluginName(name: string): string {
  return name.trim().toLowerCase();
}

/** 插件名 → 约定包名 */
export function browserPluginPackageName(name: string): string {
  return `${BROWSER_PLUGIN_PACKAGE_PREFIX}${normalizeBrowserPluginName(name)}`;
}

/**
 * 注册一个浏览器插件。
 * 名字必须是小写 slug；重名直接报错（不静默覆盖别人的实现）。
 */
export function registerBrowserPlugin(name: string, factory: BrowserPluginFactory): void {
  const normalized = normalizeBrowserPluginName(name);
  assertPluginName(normalized, name);
  if (registry.has(normalized)) {
    throw new Error(`浏览器插件 "${normalized}" 已经注册过了；换一个名字，或先 unregisterBrowserPlugin()`);
  }
  registry.set(normalized, factory);
}

/** 注销插件（主要给测试与热替换用） */
export function unregisterBrowserPlugin(name: string): boolean {
  return registry.delete(normalizeBrowserPluginName(name));
}

/** 已注册的插件名（排序后返回，供报错与展示） */
export function listBrowserPlugins(): string[] {
  return [...registry.keys()].sort();
}

/** 按名字从注册表建实例；未注册的名字直接报配置错误，不静默退回缺省 */
export function createBrowserPlugin(name: string): BrowserRenderer {
  const normalized = normalizeBrowserPluginName(name);
  assertPluginName(normalized, name);
  const factory = registry.get(normalized);
  if (!factory) {
    const known = listBrowserPlugins().join(' / ') || '(空)';
    throw new Error(
      `浏览器插件 "${normalized}" 还没有注册（已注册：${known}）。` +
        `安装插件包：npm i -D ${browserPluginPackageName(normalized)}；` +
        `或在入口脚本里 import 插件并调用 registerBrowserPlugin('${normalized}', createRenderer)。`,
    );
  }
  const renderer = factory();
  if (renderer.name !== normalized) {
    throw new Error(`浏览器插件 "${normalized}" 的实例自报名字是 "${renderer.name}"，两者必须一致`);
  }
  return renderer;
}

/**
 * 解析插件：注册表优先，没有再按包名约定加载插件包。
 *
 * `importer` 可注入（测试用），缺省是原生动态 `import()`。
 * 包名约定只约定**在哪里找**，不约定实现是谁——换渲染引擎只需换插件包。
 */
export async function resolveBrowserPlugin(
  name: string,
  importer: (specifier: string) => Promise<unknown> = (specifier) => import(specifier),
): Promise<BrowserRenderer> {
  const normalized = normalizeBrowserPluginName(name);
  assertPluginName(normalized, name);
  if (registry.has(normalized)) return createBrowserPlugin(normalized);

  const specifier = browserPluginPackageName(normalized);
  let loaded: unknown;
  try {
    loaded = await importer(specifier);
  } catch (error) {
    throw new Error(
      `浏览器插件 "${normalized}" 既没有注册，也没有找到插件包 "${specifier}"。` +
        `安装：npm i -D ${specifier}；` +
        `或在入口脚本里 import 插件并调用 registerBrowserPlugin('${normalized}', createRenderer)。`,
      { cause: error },
    );
  }

  const factory = pickFactory(loaded);
  if (!factory) {
    throw new Error(
      `插件包 "${specifier}" 没有导出 createRenderer() 工厂（约定：具名导出 createRenderer 或默认导出）。`,
    );
  }
  registerBrowserPlugin(normalized, factory);
  return createBrowserPlugin(normalized);
}

/** 环境变量选择插件（缺省 playwright） */
export function getBrowserPluginFromEnv(): string {
  return normalizeBrowserPluginName(process.env.BROWSER_PLUGIN ?? DEFAULT_BROWSER_PLUGIN);
}

function assertPluginName(normalized: string, raw: string): void {
  if (normalized === '') {
    throw new Error('浏览器插件名不能为空');
  }
  if (!NAME_PATTERN.test(normalized)) {
    throw new Error(`浏览器插件名必须是 "-" 分隔的小写 slug（收到 "${raw}"）`);
  }
}

function pickFactory(loaded: unknown): BrowserPluginFactory | null {
  if (typeof loaded !== 'object' || loaded === null) return null;
  const candidate = loaded as BrowserPluginModule;
  if (typeof candidate.createRenderer === 'function') return candidate.createRenderer;
  if (typeof candidate.default === 'function') return candidate.default;
  return null;
}
