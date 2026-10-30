import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = join(root, 'docs');
const htmlPath = join(siteDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const errors = [];

function need(condition, message) {
  if (!condition) errors.push(message);
}

need(/^<!doctype html>/i.test(html.trimStart()), 'missing doctype');
need(/<html[^>]*\blang="zh-CN"/i.test(html), 'html lang must be zh-CN');
need(/<meta[^>]+name="viewport"/i.test(html), 'missing viewport meta');

const metaChecks = [
  ['title', /<title>[^<]+<\/title>/i],
  ['description', /<meta[^>]+name="description"[^>]+content="[^"]+"/i],
  ['canonical', /<link[^>]+rel="canonical"[^>]+href="https:\/\/openlodestar\.github\.io\/openlodestar\/"/i],
  ['og:title', /<meta[^>]+property="og:title"/i],
  ['og:description', /<meta[^>]+property="og:description"/i],
  ['og:image', /<meta[^>]+property="og:image"[^>]+content="https:\/\/openlodestar\.github\.io\/openlodestar\/assets\/social-preview-1280x640\.png"/i],
];
for (const [label, pattern] of metaChecks) need(pattern.test(html), `missing or wrong ${label}`);

const requiredLinks = [
  'https://github.com/openlodestar/openlodestar',
  'https://github.com/openlodestar/openlodestar/releases/tag/v0.1.0',
  'https://github.com/openlodestar/openlodestar/blob/main/README.md',
  'https://github.com/openlodestar/openlodestar/blob/main/SECURITY.md',
  'https://github.com/openlodestar/openlodestar/blob/main/CONTRIBUTING.md',
];
for (const link of requiredLinks) need(html.includes(link), `missing link: ${link}`);

const forbidden = ['AntiqueAI', 'YITASOFT', 'agent-rag-lab', 'LangGraph'];
const lower = html.toLowerCase();
for (const word of forbidden) need(!lower.includes(word.toLowerCase()), `forbidden term: ${word}`);

need(!/<script\b/i.test(html), 'script tags are not allowed');
need(!/<form\b/i.test(html), 'forms are not allowed');
need(!/\son[a-z]+\s*=/i.test(html), 'inline event handlers are not allowed');
need(!/(?:src|srcset)="https?:\/\//i.test(html), 'external resources are not allowed');
need(!/url\(\s*["']?https?:\/\//i.test(html), 'external CSS resources are not allowed');

const requiredAssets = [
  'assets/lockup-cream-800x200.png',
  'assets/favicon.ico',
  'assets/apple-touch-icon-180.png',
  'assets/social-preview-1280x640.png',
];
for (const asset of requiredAssets) need(existsSync(join(siteDir, asset)), `missing asset: ${asset}`);

const assetRefs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((match) => match[1]);
need(assetRefs.length >= 3, 'expected at least three local asset references');
for (const ref of new Set(assetRefs)) need(existsSync(join(siteDir, ref)), `missing asset reference: ${ref}`);

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
for (const match of html.matchAll(/href="#([^"]+)"/g)) {
  need(ids.has(match[1]), `missing anchor target: #${match[1]}`);
}

need(existsSync(join(siteDir, '.nojekyll')), 'missing docs/.nojekyll');
need(statSync(htmlPath).size < 150 * 1024, 'index.html is larger than 150 KB');
need(!/\bTODO\b|\bundefined\b/.test(html), 'placeholder text found');

console.log(
  `site check: ${html.length} chars, ${new Set(assetRefs).size} asset refs, ${requiredLinks.length} required links`,
);
if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log('site check ok');
