// src/lodestar/corpus-adjudication.test.ts
import { describe, expect, it } from 'vitest';
import {
  EMPTY_HOUSE_REGIONS,
  evaluateSessionLayer,
  extractDateTokens,
  extractHouseRegions,
  judgeCorpusPage,
  matchDateField,
  matchHouseField,
  matchSessionField,
  measureCorpusPages,
  parseAssertedDate,
  urlYearOf,
  type CorpusPageVerdict,
  type SessionLayerRecord,
} from './corpus-adjudication';

describe('extractDateTokens — 四类写法都要认出来，且不重抓半截', () => {
  it('完整日期只出一个 token，不会把 December 2003 再抓一遍', () => {
    const tokens = extractDateTokens('2 December 2003, 11:00 GMT');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ raw: '2 December 2003', year: 2003, month: 12, day: 2 });
  });

  it('月份缩写、ISO 串、中文日期分别识别', () => {
    expect(extractDateTokens('Closed: 12 Dec 2023')[0]).toMatchObject({ year: 2023, month: 12, day: 12 });
    expect(extractDateTokens('2026-09-23T04:20:00+00:00')[0]).toMatchObject({
      year: 2026,
      month: 9,
      day: 23,
      form: 'iso',
    });
    expect(extractDateTokens('展期 2021年12月5日 开幕')[0]).toMatchObject({ year: 2021, month: 12, day: 5 });
  });

  it('缺年份的写法单独标记（year = null）', () => {
    expect(extractDateTokens('拍賣已結束 November 6, 03:25 PM GMT')[0]).toMatchObject({
      raw: 'November 6',
      year: null,
      month: 11,
      day: 6,
    });
  });
});

describe('urlYearOf — 只从路径里读独立年份', () => {
  it('路径里唯一的四位年份可用', () => {
    expect(urlYearOf('https://www.sothebys.com/en/buy/auction/2024/chinese-art-3/lot')).toBe(2024);
  });

  it('没有年份或有两个不同年份时返回 null', () => {
    expect(urlYearOf('https://www.bonhams.com/auction/10396/lot/42')).toBeNull();
    expect(urlYearOf('https://example.com/2023/2024/x')).toBeNull();
    expect(urlYearOf(null)).toBeNull();
  });
});

describe('matchDateField — 归一后比对，引文仍逐字', () => {
  it('月份缩写：断言 12 December 2023，页面写 12 Dec 2023', () => {
    const text = 'lot-timer Closed: 12 Dec 2023';
    const result = matchDateField({ asserted: '12 December 2023', text });
    expect(result.status).toBe('normalized');
    expect(result.quote).toBe('12 Dec 2023');
    expect(text.includes(result.quote!)).toBe(true);
    expect(result.verbatim).toBe(false);
  });

  it('ISO 串：断言 23 September 2026，页面写 2026-09-23T04:20:00+00:00', () => {
    const text = '<li>拍卖时间：2026-09-23T04:20:00+00:00</li>';
    const result = matchDateField({ asserted: '23 September 2026', text });
    expect(result.status).toBe('normalized');
    expect(result.quote).toBe('2026-09-23T04:20:00+00:00');
  });

  it('中文写法：断言 5 December 2021，页面写 2021年12月5日', () => {
    const result = matchDateField({ asserted: '5 December 2021', text: '展期 2021年12月5日 开幕' });
    expect(result.status).toBe('normalized');
    expect(result.quote).toBe('2021年12月5日');
  });

  it('无年份 + URL 年份一致：归一，年份来源标 url', () => {
    const result = matchDateField({
      asserted: '6 November 2024',
      text: '拍賣已結束 November 6, 03:25 PM GMT',
      url: 'https://www.sothebys.com/en/buy/auction/2024/chinese-art-3/lot',
    });
    expect(result.status).toBe('normalized');
    expect(result.yearSource).toBe('url');
    expect(result.quote).toBe('November 6');
  });

  it('无年份且 URL 也没有年份：记「缺年」，不猜', () => {
    const result = matchDateField({ asserted: '6 November 2024', text: 'November 6, 03:25 PM GMT' });
    expect(result.status).toBe('year-unresolved');
    expect(result.normalized).toBeNull();
  });

  it('无年份、URL 年份与断言不符：记不符，不用 URL 年份凑答案', () => {
    const result = matchDateField({
      asserted: '6 November 2024',
      text: 'November 6, 03:25 PM GMT',
      url: 'https://example.com/auction/2025/x',
    });
    expect(result.status).toBe('mismatch');
  });

  it('逐字命中优先：断言原样出现时记 hit', () => {
    const text = '2 December 2003, 11:00 GMT';
    const result = matchDateField({ asserted: '2 December 2003', text });
    expect(result.status).toBe('hit');
    expect(result.quote).toBe('2 December 2003');
    expect(result.verbatim).toBe(true);
  });

  it('日/月/年任一不同都不归一', () => {
    expect(matchDateField({ asserted: '12 December 2023', text: '12 Dec 2024' }).status).toBe('mismatch');
    expect(matchDateField({ asserted: '12 December 2023', text: '13 Dec 2023' }).status).toBe('mismatch');
  });

  it('斜杠日期与只到月的写法不猜', () => {
    const slash = matchDateField({ asserted: '4 March 2023', text: 'Date: 03/04/2023' });
    expect(slash.status).toBe('mismatch');
    expect(slash.detail).toContain('斜杠');
    const monthOnly = matchDateField({ asserted: '5 December 2023', text: 'December 2023' });
    expect(monthOnly.status).toBe('mismatch');
    expect(monthOnly.detail).toContain('只到月');
    const zhMonthOnly = matchDateField({ asserted: '5 December 2023', text: '2023年12月' });
    expect(zhMonthOnly.status).toBe('mismatch');
  });

  it('页面没有日期写法时记「没有」，与「不符」分开', () => {
    expect(matchDateField({ asserted: '12 December 2023', text: '这是一篇讲瓷器的文章' }).status).toBe('absent');
  });

  it('断言解析不出完整日期时不判', () => {
    expect(parseAssertedDate('2023年12月')).toBeNull();
    expect(matchDateField({ asserted: '2023年12月', text: '2023年12月1日' }).status).toBe('unjudgeable');
  });
});

describe('matchHouseField — 只在结构位置里认机构，正文顺带提及不算', () => {
  const regions = (patch: Partial<ReturnType<typeof extractHouseRegions>>) => ({
    ...EMPTY_HOUSE_REGIONS,
    ...patch,
  });

  it('面包屑写「佳士得」：命中位置是面包屑，不是整页', () => {
    const result = matchHouseField({
      asserted: "Christie's",
      regions: regions({ breadcrumb: '来源：佳士得 › 中国瓷器 › 拍品' }),
    });
    expect(result.status).toBe('alias');
    expect(result.canonical).toBe('佳士得');
    expect(result.quote).toBe('佳士得');
    expect(result.position).toBe('breadcrumb');
  });

  it('反向也成立：断言「佳士得」，页头写 Christie\'s', () => {
    const result = matchHouseField({ asserted: '佳士得', regions: regions({ header: "Christie's 拍卖" }) });
    expect(result.status).toBe('alias');
    expect(result.position).toBe('header');
  });

  it('繁简与缩写走同一张表：蘇富比 / Sotheby\'s', () => {
    expect(matchHouseField({ asserted: "Sotheby's", regions: regions({ title: '香港蘇富比' }) }).status).toBe('alias');
    expect(matchHouseField({ asserted: '苏富比', regions: regions({ saleHeading: "Sotheby's Hong Kong" }) }).status).toBe(
      'alias',
    );
  });

  it('逐字优先于别名：页头写别名、面包屑写原样时认面包屑', () => {
    const result = matchHouseField({
      asserted: "Christie's",
      regions: regions({ header: '佳士得', breadcrumb: "Christie's › Auctions" }),
    });
    expect(result.status).toBe('hit');
    expect(result.position).toBe('breadcrumb');
    expect(result.quote).toBe("Christie's");
  });

  it('落在域名里的写法不算机构证据，继续找同一区域里的中文写法', () => {
    const result = matchHouseField({
      asserted: "Christie's",
      regions: regions({ breadcrumb: '来源：christies.com（佳士得）拍品详情' }),
    });
    expect(result.status).toBe('alias');
    expect(result.quote).toBe('佳士得');
  });

  it('原样命中记 hit，并带位置', () => {
    expect(matchHouseField({ asserted: 'Bonhams', regions: regions({ header: 'Bonhams 邦瀚斯' }) })).toMatchObject({
      status: 'hit',
      position: 'header',
    });
  });

  it('不在别名表里的机构只能逐字比（Finarte）', () => {
    expect(matchHouseField({ asserted: 'Finarte', regions: regions({ title: 'Finarte Milano' }) })).toMatchObject({
      status: 'hit',
      canonical: null,
    });
  });

  it('表里没有的写法不靠相似度硬判', () => {
    expect(matchHouseField({ asserted: '中国嘉德', regions: regions({ header: 'China Guardian 拍卖' }) }).status).toBe(
      'unjudgeable',
    );
  });

  it('四个区域都抽不出来时记「判不了」，不是「没有」', () => {
    const result = matchHouseField({ asserted: 'Bonhams', regions: EMPTY_HOUSE_REGIONS });
    expect(result.status).toBe('unjudgeable');
    expect(result.position).toBeNull();
    expect(result.detail).toContain('没有抽出可用的结构区域');
  });

  it('结构区域有内容但没拍行明文时，也记「判不了」并说明正文不算证据', () => {
    const result = matchHouseField({
      asserted: "Christie's",
      regions: regions({ breadcrumb: 'Live Auction 21663 › Important Chinese Ceramics' }),
    });
    expect(result.status).toBe('unjudgeable');
    expect(result.detail).toContain('邮箱');
  });

  it('断言为空不判', () => {
    expect(matchHouseField({ asserted: '  ', regions: regions({ header: 'Bonhams' }) }).status).toBe('unjudgeable');
  });
});

describe('extractHouseRegions — 只取页头/面包屑/标题区/场次抬头', () => {
  const HTML = `
    <html><head><title>Lot 42 | Bonhams</title></head>
    <body>
      <header><a href="/">Bonhams</a></header>
      <nav aria-label="Breadcrumb" class="breadcrumb">
        <span>Live Auction 21663</span><span>Important Chinese Ceramics</span>
      </nav>
      <h1>WANLI PERIOD (1573-1620)</h1>
      <div class="sale-heading"><h2>Fine Asian Art</h2></div>
      <div class="chr-promo">illustrated with pieces offered at Christie's</div>
      <p>All offered in Fine Asian Art on 6 November 2026 at Christie's in London</p>
      <p>联系人 malmeida@christies.com</p>
      <footer>© Christie's 2026</footer>
    </body></html>`;

  it('页头、面包屑、标题区、场次抬头都抽出来', () => {
    const regions = extractHouseRegions(HTML);
    expect(regions.header).toContain('Bonhams');
    expect(regions.breadcrumb).toContain('Important Chinese Ceramics');
    expect(regions.title).toContain('Lot 42');
    expect(regions.title).toContain('WANLI PERIOD');
    expect(regions.saleHeading).toContain('Fine Asian Art');
  });

  it('推广卡片、正文顺带提及、邮箱、页脚不进任何结构区域', () => {
    const regions = extractHouseRegions(HTML);
    const all = [regions.header, regions.breadcrumb, regions.title, regions.saleHeading].join(' ');
    expect(all).not.toContain('illustrated with pieces');
    expect(all).not.toContain('malmeida@christies.com');
    expect(all).not.toContain('©');
    expect(all).not.toContain('in London');
  });

  it('这份 HTML 上机构名只在正文/邮箱里：裁出来是「判不了」', () => {
    const result = matchHouseField({
      asserted: "Christie's",
      regions: extractHouseRegions(HTML.replace('<a href="/">Bonhams</a>', '<a href="/">首页</a>').replace('Lot 42 | Bonhams', 'Lot 42')),
    });
    expect(result.status).toBe('unjudgeable');
  });
});

describe('场次层契约', () => {
  const complete: SessionLayerRecord = {
    sessionKey: 'auction-29896',
    sessionName: 'Important Chinese Ceramics and Works of Art',
    sessionDate: '2026-10-29',
    houseCanonical: '佳士得',
    language: 'en',
    sessionUrl: 'https://www.christies.com/en/auction/auction-29896',
  };

  it('单件页只带 saleUrl：缺 4 项，记未测', () => {
    const verdict = evaluateSessionLayer({ sessionKey: 'https://www.bonhams.com/auction/32202/' });
    expect(verdict.status).toBe('not-measured');
    expect(verdict.missing).toEqual(['sessionName', 'sessionDate', 'houseCanonical', 'language']);
  });

  it('完全没有场次记录：5 项全缺', () => {
    expect(evaluateSessionLayer(null).missing).toEqual([
      'sessionKey',
      'sessionName',
      'sessionDate',
      'houseCanonical',
      'language',
    ]);
  });

  it('契约满足且同名：measured-match', () => {
    const result = matchSessionField({
      assertedName: 'Important Chinese Ceramics and Works of Art',
      assertedLanguage: 'en',
      record: complete,
    });
    expect(result.status).toBe('measured-match');
    expect(result.quote).toBe('Important Chinese Ceramics and Works of Art');
  });

  it('语种不同不硬判：language-mismatch（归未测）', () => {
    const result = matchSessionField({ assertedName: 'Fine Asian Art', assertedLanguage: 'en', record: complete });
    expect(result.status).toBe('measured-mismatch');
    const zh = matchSessionField({
      assertedName: '中国瓷器',
      assertedLanguage: 'zh',
      record: { ...complete, sessionName: '中国瓷器', language: 'en' },
    });
    expect(zh.status).toBe('language-mismatch');
  });

  it('契约满足但名字对不上：measured-mismatch', () => {
    const result = matchSessionField({ assertedName: 'Fine Asian Art Milan', assertedLanguage: 'en', record: complete });
    expect(result.status).toBe('measured-mismatch');
  });
});

const FILLER = ' 目录 导航 页脚'.repeat(40);

function rawPage(
  url: string,
  text: string,
  overrides: Partial<Parameters<typeof judgeCorpusPage>[0]> = {},
  pad = true,
): CorpusPageVerdict {
  return judgeCorpusPage({
    url,
    domain: new URL(url).hostname,
    kind: 'raw',
    text: pad ? text + FILLER : text,
    assertedHouse: 'Bonhams',
    assertedDate: '2 December 2003',
    assertedSessionName: null,
    assertedSessionLanguage: null,
    sessionRecord: null,
    houseRegions: { ...EMPTY_HOUSE_REGIONS, header: 'Bonhams 邦瀚斯' },
    ...overrides,
  });
}

describe('judgeCorpusPage / measureCorpusPages — 三档分开，未测不是 0', () => {
  it('模板页仍给判定，但不算可裁决材料（模板会自证）', () => {
    const verdict = judgeCorpusPage({
      url: 'https://www.bonhams.com/auction/1/lot/2',
      domain: 'www.bonhams.com',
      kind: 'template',
      text: '来源：Bonhams 拍品详情。拍卖时间：2003-12-02T10:00:00+00:00',
      assertedHouse: 'Bonhams',
      assertedDate: '2 December 2003',
      assertedSessionName: null,
      assertedSessionLanguage: null,
      sessionRecord: null,
      houseRegions: { ...EMPTY_HOUSE_REGIONS, header: '来源：Bonhams 拍品详情' },
    });
    expect(verdict.twoFieldsVerified).toBe(true);
    expect(verdict.adjudicable).toBe(false);
  });

  it('三档读数：可读率分母是全部页，两字段分母是可裁决页，三字段未测', () => {
    const pages: CorpusPageVerdict[] = [
      rawPage('https://a.example/lot/1', 'Bonhams 2 December 2003'),
      // 同一天但写法不同：归一后命中
      rawPage('https://a.example/lot/2', 'Bonhams 2 Dec 2003'),
      // 日期对不上：判据判不中
      rawPage('https://a.example/lot/3', 'Bonhams 5 May 2019'),
      // 正文太短：不可读，不进两字段分母
      rawPage('https://a.example/lot/4', 'Bonhams 2 December 2003', {}, false),
      judgeCorpusPage({
        url: 'https://b.example/lot/5',
        domain: 'b.example',
        kind: 'template',
        text: '来源：Bonhams 2 December 2003' + FILLER,
        assertedHouse: 'Bonhams',
        assertedDate: '2 December 2003',
        assertedSessionName: null,
        assertedSessionLanguage: null,
        sessionRecord: null,
        houseRegions: { ...EMPTY_HOUSE_REGIONS, header: '来源：Bonhams 拍品详情' },
      }),
      judgeCorpusPage({
        url: 'https://c.example/article',
        domain: 'c.example',
        kind: 'article',
        text: '一篇媒体赏析稿，提到 Bonhams 与 2 December 2003' + FILLER,
        assertedHouse: null,
        assertedDate: null,
        assertedSessionName: null,
        assertedSessionLanguage: null,
        sessionRecord: null,
        houseRegions: EMPTY_HOUSE_REGIONS,
      }),
    ];
    // 第 4 页只有 24 字符，低于 200：不可读
    const tiers = measureCorpusPages(pages, { truncatedUrls: new Set(['https://a.example/lot/2']) });

    expect(tiers.pages).toBe(6);
    expect(tiers.readableRate).toBe(83.3); // 5/6
    expect(tiers.adjudicable).toBe(3);
    expect(tiers.twoFieldHits).toBe(2);
    expect(tiers.twoFieldRate).toBe(66.7); // 2/3
    expect(tiers.verbatimTwoFieldHits).toBe(1);
    expect(tiers.sessionMeasured).toBe(0);
    expect(tiers.threeFieldRate).toBeNull();
    expect(tiers.material).toEqual({ template: 1, article: 1, unreadable: 1, truncated: 1 });
    expect(tiers.judgment).toEqual({ houseUnjudgeable: 0, dateMiss: 1, dateYearUnresolved: 0, sessionNotMeasured: 3 });
  });

  it('场次层契约满足后才算三字段', () => {
    const complete: SessionLayerRecord = {
      sessionKey: 'auction-1',
      sessionName: 'Fine Asian Art',
      sessionDate: '2003-12-02',
      houseCanonical: '邦瀚斯',
      language: 'en',
    };
    const page = rawPage('https://a.example/lot/1', 'Bonhams 2 December 2003', {
      assertedSessionName: 'Fine Asian Art',
      assertedSessionLanguage: 'en',
      sessionRecord: complete,
    });
    expect(page.threeFieldsVerified).toBe(true);
    const tiers = measureCorpusPages([page]);
    expect(tiers.sessionMeasured).toBe(1);
    expect(tiers.threeFieldRate).toBe(100);

    const unmeasured = rawPage('https://a.example/lot/2', 'Bonhams 2 December 2003');
    expect(unmeasured.threeFieldsVerified).toBeNull();
  });

  it('机构只在邮箱与推广卡片里出现：两字段判不了，旧口径仍记逐字', () => {
    const html = `<html><body>
      <nav aria-label="Breadcrumb"><span>Live Auction 21663</span><span>Important Chinese Ceramics and Works of Art</span></nav>
      <h1>WANLI PERIOD (1573-1620)</h1>
      <div class="promo">illustrated with pieces offered at Christie's</div>
      <p>Closed: 29 Oct 2026 · 联系人 malmeida@christies.com</p>
    </body></html>`;
    const text = `Live Auction 21663 Important Chinese Ceramics and Works of Art WANLI PERIOD (1573-1620) Close 29 Oct 2026 illustrated with pieces offered at Christie's malmeida@christies.com` + FILLER;
    const verdict = judgeCorpusPage({
      url: 'https://www.christies.com.cn/en/lot/lot-6608461',
      domain: 'www.christies.com.cn',
      kind: 'raw',
      text,
      assertedHouse: "Christie's",
      assertedDate: '29 October 2026',
      assertedSessionName: null,
      assertedSessionLanguage: null,
      sessionRecord: null,
      houseRegions: extractHouseRegions(html),
    });
    expect(verdict.house?.status).toBe('unjudgeable');
    expect(verdict.house?.position).toBeNull();
    expect(verdict.date?.status).toBe('normalized');
    expect(verdict.twoFieldsVerified).toBe(false);
    // 旧口径（整页逐字）仍记为命中，正是这次要修的那一条
    expect(verdict.verbatimBaseline?.house).toBe(true);
    expect(measureCorpusPages([verdict]).judgment.houseUnjudgeable).toBe(1);
  });
});
