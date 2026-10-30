// src/lodestar/packs/requirements.ts
/**
 * 策略包的环境要求核对（开跑前的探针）
 *
 * 为什么要在开跑前查，而不是等逐条断言撞上：一轮查询会先花检索、再花模型比对，
 * 而"浏览器没装"是**开跑前就能确定**的事实。等到第一条断言抓回空壳才报，
 * 前面烧掉的调用全成了沉没成本，界面上看到的还是一堆 `paused`——
 * 用户以为是"站不让我看"，其实是"我这台机器少装了一个包"。
 *
 * 反过来，静态站领域压根不该走这条通路：没声明 `browser: 'required'` 就直接放行，
 * 不实例化插件、不加载 playwright。
 */

import {
  getBrowserPluginFromEnv,
  resolveBrowserPlugin,
  type BrowserRenderer,
} from '@src/integrations/browser-plugins';
import { BrowserUnavailableError, isBrowserUnavailableError } from '@src/utils/browser-unavailable-error';
import type { DomainPack } from './pack';

/** 探针用到的插件接口（只依赖 `probe`，便于测试注入假实现） */
export interface RequirementProbe {
  resolveRenderer(): Promise<BrowserRenderer>;
  pluginName(): string;
}

function defaultProbe(): RequirementProbe {
  return {
    pluginName: getBrowserPluginFromEnv,
    resolveRenderer: () => resolveBrowserPlugin(getBrowserPluginFromEnv()),
  };
}

/**
 * 核对策略包声明的环境要求；不满足就抛 `BrowserUnavailableError`。
 *
 * 错误信息必须直接可执行：点明哪个包、哪个插件、装什么命令，以及"换个不要浏览器的包"这条路——
 * 否则用户只会看到"BROWSER_UNAVAILABLE"这个代码，不知道该做什么。
 */
export async function assertPackRequirements(
  pack: DomainPack,
  probe: RequirementProbe = defaultProbe(),
): Promise<void> {
  if (pack.requirements?.browser !== 'required') return;

  const pluginName = probe.pluginName();
  let renderer: BrowserRenderer;
  try {
    renderer = await probe.resolveRenderer();
  } catch (error) {
    throw new BrowserUnavailableError(
      'not_installed',
      `策略包 "${pack.id}" 声明浏览器为必备，但插件 "${pluginName}" 不可用：` +
        `${error instanceof Error ? error.message : String(error)}。` +
        `或换一个不需要浏览器的策略包。`,
      { cause: error },
    );
  }
  if (!renderer.probe) return;

  try {
    await renderer.probe();
  } catch (error) {
    // 用结构判定而不是 instanceof：插件是独立包，它抛的是自己那份错误类
    if (isBrowserUnavailableError(error)) {
      // 插件自己已经说清了病因（装没装 / 启不启得动），只补上"哪个包要它"
      throw new BrowserUnavailableError(
        error.reason,
        `策略包 "${pack.id}" 要求浏览器（插件 "${pluginName}"）：${error.message}。或换一个不需要浏览器的策略包。`,
        { cause: error },
      );
    }
    throw new BrowserUnavailableError(
      'launch_failed',
      `策略包 "${pack.id}" 的浏览器探针失败（插件 "${pluginName}"）：` +
        `${error instanceof Error ? error.message : String(error)}。` +
        `安装：npm i -D @openlodestar/browser-playwright && npx playwright install chromium；或换一个不需要浏览器的策略包。`,
      { cause: error },
    );
  }
}
