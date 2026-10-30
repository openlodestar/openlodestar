// src/lodestar/packs/porcelain/slots.test.ts
/**
 * 归一槽测试（纯规则，不调模型、不联网）
 *
 * 钉住三件事：
 * 1. **该认出来的等价写法要认出来**——实测里时间类断言原样命中 0/27，全卡在写法不重合；
 * 2. **判不了不许当成"没有"**——预筛错杀等于无声丢掉一条证据，底稿里连痕迹都不留；
 * 3. **引文必须写到被裁的那个字段**——逐字命中只证明"这串字在页面上"，不证明它说的是该字段。
 */

import { describe, it, expect } from 'vitest';
import { normalizeText } from '../../normalize';
import porcelainPack from './index';
import { normalizedSlot, pageMentions, pageTimeCues, querySurfaces, quoteBearsFieldClue, sourceMentions } from './slots';

/** 嘉德那篇真页的正文片段（快照里逐字抄下来，三个关键字段同时出现的就是这段） */
const GUARDIAN_PAGE =
  '4月7日晚上，为期5天的中国嘉德香港2024春季拍卖会，圆满结束。12个专场、1,500件拍品，合共收获3.26亿港元。' +
  '敏求精舍会员简永桢先生释出32件单色釉瓷器「大巧若拙——竹月堂藏瓷II」专场';
/** 中新网那篇真页 */
const POLY_PAGE = '中新网11月25日电 北京保利拍卖2021秋季艺术品拍卖会新闻发布会日前举行。';
/** 同一篇里说到专场名的那句（页面用的是弯引号，与断言的书名号不同） */
const POLY_SESSION_PAGE =
  `${POLY_PAGE} 中国古董珍玩板块共呈现十二个专场，包括领衔的“禹贡”系列专场等。`;

describe('机构名归一槽', () => {
  it('括号里的地区不丢，但检索串用连排写法（拍行自己就这么写）', () => {
    const slot = normalizedSlot('auctionHouse', '中国嘉德（香港）');
    expect(slot.queryForms[0]).toBe('中国嘉德香港');
    expect(slot.queryForms).toContain('中国嘉德 香港');
    expect(slot.queryForms).toContain('中国嘉德');
  });

  it('简称与全称互认：断言写"中国嘉德（香港）"，页面写"中国嘉德香港2024春季拍卖会" → 认得出', () => {
    expect(pageMentions('auctionHouse', '中国嘉德（香港）', GUARDIAN_PAGE)).toBe('yes');
    expect(pageMentions('auctionHouse', '嘉德', GUARDIAN_PAGE)).toBe('yes');
  });

  it('这页压根没提这家机构 → no（可以省掉那次比对）', () => {
    expect(pageMentions('auctionHouse', '中国嘉德（香港）', POLY_PAGE)).toBe('no');
  });
});

describe('时间归一槽（季度 ↔ 月份）', () => {
  it('月份推出季度档：2024年4月 → 春季，检索首选季度式写法', () => {
    const slot = normalizedSlot('dateText', '2024年4月');
    expect(slot.window).toEqual({ year: 2024, monthFrom: 4, monthTo: 4 });
    expect(slot.queryForms[0]).toContain('2024');
    expect(slot.queryForms.some((f) => f.includes('春'))).toBe(true);
  });

  it('断言写"2024年4月"、页面只写"2024春季拍卖会" → 不许判 no（这正是 0/27 那一类）', () => {
    expect(pageMentions('dateText', '2024年4月', GUARDIAN_PAGE)).toBe('yes');
  });

  it('断言写"2021年11月"、页面写"2021秋季艺术品拍卖会" → yes', () => {
    expect(pageMentions('dateText', '2021年11月', POLY_PAGE)).toBe('yes');
  });

  it('页面连断言的年份都没出现 → no', () => {
    expect(pageMentions('dateText', '2024年4月', POLY_PAGE)).toBe('no');
  });

  it('推不出年份的写法（"近五年"）一律 unknown，不拦', () => {
    expect(pageMentions('dateText', '近五年', POLY_PAGE)).toBe('unknown');
  });

  it('页脚 Copyright 年份不算时间线索的来源之一：cue 抽取只按"年份/年份年M月/年份+季"三种形态', () => {
    const cues = pageTimeCues('本文发表于2026年9月15日。Copyright 2024 雅昌艺术网');
    expect(cues).toEqual(expect.arrayContaining([{ year: 2026, month: 9, seasonWord: null }]));
  });
});

describe('专场名归一槽', () => {
  it('书名号与引号不算差异：断言"「禹贡」系列专场"，页面写“禹贡”系列专场 → yes', () => {
    expect(pageMentions('sessionName', '「禹贡」系列专场', POLY_SESSION_PAGE)).toBe('yes');
  });

  it('"系列"也是尾噪声：断言「禹贡」系列专场，真站场次页写"禹贡—中国古美术的千年之旅" → yes', () => {
    expect(pageMentions('sessionName', '「禹贡」系列专场', '禹贡—中国古美术的千年之旅')).toBe('yes');
  });

  it('破折号两侧各算一种可认写法：断言"大巧若拙——竹月堂藏瓷II"，页面连排写 → yes', () => {
    expect(pageMentions('sessionName', '大巧若拙——竹月堂藏瓷II', GUARDIAN_PAGE)).toBe('yes');
  });

  it('罗马数字与阿拉伯数字互认（"藏瓷II"＝"藏瓷2"）', () => {
    expect(querySurfaces('sessionName', '竹月堂藏瓷II')).toContain('竹月堂藏瓷2');
    expect(pageMentions('sessionName', '竹月堂藏瓷II', '本场为竹月堂藏瓷2，共三十件')).toBe('yes');
  });

  it('尾缀"专场/拍卖会"多写少写不算差异', () => {
    expect(pageMentions('sessionName', '瓷器工艺品专场', '中国嘉德2014年5月 瓷器工艺品')).toBe('yes');
    expect(pageMentions('sessionName', '瓷器工艺品', '瓷器工艺品专场举槌')).toBe('yes');
  });

  it('这页没有这个专场名的任何一种写法 → no', () => {
    expect(pageMentions('sessionName', '大巧若拙——竹月堂藏瓷II', POLY_SESSION_PAGE)).toBe('no');
  });

  it('放宽写法只放宽到"值不值得比一次"：编号不同不许在这里被合并成同一场，挡箭牌是判定细则那条', () => {
    // 预筛判 yes 无害（主标题这一段确实同源），真正不许合并的是交给模型的那条细则
    expect(pageMentions('sessionName', '大巧若拙——竹月堂藏瓷II', '……「大巧若拙——竹月堂藏瓷I」专场举槌……')).not.toBe('no');
    expect(porcelainPack.judgementRules('sessionName')).toContain('编号不同属于不同场次');
  });
});

describe('预筛的失败模式（不许无声丢证据）', () => {
  it('空值与空白页一律 unknown', () => {
    expect(pageMentions('auctionHouse', '', GUARDIAN_PAGE)).toBe('unknown');
    expect(pageMentions('sessionName', '「禹贡」系列专场', '   ')).toBe('unknown');
  });

  it('本包不认识的字段（地点/成交额…）不参与预筛，只原样给一种写法', () => {
    expect(pageMentions('location', '香港', POLY_PAGE)).toBe('unknown');
    expect(querySurfaces('location', '香港会议展览中心')).toEqual(['香港会议展览中心']);
  });

  it('归一槽只**增加**可认写法，绝不因为归一失败而让原写法认不出，也不改传入的字符串', () => {
    const raw = '中国嘉德（香港）';
    const slot = normalizedSlot('auctionHouse', raw);
    expect(slot.equals).toContain(normalizeText(raw));
    expect(slot.queryForms[0]).toBe('中国嘉德香港');
    expect(raw).toBe('中国嘉德（香港）');
  });
});

/**
 * 写入侧的第二道机械断言：引文里得有"该字段类"的线索形态。
 *
 * 病灶来自实测：dateText 判 supports、引文却是「大巧若拙——竹月堂藏瓷II」这句专场名——
 * 逐字命中只证明这串字在页面上，不证明它说的是"什么时候"。
 * 判据按**字段类形态**判、不按"断言那个值本身的写法"判：反驳方向的引文引的是页面上
 * 那个**相反**的值（页面写 2022 秋季、断言写 2021年12月），按值判会把合法反驳一起杀掉。
 */
describe('引文须含该字段线索形态', () => {
  it('引文是专场名/板块描述、字段却是时间 → no（实测复发的那两条）', () => {
    expect(quoteBearsFieldClue('dateText', '2021年12月5日晚', '[北京保利]禹贡Ⅰ—盛清御瓷新风尚')).toBe('no');
    expect(quoteBearsFieldClue('dateText', '2024年4月', '「大巧若拙——竹月堂藏瓷II」')).toBe('no');
  });

  it('引文里写明了时间 → yes（年份、月份、季度三种形态都算"有说法"）', () => {
    expect(
      quoteBearsFieldClue('dateText', '2024年4月', '4月7日晚上，为期5天的中国嘉德香港2024春季拍卖会，圆满结束'),
    ).toBe('yes');
    expect(
      quoteBearsFieldClue('dateText', '2021年11月', '北京保利拍卖2021秋季艺术品拍卖会新闻发布会日前举行'),
    ).toBe('yes');
    expect(quoteBearsFieldClue('dateText', '2021年12月5日晚', '该专场定于十二月五日晚上举槌')).toBe('yes');
    expect(quoteBearsFieldClue('dateText', '2024年4月', '本场拍卖于4月7日圆满结束')).toBe('yes');
  });

  it('反对方向的引文写的是页面上那个相反的值 → 不许因为"年份/机构对不上"判 no', () => {
    expect(quoteBearsFieldClue('dateText', '2021年12月5日', '2022年秋季艺术品拍卖会以1415万元成交')).toBe('yes');
    expect(
      quoteBearsFieldClue('auctionHouse', '中国嘉德（香港）', '北京保利2021秋季艺术品拍卖会新闻发布会日前举行'),
    ).toBe('yes');
  });

  it('机构字段：引文里得出现某家机构名（断言那家的等价写法优先认）', () => {
    expect(quoteBearsFieldClue('auctionHouse', '中国嘉德（香港）', '中国嘉德香港2024春季拍卖会圆满结束')).toBe('yes');
    expect(quoteBearsFieldClue('auctionHouse', '中国嘉德（香港）', '瓷器工艺品部两天的拍卖呈现七大专场')).toBe('no');
  });

  it('拍行自家公告只写"本公司" → unknown（判不了不许当成没有，放行照常送去比对）', () => {
    expect(quoteBearsFieldClue('auctionHouse', '中国嘉德（香港）', '本公司定于四月举办春季拍卖会')).toBe('unknown');
  });

  it('专场名字段：主名认得出即算（页面写"禹贡Ⅱ—…专场"、断言写「禹贡」系列专场）', () => {
    expect(
      quoteBearsFieldClue(
        'sessionName',
        '「禹贡」系列专场',
        '北京保利2021春季拍卖会 禹贡Ⅱ—乾隆御制洋彩雕瓷有凤来仪大转心瓶专场',
      ),
    ).toBe('yes');
    expect(quoteBearsFieldClue('sessionName', '大巧若拙——竹月堂藏瓷II', '中国古董珍玩板块集合了十二个专场')).toBe('no');
    expect(quoteBearsFieldClue('sessionName', '大巧若拙——竹月堂藏瓷II', '“百年薪火—近现代文人瓷画专场”以1415万元成交')).toBe('yes');
  });

  it('本包不认识的字段、缺值、空引文一律放行（unknown 不等于 no）', () => {
    expect(quoteBearsFieldClue('location', '香港', '本公司定于四月举办')).toBe('unknown');
    expect(quoteBearsFieldClue(null, '2024年4月', '本场于4月7日结束')).toBe('unknown');
    expect(quoteBearsFieldClue('dateText', '2024年4月', '')).toBe('unknown');
    expect(quoteBearsFieldClue('dateText', '', '本场于4月7日结束')).toBe('unknown');
  });
});

/**
 * 来源坐标的入口验收：这页有没有说到这件东西。
 *
 * 与预筛的差别在负信号——主题判"no"是**拒收入口**，不是省一次模型调用；
 * 年代/材质判不了必须 unknown（古玩页常写"清乾隆"这类合写、材质也常只在标题写一次）。
 */
describe('来源侧提及（入口验收）', () => {
  it('主题整词命中 → yes', () => {
    expect(sourceMentions('topic', '黄花梨躺椅', '清中期 黄花梨躺椅 一对')).toBe('yes');
  });

  it('主题整词没出现、但中心词出现 → yes（"清黄花梨躺椅" ≡ "黄花梨躺椅"）', () => {
    expect(sourceMentions('topic', '清黄花梨躺椅', '本场 lot 为黄花梨躺椅')).toBe('yes');
    expect(sourceMentions('topic', '黄花梨圈椅', '清早期 圈椅 一对')).toBe('yes');
  });

  it('主题的两种写法都找不到 → no（这是可靠的负信号，入口验收据此拒页）', () => {
    expect(sourceMentions('topic', '黄花梨躺椅', '青花瓷瓶 一对')).toBe('no');
  });

  it('年代写成"清乾隆"这类合写 → unknown 放行，不许判 no', () => {
    expect(sourceMentions('period', '清代', '清乾隆御制紫檀宝座')).toBe('unknown');
  });

  it('年代出现同一种写法 → yes', () => {
    expect(sourceMentions('period', '清代', '清代家具专场')).toBe('yes');
  });

  it('材质认常见别名（"黄花梨" ≡ "花梨"）', () => {
    expect(sourceMentions('material', '黄花梨', '此椅为花梨木制')).toBe('yes');
  });

  it('材质/品类的"没写"只是判不了 → unknown（品类页常常不写材质）', () => {
    expect(sourceMentions('material', '紫檀', '本场为文房器物')).toBe('unknown');
    expect(sourceMentions('category', '古典家具', '本场为文房器物')).toBe('unknown');
  });

  it('空值与空白页一律 unknown', () => {
    expect(sourceMentions('topic', '', '黄花梨躺椅')).toBe('unknown');
    expect(sourceMentions('topic', '黄花梨躺椅', '   ')).toBe('unknown');
  });
});
