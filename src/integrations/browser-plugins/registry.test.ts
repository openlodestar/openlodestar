// src/integrations/browser-plugins/registry.test.ts
/**
 * 浏览器插件注册表：注册/注销、重名、未知名字、env 取名、按包名约定解析
 *
 * 核心断言：核心包**不自带** playwright 实现；缺省插件名仍是 `playwright`，
 * 但实现来自独立工作区包 `@openlodestar/browser-playwright`（按约定加载或显式注册）。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BROWSER_PLUGIN,
  browserPluginPackageName,
  createBrowserPlugin,
  getBrowserPluginFromEnv,
  listBrowserPlugins,
  normalizeBrowserPluginName,
  registerBrowserPlugin,
  resolveBrowserPlugin,
  unregisterBrowserPlugin,
} from './index';
import type { BrowserRenderer } from './types';

const TEST_NAME = 'fake-renderer';

function fakeRenderer(name = TEST_NAME): BrowserRenderer {
  return { name, render: async () => '<html></html>' };
}

afterEach(() => {
  unregisterBrowserPlugin(TEST_NAME);
  delete process.env.BROWSER_PLUGIN;
});

describe('注册表', () => {
  it('核心包不自带 playwright 实现；缺省名字仍是 playwright', () => {
    expect(DEFAULT_BROWSER_PLUGIN).toBe('playwright');
    expect(listBrowserPlugins()).not.toContain('playwright');
    expect(getBrowserPluginFromEnv()).toBe('playwright');
  });

  it('BROWSER_PLUGIN 覆盖缺省值，大小写与空白不敏感', () => {
    process.env.BROWSER_PLUGIN = '  PlayWright  ';
    expect(getBrowserPluginFromEnv()).toBe('playwright');
  });

  it('注册后可按名字建出来；注销后再建报错并给出安装/注册两条路', () => {
    registerBrowserPlugin(TEST_NAME, () => fakeRenderer());
    expect(createBrowserPlugin(TEST_NAME).name).toBe(TEST_NAME);
    unregisterBrowserPlugin(TEST_NAME);
    expect(() => createBrowserPlugin(TEST_NAME)).toThrow(/@openlodestar\/browser-fake-renderer/);
  });

  it('重名注册直接报错（不静默覆盖别人的实现）', () => {
    registerBrowserPlugin(TEST_NAME, () => fakeRenderer());
    expect(() => registerBrowserPlugin(TEST_NAME, () => fakeRenderer())).toThrow(/已经注册过/);
  });

  it('非法名字（空 / 非 slug）在注册时就被拒绝', () => {
    expect(() => registerBrowserPlugin('', () => fakeRenderer())).toThrow(/不能为空/);
    expect(() => registerBrowserPlugin('Bad Name', () => fakeRenderer())).toThrow(/slug/);
  });

  it('实例自报名字必须与注册名一致（否则报错指向哪份实现有问题）', () => {
    registerBrowserPlugin(TEST_NAME, () => fakeRenderer('另一个名字'));
    expect(() => createBrowserPlugin(TEST_NAME)).toThrow(/两者必须一致/);
  });

  it('名字归一函数只做大小写与空白处理', () => {
    expect(normalizeBrowserPluginName('  A-b  ')).toBe('a-b');
  });
});

describe('按包名约定解析插件', () => {
  it('包名约定：名字 foo → @openlodestar/browser-foo', () => {
    expect(browserPluginPackageName('foo')).toBe('@openlodestar/browser-foo');
    expect(browserPluginPackageName('  Foo  ')).toBe('@openlodestar/browser-foo');
  });

  it('已注册时直接用，不触发包加载', async () => {
    registerBrowserPlugin(TEST_NAME, () => fakeRenderer());
    const importer = vi.fn(async () => ({}));
    const renderer = await resolveBrowserPlugin(TEST_NAME, importer);
    expect(renderer.name).toBe(TEST_NAME);
    expect(importer).not.toHaveBeenCalled();
  });

  it('未注册时加载约定包并读 createRenderer', async () => {
    const importer = vi.fn(async (specifier: string) => {
      expect(specifier).toBe('@openlodestar/browser-fake-renderer');
      return { createRenderer: () => fakeRenderer() };
    });
    const renderer = await resolveBrowserPlugin(TEST_NAME, importer);
    expect(renderer.name).toBe(TEST_NAME);
    // 加载后会注册进注册表，第二次解析不再触发 import
    const again = await resolveBrowserPlugin(TEST_NAME, importer);
    expect(again.name).toBe(TEST_NAME);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('插件包默认导出工厂也认', async () => {
    const importer = async () => ({ default: () => fakeRenderer() });
    await expect(resolveBrowserPlugin(TEST_NAME, importer)).resolves.toMatchObject({ name: TEST_NAME });
  });

  it('包不存在时报错，信息里同时给出安装与注册两条路', async () => {
    const importer = async () => {
      throw new Error("Cannot find module '@openlodestar/browser-fake-renderer'");
    };
    try {
      await resolveBrowserPlugin(TEST_NAME, importer);
      expect.unreachable('找不到插件包应当抛错');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('npm i -D @openlodestar/browser-fake-renderer');
      expect(message).toContain('registerBrowserPlugin');
    }
  });

  it('插件包存在但没导出工厂 → 明确报契约错误', async () => {
    const importer = async () => ({ somethingElse: true });
    await expect(resolveBrowserPlugin(TEST_NAME, importer)).rejects.toThrow(/没有导出 createRenderer/);
  });

  it('非法名字在解析前就被拒绝（不去拼一个怪包名）', async () => {
    const importer = vi.fn(async () => ({}));
    await expect(resolveBrowserPlugin('Bad Name', importer)).rejects.toThrow(/slug/);
    expect(importer).not.toHaveBeenCalled();
  });
});
