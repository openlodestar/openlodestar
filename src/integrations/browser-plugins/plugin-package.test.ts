// src/integrations/browser-plugins/plugin-package.test.ts
/**
 * 独立插件包与引擎的跨包契约
 *
 * 插件包不 import 引擎源码，两边靠**结构**对接。这里在根仓库的编译单元里同时引入两端，
 * 把"结构兼容"与"错误可识别"钉死：
 * - 插件工厂的返回值必须能直接赋给引擎的 `BrowserRenderer`；
 * - 插件抛的"缺工具"错误没有继承引擎的错误类，引擎必须仍能按 `code` 认出来。
 */

import { describe, expect, it } from 'vitest';
import { findBrowserUnavailableError, isBrowserUnavailableError } from '@src/utils/browser-unavailable-error';
import { BrowserUnavailableError, PLUGIN_NAME, createRenderer } from '../../../plugins/browser-playwright/src/index';
import type { BrowserRenderer } from './types';

describe('@openlodestar/browser-playwright 与引擎的契约', () => {
  it('插件工厂的返回值满足引擎 BrowserRenderer（结构类型直接可赋值）', () => {
    const renderer: BrowserRenderer = createRenderer();
    expect(renderer.name).toBe(PLUGIN_NAME);
    expect(typeof renderer.render).toBe('function');
    expect(typeof renderer.probe).toBe('function');
  });

  it('插件的缺工具错误没有继承引擎的类，但引擎按 code 仍能识别', () => {
    const error = new BrowserUnavailableError('not_installed', '没有安装 playwright');
    expect(isBrowserUnavailableError(error)).toBe(true);
    expect(findBrowserUnavailableError(error)?.reason).toBe('not_installed');
  });

  it('插件名与引擎缺省插件名一致（换名字两边要一起改）', () => {
    expect(PLUGIN_NAME).toBe('playwright');
  });
});
