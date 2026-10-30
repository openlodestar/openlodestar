// src/lodestar/packs/requirements.test.ts
/**
 * 策略包环境要求核对（开跑前探针）
 *
 * 核心断言：**声明才核对**。静态站领域（不声明 / 声明 optional）连插件都不实例化，
 * 不能因为引擎里加了这条通路就给它们凭空加一份浏览器依赖。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  registerBrowserPlugin,
  unregisterBrowserPlugin,
  type BrowserRenderer,
} from '@src/integrations/browser-plugins';
import { BrowserUnavailableError, isBrowserUnavailableError } from '@src/utils/browser-unavailable-error';
import porcelainPack from './porcelain';
import { assertPackRequirements, type RequirementProbe } from './requirements';
import type { DomainPack } from './pack';

const PLUGIN = 'fake-requirement-plugin';

/** 以瓷器包为底，只改 id 与 requirements（其余方法原样借用） */
function packWith(requirements: DomainPack['requirements'] | undefined): DomainPack {
  return { ...porcelainPack, id: 'porcelain-test', requirements };
}

function probeWith(renderer: BrowserRenderer, pluginName = PLUGIN): RequirementProbe & {
  resolveRenderer: ReturnType<typeof vi.fn>;
} {
  return { pluginName: () => pluginName, resolveRenderer: vi.fn(async () => renderer) };
}

afterEach(() => {
  unregisterBrowserPlugin(PLUGIN);
  delete process.env.BROWSER_PLUGIN;
});

describe('瓷器包声明浏览器为必备', () => {
  it('包自己说出来，而不是引擎写死', () => {
    expect(porcelainPack.requirements).toEqual({ browser: 'required' });
  });
});

describe('没声明就放行：静态站领域不受影响', () => {
  it('无 requirements 时连插件都不建', async () => {
    const probe = probeWith({ name: PLUGIN, render: async () => '' });
    await assertPackRequirements(packWith(undefined), probe);
    expect(probe.resolveRenderer).not.toHaveBeenCalled();
  });

  it('声明 optional 时同样不预检（只在抓不到时按需调用）', async () => {
    const probe = probeWith({ name: PLUGIN, render: async () => '' });
    await assertPackRequirements(packWith({ browser: 'optional' }), probe);
    expect(probe.resolveRenderer).not.toHaveBeenCalled();
  });
});

describe('声明 required 才核对', () => {
  it('探针通过即放行', async () => {
    const probeFn = vi.fn(async () => undefined);
    const probe = probeWith({ name: PLUGIN, render: async () => '', probe: probeFn });
    await assertPackRequirements(packWith({ browser: 'required' }), probe);
    expect(probe.resolveRenderer).toHaveBeenCalledTimes(1);
    expect(probeFn).toHaveBeenCalledTimes(1);
  });

  it('插件没有 probe 时按"建得出来就算可用"放行', async () => {
    const probe = probeWith({ name: PLUGIN, render: async () => '' });
    await expect(assertPackRequirements(packWith({ browser: 'required' }), probe)).resolves.toBeUndefined();
  });

  it('插件名不可用：报 not_installed，信息里有包名、插件名与安装提示', async () => {
    const probe: RequirementProbe = {
      pluginName: () => 'no-such-plugin',
      resolveRenderer: async () => {
        throw new Error('浏览器插件 "no-such-plugin" 既没有注册，也没有找到插件包 "@openlodestar/browser-no-such-plugin"');
      },
    };
    try {
      await assertPackRequirements(packWith({ browser: 'required' }), probe);
      expect.unreachable('插件不可用应当抛错');
    } catch (error) {
      expect(isBrowserUnavailableError(error)).toBe(true);
      if (isBrowserUnavailableError(error)) {
        expect(error.reason).toBe('not_installed');
        expect(error.message).toContain('porcelain-test');
        expect(error.message).toContain('no-such-plugin');
      }
    }
  });

  it('探针报"启动失败"：保留病因并补上哪个包要它', async () => {
    const probe = probeWith({
      name: PLUGIN,
      render: async () => '',
      probe: async () => {
        throw new BrowserUnavailableError('launch_failed', '浏览器启动失败：Executable doesn\'t exist');
      },
    });
    try {
      await assertPackRequirements(packWith({ browser: 'required' }), probe);
      expect.unreachable('探针失败应当抛错');
    } catch (error) {
      expect(isBrowserUnavailableError(error)).toBe(true);
      if (isBrowserUnavailableError(error)) {
        expect(error.reason).toBe('launch_failed');
        expect(error.message).toContain('porcelain-test');
        expect(error.message).toContain('Executable doesn');
        expect(error.message).toContain('换一个不需要浏览器的策略包');
      }
    }
  });

  it('探针抛非预期异常：一律归为 launch_failed，并给出可执行的安装提示', async () => {
    const probe = probeWith({
      name: PLUGIN,
      render: async () => '',
      probe: async () => {
        throw new Error('管道断了');
      },
    });
    try {
      await assertPackRequirements(packWith({ browser: 'required' }), probe);
      expect.unreachable('探针失败应当抛错');
    } catch (error) {
      expect(isBrowserUnavailableError(error)).toBe(true);
      if (isBrowserUnavailableError(error)) {
        expect(error.reason).toBe('launch_failed');
        expect(error.message).toContain('管道断了');
        expect(error.message).toContain('npx playwright install chromium');
        expect(error.message).toContain('换一个不需要浏览器的策略包');
      }
    }
  });
});

describe('缺省探针接的是插件注册表与环境变量', () => {
  it('BROWSER_PLUGIN 指向已注册插件时会被调用探针', async () => {
    const probeFn = vi.fn(async () => undefined);
    registerBrowserPlugin(PLUGIN, () => ({ name: PLUGIN, render: async () => '', probe: probeFn }));
    process.env.BROWSER_PLUGIN = PLUGIN;
    await assertPackRequirements(packWith({ browser: 'required' }));
    expect(probeFn).toHaveBeenCalledTimes(1);
  });

  it('BROWSER_PLUGIN 指向未注册名字时报错，不静默退回 playwright', async () => {
    process.env.BROWSER_PLUGIN = 'no-such-plugin';
    try {
      await assertPackRequirements(packWith({ browser: 'required' }));
      expect.unreachable('未知插件应当抛错');
    } catch (error) {
      expect(isBrowserUnavailableError(error)).toBe(true);
      if (isBrowserUnavailableError(error)) {
        expect(error.reason).toBe('not_installed');
        expect(error.message).toContain('no-such-plugin');
      }
    }
  });
});
