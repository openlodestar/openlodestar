// src/utils/html-entities.ts
/**
 * HTML 实体解码（纯函数，全仓唯一定义点）
 *
 * 为什么统一：清洗正文与引文比对必须对"页面上那个字"给出同一个答案。
 * 命名实体覆盖正文常见项；数字实体（`&#160;` / `&#x200B;`）按码点解码——
 * 它们是清洗器最容易漏掉的一类，漏掉后模型引文里的空格与不可见字符会与快照对不上。
 *
 * 只解一层：`&amp;lt;` 解成 `&lt;`，不再继续解成 `<`。非法码点原样保留，不猜。
 */

/** 正文常见命名实体（大小写按 HTML 的约定，只认小写） */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
  zwnj: '\u200C',
  zwj: '\u200D',
  lrm: '\u200E',
  rlm: '\u200F',
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
  copy: '©',
  reg: '®',
  trade: '™',
  mdash: '—',
  ndash: '–',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '"',
  rdquo: '"',
  bull: '•',
  hellip: '…',
};

/**
 * 解码 HTML 实体（命名 + 数字），只解一层。
 *
 * 数字实体的合法性检查：码点必须在 1..0x10FFFF，且不能落在代理区
 * （0xD800–0xDFFF）——非法值原样保留，避免解出半个 UTF-16 代理对。
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (entity, body: string) => {
      if (body.startsWith('#')) {
        const hex = body[1] === 'x' || body[1] === 'X';
        const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
        if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return entity;
        if (code >= 0xd800 && code <= 0xdfff) return entity;
        return String.fromCodePoint(code);
      }
      return NAMED_ENTITIES[body] ?? entity;
    },
  );
}
