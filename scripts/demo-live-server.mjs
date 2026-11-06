// scripts/demo-live-server.mjs
/**
 * 本地实时演算服务（只给开发机用，**不部署**）
 *
 * 静态演示页（`docs/demo.html` 与 `docs/demo-sort.html`）只切换构建时冻结的组合；这个服务是另一件事：
 * 输入任意一句拍卖会记忆，现场调用真引擎跑检索、抓页、比对、门禁与坐标。
 *
 * 三条硬规矩：
 * 1. 只绑定 127.0.0.1:3014，不接受局域网访问；
 * 2. **默认拒绝跑**：没有 `--allow-spend` 直接退出，不初始化引擎、不读密钥；
 *    即使带了参数，每个请求也要带 `"confirm": true`，服务端每次先打印预估调用量；
 * 3. 密钥只从 `.env` 或当前进程环境读取，只存在于服务端内存，不写日志、不回传前端。
 *
 * 用法（在仓库根目录）：
 *   pnpm run demo:live-server              # 只验证拒绝逻辑，不花钱
 *   pnpm run demo:live-server -- --allow-spend
 *   curl -s http://127.0.0.1:3014/verify \
 *     -H 'content-type: application/json' \
 *     -d '{"sentence":"北京保利在2021年12月5日举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。","confirm":true}'
 *
 * 产物写到 `.openlodestar-demo/live-server/<时间戳>/`（已被 git 忽略），不进 `examples/`。
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..');
const HOST = '127.0.0.1';
const PORT = Number(process.env.LODESTAR_LIVE_PORT || 3014);
const ALLOW_SPEND = process.argv.includes('--allow-spend');
const MAX_BODY_BYTES = 16 * 1024;

/** 把 .env 读进环境变量（不覆盖已有值，不打印内容） */
function loadDotEnv() {
  const envPath = path.join(PACKAGE_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** 每次调用前的预估：按当前 caps 给出上界，不承诺实际次数 */
function estimateSpend(sentence) {
  const searches = Number(process.env.LODESTAR_MAX_SEARCH_CALLS || 4);
  const pages = Number(process.env.LODESTAR_MAX_PAGES || 6);
  const compares = pages * 3;
  const chars = sentence.length;
  return (
    `预估：1 条记录最多 ${searches} 次搜索、${pages} 次抓页、约 ${compares} 次模型比对（按字段数估算）；` +
    `输入 ${chars} 字。若模型把这句话拆成多条记录，调用量按条数倍增。` +
    '实际花费取决于模型与搜索提供商的计费，且可能因网络失败重试。'
  );
}

function refuseWithoutFlag() {
  console.error('拒绝启动：这个服务会真实调用模型与搜索接口（计费）。');
  console.error('如果确认要花这笔钱，请显式加上 --allow-spend：');
  console.error('  pnpm run demo:live-server -- --allow-spend');
  console.error('这个服务只作本机实验，不部署、不对公网开放。');
  console.error(`（未启动时的预估规则：${estimateSpend('（示例句子）')}）`);
  process.exitCode = 1;
}

function checkRequiredEnv() {
  const missing = [];
  if (!process.env.LLM_API_KEY) missing.push('LLM_API_KEY');
  if ((process.env.SEARCH_PROVIDER || 'llm-web') === 'serper' && !process.env.SERPER_API_KEY) {
    missing.push('SERPER_API_KEY');
  }
  if (missing.length > 0) {
    console.error(`拒绝启动：缺少 ${missing.join('、')}。密钥只从 .env 或当前进程环境读取。`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体超过 16 KB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function isLoopback(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

async function verifySentence(sentence) {
  // 动态装载：拒绝启动的那条路完全不碰引擎与密钥
  const { runQuery } = await import('../src/lodestar/engine.ts');
  const { createStore } = await import('../src/lodestar/storage/adapter.ts');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseDir = path.join(PACKAGE_ROOT, '.openlodestar-demo', 'live-server', stamp);
  const deadlineMinutes = Number(process.env.LODESTAR_DEADLINE_MINUTES || 8);
  const outcome = await runQuery(sentence, {
    store: createStore({ baseDir }),
    guards: {
      deadlineAtMs: Date.now() + Math.max(1, deadlineMinutes) * 60 * 1000,
    },
    onStage: (stage, detail) => {
      console.log(`[${PORT}] stage=${stage} ${detail ? JSON.stringify(detail) : ''}`);
    },
  });
  return {
    queryId: outcome.queryId,
    runId: outcome.runId,
    dataDir: path.relative(PACKAGE_ROOT, baseDir),
    stats: outcome.stats,
    records: outcome.summaries.map((summary) => ({
      recordId: summary.recordId,
      gate: summary.gate,
      reason: summary.reason,
    })),
    anchors: outcome.anchors.map((anchor) => ({
      recordId: anchor.recordId,
      anchorGrade: anchor.anchorGrade,
      evidenceGrade: anchor.evidenceGrade,
      sourceUrls: anchor.sourceUrls,
    })),
    pausedClaimIds: outcome.pausedClaimIds,
    failedClaimIds: outcome.failedClaimIds,
    guardStopped: outcome.guardStopped ?? null,
  };
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    const remote = req.socket.remoteAddress || '';
    if (!isLoopback(remote)) {
      sendJson(res, 403, { error: '只接受本机回环地址访问' });
      return;
    }
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end(
        [
          'OpenLodestar 本地实时演算服务（只在本机跑，不部署）',
          '',
          `监听：http://${HOST}:${PORT}`,
          '接口：POST /verify',
          '请求体：{"sentence": "...", "confirm": true}',
          '',
          '每次请求都会先打印预估调用量；不带 confirm:true 会被拒绝。',
          '产物目录：.openlodestar-demo/live-server/<时间戳>/',
          '',
          '示例：',
          'curl -s http://127.0.0.1:3014/verify -H "content-type: application/json" \\',
          '  -d "{\\"sentence\\":\\"北京保利在2021年12月5日举办了一场名为「禹贡Ⅰ—盛清御瓷新风尚」的拍卖会。\\",\\"confirm\\":true}"',
        ].join('\n'),
      );
      return;
    }
    if (req.method !== 'POST' || req.url !== '/verify') {
      sendJson(res, 404, { error: '只有 GET / 与 POST /verify' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : '请求体读取失败' });
      return;
    }
    const sentence = typeof body.sentence === 'string' ? body.sentence.trim() : '';
    if (sentence.length < 6 || sentence.length > 500) {
      sendJson(res, 400, { error: 'sentence 需为 6–500 字' });
      return;
    }

    console.log(`[${PORT}] 收到实时演算请求：${sentence.slice(0, 48)}${sentence.length > 48 ? '…' : ''}`);
    console.log(`[${PORT}] ${estimateSpend(sentence)}`);
    if (body.confirm !== true) {
      sendJson(res, 428, {
        error: '需要显式确认：请求体加 "confirm": true 再发一次',
        estimate: estimateSpend(sentence),
      });
      return;
    }

    try {
      console.log(`[${PORT}] --allow-spend 已开启，开始跑引擎（会真实花费）`);
      const result = await verifySentence(sentence);
      console.log(`[${PORT}] 跑完：${result.records.length} 条记录，数据在 ${result.dataDir}`);
      sendJson(res, 200, result);
    } catch (error) {
      console.error(`[${PORT}] 运行失败：${error instanceof Error ? error.message : error}`);
      sendJson(res, 500, { error: error instanceof Error ? error.message : '引擎运行失败' });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`本地实时演算服务已启动：http://${HOST}:${PORT}`);
    console.log('只绑定本机回环地址；这个服务不部署、不对公网开放。');
    console.log(`输出目录：.openlodestar-demo/live-server/`);
    console.log('停止：Ctrl+C（或结束占用 3014 端口的进程）。');
  });
  server.on('error', (error) => {
    console.error(`监听 ${HOST}:${PORT} 失败：${error.message}`);
    process.exitCode = 1;
  });
  process.on('SIGINT', () => {
    console.log('\n收到 Ctrl+C，关闭服务。');
    server.close(() => process.exit(0));
  });
}

loadDotEnv();
if (!ALLOW_SPEND) {
  refuseWithoutFlag();
} else if (checkRequiredEnv()) {
  startServer();
}
