// src/lodestar/prompts.test.ts
/**
 * Lodestar 提示词的加载守卫
 *
 * 为什么单独有这一份：`PromptLoader.getEnabledRules()` 只渲染带 `enabled: true` 的规则，
 * 缺这个字段的规则会被**静默丢掉**——模板照样渲染、调用照样成功，只是纪律没送进模型。
 * 2026-10-04 首轮实测就踩了这个：四份提示词的所有规则都没写 enabled，于是
 * "引文必须逐字复制"这类要求一句都没到过模型面前，表现为大量证据"缺引文/引文不命中"被剔除，
 * 而现场看起来像模型不听话。这类失败不会报错，只能靠断言钉。
 */

import { describe, it, expect } from 'vitest';
import { getLodestarLoader } from '@src/prompts';
import type { PromptTemplate, RenderVariables } from '@src/prompts';
import porcelainPack from './packs/porcelain';
import { renderEnumerationExtract, renderSourceEnumeration, sourcePhrasings } from './intake/prompts';

const PROMPTS: Array<{ name: string; variables: RenderVariables }> = [
  {
    name: 'enumeration-answer',
    variables: { pack_label: '瓷器拍卖专场', question: '列出近五年含民间瓷器的拍卖会', column_keys: '「拍卖机构」' },
  },
  {
    name: 'enumeration-extract',
    variables: { pack_label: '瓷器拍卖专场', question: '列出 2021 年北京保利的瓷器专场', context: '搜索资料全文', column_keys: '「拍卖机构」' },
  },
  {
    name: 'concretization',
    variables: { pack_label: '瓷器拍卖专场', records: '[]', ask: '补全年份' },
  },
  {
    name: 'claim-compare',
    variables: {
      claim: '中国嘉德于2024年4月举办「大巧若拙——竹月堂藏瓷II」专场',
      url: 'https://example.test/a',
      fetched_at: '2026-10-04',
      page_text: '正文若干',
      rules_extra: '共现细则',
    },
  },
  { name: 'claim-atomize', variables: { raw_text: '2024 年嘉德香港春拍瓷器专场成交 1.52 亿' } },
  {
    name: 'source-enumeration',
    variables: {
      pack_label: '瓷器拍卖专场',
      question: '清代黄花梨躺椅有哪些可采集的入口页',
      column_keys: '「器物主题」、「年代」',
    },
  },
];

describe('Lodestar 提示词纪律必须真的进渲染结果', () => {
  for (const { name, variables } of PROMPTS) {
    it(`${name}：每条规则都标了 enabled，且规则文本出现在渲染结果里`, () => {
      const loader = getLodestarLoader();
      const template = loader.load(name) as PromptTemplate;
      const rules = template.rules ?? [];
      expect(rules.length).toBeGreaterThan(0);
      const disabled = rules.filter((r) => r.enabled !== true).map((r) => r.name);
      expect(disabled, `规则缺 enabled:true 会被静默丢掉：${disabled.join(', ')}`).toEqual([]);

      const rendered = loader.render(name, variables);
      for (const rule of rules) {
        const probe = rule.content.trim().slice(0, 12);
        expect(rendered, `规则 ${rule.name} 的文本没进渲染结果（可能被机制块吃掉）`).toContain(probe);
      }
    });
  }

  it('比对模板带着"逐字复制"与"没有原句就不许给 supports"这两条硬话', () => {
    const rendered = getLodestarLoader().render('claim-compare', PROMPTS[2]!.variables);
    expect(rendered).toContain('原样复制');
    expect(rendered).toContain('找不到可逐字复制的原句');
  });

  it('提问模板的弃权出口是硬要求，不是可选提示', () => {
    const rendered = getLodestarLoader().render('enumeration-answer', PROMPTS[0]!.variables);
    expect(rendered).toContain('想不起来的字段留空字符串');
    expect(rendered).toContain('凑满数量是不合格');
  });

  it('提取模板带着"未确认信息不得作为值"的纪律（B2，1.0.1），且经渲染函数接线进模型输入', () => {
    const rendered = getLodestarLoader().render('enumeration-extract', PROMPTS[1]!.variables);
    expect(rendered).toContain('不得当作字段值抄出来');
    // 走 renderEnumerationExtract（与兜底链路同一条渲染路径）再验一次，钉住 enabledRules 接线
    const wired = renderEnumerationExtract(porcelainPack, '列出 2021 年北京保利的瓷器专场', '搜索资料全文');
    expect(wired).toContain('未确认');
    expect(wired).toContain('宁可留空字符串');
  });

  it('入口供给模板带着"网址可空、不许拼"的硬要求，且列名逐字用的是来源字段标签', () => {
    const rendered = renderSourceEnumeration(porcelainPack, '清代黄花梨躺椅有哪些可采集的入口页');
    expect(rendered).toContain('编一个看起来合理的网址是不合格');
    expect(rendered).toContain('留空字符串');
    // 列名必须与 mapSourceRow 的别名表对得上，否则模型照模板作答也映射不回字段
    expect(rendered).toContain('「器物主题」');
    expect(rendered).toContain('「机构/平台」');
    // 来源提问的角色用入口域（古玩收藏），不是事件域（瓷器拍卖专场）——
    // 否则问跨品类器物时模型会把自己当成专场专家、直接弃权
    expect(rendered).toContain('古玩收藏');
    expect(rendered).not.toContain('你是 瓷器拍卖专场');
  });

  it('来源模板先让模型自由回答、再列来源，不把弃权写成首选答案', () => {
    const rendered = renderSourceEnumeration(porcelainPack, '清朝黄花梨躺椅多少钱？请列出来源依据。');
    expect(rendered).toContain('请凭你的记忆直接回答下面的问题');
    expect(rendered).toContain('把你依据的来源逐条列出来');
    expect(rendered).toContain('只记得机构、记不得具体页面是常见且合格的回答');
    expect(rendered).not.toContain('弃权是完全合格的回答');
    expect(rendered).not.toContain('你是 古玩收藏 领域的入口供给器');
  });

  it('来源复问首轮原样提问、后续轮只补来源要求，不再施加入口页压力', () => {
    const frames = sourcePhrasings('清朝黄花梨躺椅多少钱？请列出来源依据。', 3);
    expect(frames).toHaveLength(3);
    expect(frames[0]).toBe('清朝黄花梨躺椅多少钱？请列出来源依据。');
    expect(frames[1]).toContain('请逐条写出你依据的来源');
    expect(frames[1]).toContain('不记得网址就留空');
    for (const frame of frames) {
      expect(frame).not.toContain('入口页');
      expect(frame).not.toContain('不要凑数');
    }
  });
});
