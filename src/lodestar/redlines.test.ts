// src/lodestar/redlines.test.ts
/**
 * 红线可执行守卫（离线，纯文本扫描 + 纯函数断言）
 *
 * 出处：包内 `docs/` 之外、随共享层一起迁入的几条硬约束——引文必须自抓且逐字、
 * 引擎不读宿主数据、域知识只活在策略包、索引开关全关、弱坐标不进候选。
 * 母仓里与"宿主"有关的那几条（坐标指针形状、线上进程不引写路径、下游不读指针）
 * 留在母仓自己的测试里；这里只钉**包内**能自己负责的部分。
 *
 * 分工（避免与单测重复）：
 * - 逐字匹配本体在 `adjudicate/compare.ts`，事后护栏脚本在仓库 `scripts/lodestar-verify-quotes.ts`；
 *   母仓的脚本是否复用这一份由母仓的守卫检查；
 * - 索引开关全关在 `storage/file-store.test.ts`；
 * - 弱坐标不进候选在 `record-gate/source-anchor.test.ts` 与 `anchor-source` 的读法上。
 *
 * 一句话：这里的断言只回答"包自己有没有偷偷依赖宿主"。
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 递归收集源码文件（跳过测试自身——它合法地写着被禁的词） */
function sourceFiles(relativeDir: string, predicate: (file: string) => boolean = () => true): string[] {
  const dir = path.join(PACKAGE_ROOT, relativeDir);
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(path.relative(PACKAGE_ROOT, absolute), predicate));
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.test.ts')) continue;
    if (!predicate(absolute)) continue;
    out.push(absolute);
  }
  return out;
}

function violations(files: string[], pattern: RegExp, label: string): string[] {
  const found: string[] = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      // 注释行不算违反：红线约束的是代码行为，说明为什么允许写的注释不该被自己绊倒
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (pattern.test(line)) {
        found.push(`${path.relative(PACKAGE_ROOT, file)}:${index + 1} ${trimmed.slice(0, 90)}`);
      }
    });
  }
  return found.length > 0 ? [`【${label}】\n  ${found.join('\n  ')}`] : [];
}

/** 引擎核心：存储、摄入、裁决、记录门禁、策略包契约与引擎主循环 */
function engineCoreFiles(): string[] {
  return ['storage', 'intake', 'adjudicate', 'record-gate', 'packs']
    .flatMap((dir) => sourceFiles(path.join('src', 'lodestar', dir)))
    .concat(path.join(PACKAGE_ROOT, 'src', 'lodestar', 'engine.ts'))
    .filter((f) => fs.existsSync(f));
}

describe('引擎不读宿主数据：证据路径只有"本次自抓"', () => {
  it('核心目录里没有宿主库连接与语料层的 import', () => {
    const findings = violations(
      engineCoreFiles(),
      /from\s+['"](?:@src\/(?:db|corpus)|[^'"]*\/(?:db|corpus))['"]/,
      '引擎核心不得引用宿主库连接层与语料层',
    );
    expect(findings).toEqual([]);
  });

  it('核心目录里不出现语料写函数标识符（写入口只属于宿主产品自己的记录器）', () => {
    const findings = violations(
      engineCoreFiles(),
      /\b(upsertPage|recordEvent|mergeEventByKey|attachEventToCluster|mergeByKey)\b/,
      '引擎核心不得调用语料写入函数',
    );
    expect(findings).toEqual([]);
  });

  it('证据抓取路径上不出现宿主派生表（价格事件 / 报告 / 资产）', () => {
    const pageFetch = path.join(PACKAGE_ROOT, 'src', 'lodestar', 'adjudicate', 'page-fetch.ts');
    const text = fs.readFileSync(pageFetch, 'utf8');
    expect(text).not.toMatch(/priceEvents|price_reports|shadowAssets/);
  });
});

describe('域知识不进引擎：拍行域名与中文列名只活在策略包', () => {
  it('核心目录里不出现具体拍行域名与中文列名', () => {
    const coreFiles = ['storage', 'adjudicate', 'record-gate']
      .flatMap((dir) => sourceFiles(path.join('src', 'lodestar', dir)))
      .concat(path.join(PACKAGE_ROOT, 'src', 'lodestar', 'engine.ts'))
      .filter((f) => fs.existsSync(f) && !f.includes(`${path.sep}packs${path.sep}`));

    const findings = violations(coreFiles, /cguardian|polypm|sothebys|christies|拍卖行'|专场名称/, '引擎核心出现域内具体词');
    expect(findings).toEqual([]);
  });
});

describe('包里不带宿主的痕迹：宿主专名与内部别名一律不许出现', () => {
  it('源码不出现 @src 别名、母仓仓库名与内部链路名', () => {
    const files = sourceFiles('src');
    const findings = violations(
      files,
      /@src\/|packages\/server|shadow-refinery|主产品|badCaseId|agent-rag-lab/,
      '包内出现宿主专名或内部别名',
    );
    expect(findings).toEqual([]);
  });

  it('package.json 的 exports 指向源码文件且存在（子路径导出的落点必须可解析）', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
      exports: Record<string, string>;
    };
    const entries = Object.entries(pkg.exports);
    expect(entries.length).toBeGreaterThan(0);
    for (const [subpath, target] of entries) {
      expect(target.startsWith('./src/'), `导出 ${subpath} 必须指向 ./src/`).toBe(true);
      // 通配导出（`./*` → `./src/*.ts`）是模板不是具体文件，只核具体条目
      if (target.includes('*')) continue;
      expect(fs.existsSync(path.join(PACKAGE_ROOT, target)), `导出 ${subpath} 的落点不存在：${target}`).toBe(true);
    }
  });
});
