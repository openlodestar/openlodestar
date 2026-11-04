// src/cli-input.test.ts
/**
 * 离线命令的输入校验：参数拼错、缺值、点名不存在的底稿目录——都不许静默退出 0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseArgs, validateOfflineArgs } from './cli-input';

let tmpDir = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lodestar-cli-input-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function argsOf(argv: string[]) {
  return parseArgs(argv);
}

describe('parseArgs', () => {
  it('选项带值时吃掉下一个参数，不把它当裸参数', () => {
    const parsed = argsOf(['audit', '--data', '.openlodestar-demo', '--limit', '5']);
    expect(parsed.command).toBe('audit');
    expect(parsed.flags.get('data')).toBe('.openlodestar-demo');
    expect(parsed.flags.get('limit')).toBe('5');
    expect(parsed.positionals).toEqual([]);
  });

  it('选项后面紧跟另一个选项时，值记成 true', () => {
    const parsed = argsOf(['audit', '--data', '--limit', '5']);
    expect(parsed.flags.get('data')).toBe('true');
    expect(parsed.flags.get('limit')).toBe('5');
  });

  it('裸参数单独收集（不会悄悄被当成上一次的选项值）', () => {
    const parsed = argsOf(['audit', '.openlodestar-demo']);
    expect(parsed.positionals).toEqual(['.openlodestar-demo']);
    expect(parsed.flags.size).toBe(0);
  });
});

describe('validateOfflineArgs', () => {
  it('合法输入放行', () => {
    expect(validateOfflineArgs('audit', argsOf(['audit', '--data', tmpDir]))).toBeNull();
    expect(validateOfflineArgs('demo', argsOf(['demo', '--example', 'porcelain', '--report']))).toBeNull();
  });

  it('拼错的选项不再被静默忽略', () => {
    const error = validateOfflineArgs('audit', argsOf(['audit', '--dat', tmpDir]));
    expect(error).toContain('Unknown option --dat');
    expect(error).toContain('--data, --limit');
  });

  it('只写选项没给值时当场报错（而不是把 "true" 当目录）', () => {
    const error = validateOfflineArgs('verify-quotes', argsOf(['verify-quotes', '--data']));
    expect(error).toContain('--data requires a value');
  });

  it('裸参数会被当成错误并给出改法', () => {
    const error = validateOfflineArgs('audit', argsOf(['audit', '.openlodestar-demo']));
    expect(error).toContain('Unexpected argument ".openlodestar-demo"');
    expect(error).toContain('--data .openlodestar-demo');
  });

  it('--data 点名的目录不存在时报错：那不是"空底稿"，是没核到你点名的那份', () => {
    const missing = path.join(tmpDir, 'does-not-exist');
    const error = validateOfflineArgs('verify-quotes', argsOf(['verify-quotes', '--data', missing]));
    expect(error).toContain('Ledger directory not found');
    expect(error).toContain(missing);
  });

  it('--data 指向一个文件时报错', () => {
    const file = path.join(tmpDir, 'not-a-dir.jsonl');
    fs.writeFileSync(file, '{}\n', 'utf8');
    const error = validateOfflineArgs('audit', argsOf(['audit', '--data', file]));
    expect(error).toContain('not a directory');
  });

  it('live 等非离线命令不在这一层拦', () => {
    expect(validateOfflineArgs('live', argsOf(['live', '--what-is-this', 'x']))).toBeNull();
  });
});
