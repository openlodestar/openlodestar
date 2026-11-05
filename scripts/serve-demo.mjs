/* scripts/serve-demo.mjs
 *
 * 演示页的本地静态预览服务：把仓库里的 docs/ 目录原样端出来，给 docs/demo-lab.html
 * 与 docs/demo.html 用。
 *
 * 只做这一件事，所以边界写死：
 * - 只绑 127.0.0.1，不绑 0.0.0.0——局域网与公网都碰不到；
 * - 只读 docs/ 下的文件，不列目录、不执行任何东西、不读 .env、不联网、不计费；
 * - 默认端口 3013，被占时报错并提示换端口，不自动改端口（免得你以为还是 3013）。
 *
 * 用法：pnpm run demo:serve [-- --port 3014]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_ROOT = path.join(REPO_ROOT, 'docs');
const HOST = '127.0.0.1';
const DEFAULT_PORT = 3013;

const USAGE = `用法：pnpm run demo:serve [-- --port <端口>]

  --port <n>   换一个端口（默认 ${DEFAULT_PORT}）
  --help       显示这段说明
`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parsePort(argv) {
  let port = DEFAULT_PORT;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    }
    let value = null;
    if (arg === '--port') {
      value = argv[i + 1];
      if (value === undefined) fail('--port 后面要跟一个端口号。\n\n' + USAGE);
      i += 1;
    } else if (arg.startsWith('--port=')) {
      value = arg.slice('--port='.length);
    } else {
      fail(`不认识的参数「${arg}」。\n\n` + USAGE);
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      fail(`端口「${value}」不合法，要 1–65535 之间的整数。`);
    }
    port = parsed;
  }
  return port;
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const port = parsePort(process.argv.slice(2));

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD' });
    res.end('只支持 GET 与 HEAD');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', `http://${HOST}:${port}`).pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('请求路径无法解析');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  // 解析后必须仍落在 docs/ 里面，任何 ../ 爬出去的请求一律拒绝
  const filePath = path.resolve(DOCS_ROOT, '.' + pathname);
  if (filePath !== DOCS_ROOT && !filePath.startsWith(DOCS_ROOT + path.sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('只能读 docs/ 里的文件');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      const missing = error.code === 'ENOENT' || error.code === 'EISDIR';
      res.writeHead(missing ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(missing ? '没有这个文件' : '读文件失败');
      return;
    }
    const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'content-type': type,
      'content-length': data.length,
      // 改完页面刷新就能看到，不用清缓存
      'cache-control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    fail(
      `端口 ${port} 已经被别的进程占用了。\n` +
        `换一个端口：pnpm run demo:serve -- --port ${port + 1}\n` +
        `或者先找出占用者：netstat -ano | findstr :${port}`,
    );
  }
  fail(`服务启动失败：${error.message}`);
});

server.listen(port, HOST, () => {
  console.log('演示页本地预览已启动（只监听本机，局域网与公网都访问不到）：');
  console.log(`  http://${HOST}:${port}/demo-lab.html   小游戏页`);
  console.log(`  http://${HOST}:${port}/demo.html       逐条记录演示`);
  console.log('按 Ctrl+C 停止。换端口：pnpm run demo:serve -- --port 3014');
});
