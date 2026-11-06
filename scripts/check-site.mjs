import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 站点静态检查：docs/ 下每个页面都要过同一套红线。
//
// 放开的一条：允许 <script>，但只能是内联或同源 assets/*.js。
// 其余照旧禁止：外链资源、<form>、内联事件、远程 CSS url()、@import。
// 另外为 file:// 双击打开补了几条：禁 type="module"、import、fetch/XHR、
// localStorage/sessionStorage（这几样在 file:// 下会失败或不可靠）。
//
// 唯一例外：小游戏页要把进度/历史成绩存下来（需求就是刷新不丢分），
// 所以 docs/assets/demo-sort.js 允许用 localStorage，
// 但必须逐处包在 try/catch 里——file:// 下它可能直接抛异常，
// 兜住就退回"这一局照玩、刷新不记得"。

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = join(root, 'docs');
const errors = [];
const STORAGE_EXEMPT = new Set(['docs/assets/demo-sort.js']);

function need(condition, message) {
  if (!condition) errors.push(message);
}

const FORBIDDEN_TERMS = ['AntiqueAI', 'YITASOFT', 'agent-rag-lab', 'LangGraph'];
const HTML_SIZE_LIMITS = {
  'index.html': 150 * 1024,
  'demo.html': 300 * 1024,
};
const DEFAULT_HTML_LIMIT = 300 * 1024;
const JS_SIZE_LIMIT = 300 * 1024;

/** 内联脚本与同源脚本都要过这几条离线红线 */
function checkScriptOffline(label, body) {
  need(!/\bimport\s*[({"']/.test(body), `${label}: import is not allowed (breaks under file://)`);
  need(!/\bimport\s+[A-Za-z_$]/.test(body), `${label}: import is not allowed (breaks under file://)`);
  need(!/type\s*=\s*["']module/i.test(body), `${label}: type="module" is not allowed (breaks under file://)`);
  need(!/\bfetch\s*\(/.test(body), `${label}: fetch is not allowed (offline pages must read local constants)`);
  need(!/\bXMLHttpRequest\b/.test(body), `${label}: XHR is not allowed (offline pages must read local constants)`);
  need(!/\bsessionStorage\b/.test(body), `${label}: sessionStorage is not allowed (unreliable under file://)`);
  if (STORAGE_EXEMPT.has(label)) {
    // 例外只给"进度存档"：每一处 localStorage 都必须能看见 try {，否则 file:// 下会整页报错
    const lines = body.split('\n');
    lines.forEach((line, index) => {
      if (!/\blocalStorage\b/.test(line)) return;
      const around = lines.slice(Math.max(0, index - 5), index + 2).join('\n');
      need(
        /try\s*\{/.test(around),
        `${label}: localStorage at line ${index + 1} must sit inside try/catch (file:// may throw)`,
      );
    });
  } else {
    need(
      !/\blocalStorage\b/.test(body),
      `${label}: localStorage is not allowed (unreliable under file://)`,
    );
  }
  need(
    !/\bimport\s*\(\s*["']https?:/i.test(body) && !/\bfetch\s*\(\s*["']https?:/i.test(body),
    `${label}: remote data loading is not allowed`,
  );
}

function checkHtml(fileName) {
  const label = `docs/${fileName}`;
  const path_ = join(siteDir, fileName);
  const html = readFileSync(path_, 'utf8');

  need(/^<!doctype html>/i.test(html.trimStart()), `${label}: missing doctype`);
  need(/<html[^>]*\blang="zh-CN"/i.test(html), `${label}: html lang must be zh-CN`);
  need(/<meta[^>]+name="viewport"/i.test(html), `${label}: missing viewport meta`);
  need(/<title>[^<]+<\/title>/i.test(html), `${label}: missing title`);
  need(/<meta[^>]+name="description"[^>]+content="[^"]+"/i.test(html), `${label}: missing description`);

  const lower = html.toLowerCase();
  for (const word of FORBIDDEN_TERMS) {
    need(!lower.includes(word.toLowerCase()), `${label}: forbidden term: ${word}`);
  }

  need(!/<form\b/i.test(html), `${label}: forms are not allowed`);
  need(!/\son[a-z]+\s*=/i.test(html), `${label}: inline event handlers are not allowed`);

  // 外链资源继续禁；<a href="https://..."> 是正常引用，不在限制内。
  need(!/(?:src|srcset)="https?:\/\//i.test(html), `${label}: external src/srcset is not allowed`);
  need(
    !(/<link\b(?=[^>]*rel\s*=\s*"(?:stylesheet|preload|icon)")[^>]*href\s*=\s*"https?:\/\//i.test(html)),
    `${label}: external stylesheet/icon is not allowed`,
  );
  need(!/url\(\s*["']?https?:\/\//i.test(html), `${label}: external CSS url() is not allowed`);
  need(!/@import/i.test(html), `${label}: CSS @import is not allowed`);

  // <script>：只接受内联或同源 assets/*.js（全小写，Pages 在 Linux 上区分大小写）
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const [, attrs, body] of scriptTags) {
    need(!/\bsrc\s*=\s*"https?:\/\//i.test(attrs), `${label}: external script src is not allowed`);
    const srcMatch = attrs.match(/\bsrc\s*=\s*"([^"]*)"/i);
    if (srcMatch !== null) {
      const src = srcMatch[1];
      need(
        /^assets\/[a-z0-9][a-z0-9._-]*\.js$/.test(src),
        `${label}: only same-origin lowercase assets/*.js scripts are allowed (got "${src}")`,
      );
      need(existsSync(join(siteDir, src)), `${label}: missing script asset: ${src}`);
    }
    need(!/type\s*=\s*"module"/i.test(attrs), `${label}: type="module" is not allowed (breaks under file://)`);
    checkScriptOffline(`${label} inline script`, body);
  }

  const assetRefs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((match) => match[1]);
  for (const ref of new Set(assetRefs)) {
    need(existsSync(join(siteDir, ref)), `${label}: missing asset reference: ${ref}`);
  }

  // 所有页面共用同一条顶栏：样式只有一份，链接清单也必须齐全，页面之间不能是死路。
  need(
    /<link\b[^>]*rel="stylesheet"[^>]*href="assets\/site-nav\.css"/i.test(html),
    `${label}: missing shared nav stylesheet assets/site-nav.css`,
  );
  const navMatch = html.match(/<nav[^>]*aria-label="主导航"[^>]*>([\s\S]*?)<\/nav>/i);
  need(navMatch !== null, `${label}: missing main nav with aria-label="主导航"`);
  if (navMatch !== null) {
    for (const href of ['index.html', 'demo.html', 'demo-sort.html']) {
      need(navMatch[1].includes(`href="${href}"`), `${label}: main nav is missing ${href}`);
    }
  }

  // 站内链接一律相对路径：http:// 在 https 站上会被混合内容拦掉、断网也失效；
  // 绝对路径 / 与 ../ 在 file:// 与 Pages 下的根不一样，都会跳丢。
  for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
    need(!/^javascript:/i.test(href), `${label}: javascript: link is not allowed: ${href}`);
    need(!href.startsWith('http://'), `${label}: http:// link is not allowed: ${href}`);
    if (/^(?:https:\/\/|mailto:|#)/i.test(href)) continue;
    need(!href.startsWith('/') && !href.startsWith('..'), `${label}: link must stay inside docs/ as a relative path: ${href}`);
    const target = href.split('#')[0];
    need(target.length > 0, `${label}: empty link target: ${href}`);
    const targetPath = join(siteDir, target);
    need(existsSync(targetPath), `${label}: broken relative link: ${href}`);
    // Pages 跑在 Linux 上、区分大小写，而本机 Windows 不区分：按目录里的真实文件名
    // 逐个比对，避免「本机通过、线上 404」。
    const parentDir = dirname(targetPath);
    if (existsSync(parentDir)) {
      const entries = readdirSync(parentDir);
      need(
        entries.includes(basename(targetPath)),
        `${label}: link case does not match the file on disk: ${href}`,
      );
    }
  }

  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  for (const match of html.matchAll(/href="#([^"]+)"/g)) {
    need(ids.has(match[1]), `${label}: missing anchor target: #${match[1]}`);
  }

  const limit = HTML_SIZE_LIMITS[fileName] ?? DEFAULT_HTML_LIMIT;
  need(statSync(path_).size < limit, `${label}: page is larger than ${limit / 1024} KB`);
  need(!/\bTODO\b|\bundefined\b/.test(html), `${label}: placeholder text found`);

  return { html, assetRefs };
}

function checkIndexOnly(html, assetRefs) {
  const metaChecks = [
    ['canonical', /<link[^>]+rel="canonical"[^>]+href="https:\/\/openlodestar\.github\.io\/openlodestar\/"/i],
    ['og:title', /<meta[^>]+property="og:title"/i],
    ['og:description', /<meta[^>]+property="og:description"/i],
    [
      'og:image',
      /<meta[^>]+property="og:image"[^>]+content="https:\/\/openlodestar\.github\.io\/openlodestar\/assets\/social-preview-1280x640\.png"/i,
    ],
  ];
  for (const [label, pattern] of metaChecks) need(pattern.test(html), `docs/index.html: missing or wrong ${label}`);

  const requiredLinks = [
    'https://github.com/openlodestar/openlodestar',
    'https://github.com/openlodestar/openlodestar/releases/tag/v0.1.0',
    'https://github.com/openlodestar/openlodestar/blob/main/README.md',
    'https://github.com/openlodestar/openlodestar/blob/main/SECURITY.md',
    'https://github.com/openlodestar/openlodestar/blob/main/CONTRIBUTING.md',
  ];
  for (const link of requiredLinks) need(html.includes(link), `docs/index.html: missing link: ${link}`);

  const requiredAssets = [
    'assets/lockup-cream-800x200.png',
    'assets/favicon.ico',
    'assets/apple-touch-icon-180.png',
    'assets/social-preview-1280x640.png',
  ];
  for (const asset of requiredAssets) need(existsSync(join(siteDir, asset)), `missing asset: ${asset}`);
  need(assetRefs.length >= 3, 'docs/index.html: expected at least three local asset references');
}

const htmlFiles = readdirSync(siteDir)
  .filter((name) => name.endsWith('.html') && statSync(join(siteDir, name)).isFile())
  .sort();
need(htmlFiles.includes('index.html'), 'docs/index.html is missing');

let assetRefCount = 0;
for (const fileName of htmlFiles) {
  const result = checkHtml(fileName);
  assetRefCount += result.assetRefs.length;
  if (fileName === 'index.html') checkIndexOnly(result.html, result.assetRefs);
}

// 同源脚本也要查：不能借 assets/*.js 绕过离线红线或体积上限。
const assetsDir = join(siteDir, 'assets');
const jsFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir)
      .filter((name) => name.endsWith('.js') && statSync(join(assetsDir, name)).isFile())
      .sort()
  : [];
for (const fileName of jsFiles) {
  const path_ = join(assetsDir, fileName);
  const body = readFileSync(path_, 'utf8');
  checkScriptOffline(`docs/assets/${fileName}`, body);
  need(statSync(path_).size < JS_SIZE_LIMIT, `docs/assets/${fileName}: script is larger than ${JS_SIZE_LIMIT / 1024} KB`);
}

need(existsSync(join(siteDir, '.nojekyll')), 'missing docs/.nojekyll');

// 样式文件也要查：共用顶栏是本地 CSS，不能借它引外部字体、@import 或把体积堆上去。
const CSS_SIZE_LIMIT = 60 * 1024;
const cssFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir)
      .filter((name) => name.endsWith('.css') && statSync(join(assetsDir, name)).isFile())
      .sort()
  : [];
need(cssFiles.includes('site-nav.css'), 'missing docs/assets/site-nav.css (shared nav stylesheet)');
for (const fileName of cssFiles) {
  const path_ = join(assetsDir, fileName);
  const body = readFileSync(path_, 'utf8');
  need(!/@import/i.test(body), `docs/assets/${fileName}: CSS @import is not allowed`);
  need(!/url\(\s*["']?https?:/i.test(body), `docs/assets/${fileName}: remote CSS url() is not allowed`);
  need(!/https?:\/\//i.test(body), `docs/assets/${fileName}: external URLs are not allowed in the shared stylesheet`);
  need(
    statSync(path_).size < CSS_SIZE_LIMIT,
    `docs/assets/${fileName}: stylesheet is larger than ${CSS_SIZE_LIMIT / 1024} KB`,
  );
}

console.log(
  `site check: ${htmlFiles.length} page(s) [${htmlFiles.join(', ')}], ${jsFiles.length} script(s), ` +
    `${cssFiles.length} stylesheet(s), ${assetRefCount} asset refs`,
);
if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log('site check ok');
