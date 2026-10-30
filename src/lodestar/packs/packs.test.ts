// src/lodestar/packs/packs.test.ts
/**
 * 策略包测试（离线）
 *
 * 两类断言各有来头：
 * 1. **策略包可换性**——换一个包，路由结论与关键字段
 *    清单跟着变，证明这些判据真在包里而不在引擎里；
 * 2. **域内细则本身**——权威档位、来源家族归并、日期写法、列名别名、详情链接识别。
 *    这些是本包的全部"know-how"，判错了就得重做这份包，所以逐条钉住。
 */

import { describe, it, expect } from 'vitest';
import porcelainPack, { PORCELAIN_KEY_FIELDS } from './porcelain';
import {
  canonicalHouseName,
  categoryTagsFrom,
  familyOf,
  parseTimeScope,
  registrableDomain,
  tierOf,
} from './porcelain/rules';
import { fillTemplate, keyFieldKeysOf, type DomainPack } from './pack';
import type { RoutingInfo } from '../types';

/** 第二个包（测试夹具）：只改字段清单与路由结论，用来证明"域知识在包里" */
const stubPack: DomainPack = {
  id: 'stamp',
  label: '邮票（夹具域）',
  fields: () => [
    { key: 'issuer', label: '发行方', role: 'key', predicate: '发行方', claimTemplate: '{self} 发行', queryTemplates: ['{self} 发行'] },
    { key: 'issueYear', label: '发行年份', role: 'secondary', predicate: '发行年份', claimTemplate: '{self} 年发行', queryTemplates: ['{self} 发行年份'] },
  ],
  mapRow: (row) => ({ issuer: String(row['发行方'] ?? '') || null, issueYear: String(row['年份'] ?? '') || null }),
  timeScopeOf: () => ({ from: null, to: null }),
  categoryTagsOf: () => ['邮票'],
  recordMatchKey: (record) => `stamp:${record.fields.issuer ?? ''}`,
  valueMatchKey: (_fieldKey, value) => value.trim().toLowerCase(),
  // 夹具域故意一条写法都不给：证明引擎在包"认不出写法"时退回原值、且不因预筛无声丢证据
  querySurfaces: (_fieldKey, value) => [value.trim()],
  pageMentions: () => 'unknown',
  // 引文线索同样一律放行：替身包不实现这条，引擎必须按"判不了"处理而不是拒收
  quoteBearsFieldClue: () => 'unknown',
  enumerationPhrasings: (query) => [query],
  concretizationAsk: () => '补全发行方',
  route: (): RoutingInfo => ({ route: 'reject', mode: null, reason: 'stub-domain-not-audited' }),
  judgementRules: () => '夹具域无细则',
  cooccurrenceRule: () => '夹具域共现判据',
  evidenceDomains: () => ['example.com'],
  tierOf: () => 'unlisted',
  sourceFamilyOf: (d) => d,
  isDetailLink: () => true,
};

describe('策略包可换性：换一个包，结论跟着变', () => {
  it('关键字段清单由包给出，引擎不硬编码', () => {
    expect(PORCELAIN_KEY_FIELDS).toEqual(['auctionHouse', 'dateText', 'sessionName']);
    expect(keyFieldKeysOf(stubPack.fields())).toEqual(['issuer']);
  });

  it('同一条"总成交额"断言：瓷器包判 decompose，夹具包整域拒收', () => {
    const input = {
      atomicText: '中国嘉德2014年瓷器专场总成交额约 2 亿',
      subject: '中国嘉德',
      predicate: '总成交额',
      object: '约 2 亿',
      fieldKey: 'totalHammer',
      fieldRole: 'secondary' as const,
    };
    expect(porcelainPack.route(input).route).toBe('decompose');
    expect(stubPack.route(input).route).toBe('reject');
  });

  it('模板填充由引擎做，句子内容由包给', () => {
    const record = { auctionHouse: '中国嘉德', dateText: '2014年5月', sessionName: '瓷器工艺品专场' };
    const spec = porcelainPack.fields().find((f) => f.key === 'sessionName');
    expect(spec).toBeDefined();
    expect(fillTemplate(spec!.claimTemplate, record, 'sessionName')).toBe(
      '中国嘉德2014年5月举办的专场名称为「瓷器工艺品专场」',
    );
    // 缺值时折叠空格，不留占位符残渣
    expect(fillTemplate(spec!.claimTemplate, { auctionHouse: '中国嘉德', dateText: null, sessionName: 'X' }, 'sessionName'))
      .toBe('中国嘉德举办的专场名称为「X」');
  });
});

describe('路由：分类学只路由不打分，拒收要说清是哪一类', () => {
  it('物品级个体断言永久拒收', () => {
    expect(
      porcelainPack.route({
        atomicText: '这件青花盘的落槌价为 12 万',
        subject: '青花盘',
        predicate: '落槌价',
        object: '12 万',
        fieldKey: null,
        fieldRole: 'secondary',
      }).reason,
    ).toBe('object-level-individual-assertion');
  });

  it('统计量转 decompose，不进聚合裁决', () => {
    expect(porcelainPack.route({
      atomicText: '该场瓷器专场成交率 82%', subject: '该场', predicate: '成交率', object: '82%',
      fieldKey: null, fieldRole: 'secondary',
    }).route).toBe('decompose');
  });

  it('未来事件 / 自指 / 主观评价三类各自拒收', () => {
    const nextYear = new Date().getFullYear() + 1;
    const base = { subject: '中国嘉德', predicate: '举办专场', object: '瓷器专场', fieldKey: 'sessionName', fieldRole: 'key' as const };
    expect(porcelainPack.route({ ...base, atomicText: `${nextYear}年中国嘉德将办瓷器专场` }).reason).toBe('future-event');
    expect(porcelainPack.route({ ...base, atomicText: '我的训练数据里有这场瓷器专场' }).reason).toBe('self-referential');
    expect(porcelainPack.route({ ...base, atomicText: '这场瓷器专场极具价值' }).reason).toBe('subjective-value');
  });

  it('关键字段走 verify/L1，次要字段走 verify/L2', () => {
    const base = { atomicText: '中国嘉德举办过瓷器专场', subject: '中国嘉德', predicate: '主办机构', object: '瓷器专场', fieldKey: 'auctionHouse' };
    expect(porcelainPack.route({ ...base, fieldRole: 'key' })).toMatchObject({ route: 'verify', mode: 'L1' });
    expect(porcelainPack.route({ ...base, fieldRole: 'secondary' })).toMatchObject({ route: 'verify', mode: 'L2' });
  });
});

describe('注册域与来源家族归并', () => {
  it('去子域、保留国别多级后缀', () => {
    expect(registrableDomain('www.cguardian.com')).toBe('cguardian.com');
    expect(registrableDomain('duoyunxuan.com.cn')).toBe('duoyunxuan.com.cn');
    expect(registrableDomain('auction.artprice.com')).toBe('artprice.com');
  });

  it('同家族站点归并成一个独立来源（异域三判据里"跨语言与镜像站"那条）', () => {
    expect(familyOf('ha.com')).toBe('heritageauctions.com');
    expect(familyOf('www.ha.com')).toBe('heritageauctions.com');
    expect(familyOf('heritageauctions.com')).toBe('heritageauctions.com');
    expect(familyOf('polyauction.com.cn')).toBe('polypm.com.cn');
    expect(familyOf('m.polypm.com.cn')).toBe('polypm.com.cn');
  });
});

describe('权威档位：档位看内容身份，不看我们抓不抓得动', () => {
  it('机构自营站 official / 档案报道 primary / 聚合与零售 aggregator / 不在名单 unlisted', () => {
    expect(tierOf('www.cguardian.com')).toBe('official');   // 嘉德（candidate 状态仍算官方）
    expect(tierOf('polypm.com.cn')).toBe('official');
    expect(tierOf('sothebys.com')).toBe('official');
    expect(tierOf('artron.net')).toBe('primary');
    expect(tierOf('liveauctioneers.com')).toBe('aggregator'); // category=auction 但是多家聚合平台
    expect(tierOf('artnet.com')).toBe('aggregator');
    expect(tierOf('ebay.com')).toBe('aggregator');
    expect(tierOf('someone-random-blog.example')).toBe('unlisted');
  });

  it('域名集只从宿主系统的来源白名单只读派生，含已实锤的国内拍行且顺序确定', () => {
    const first = porcelainPack.evidenceDomains('列出近五年含民间瓷器的拍卖会');
    const second = porcelainPack.evidenceDomains('列出近五年含民间瓷器的拍卖会');
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
    expect(first).toContain('polypm.com.cn');
    expect(first).toContain('cguardian.com');
    expect(first).not.toContain('polyauction.com'); // 已证伪的死域不会从白名单里出来
  });

  it('瓷器类提问优先排中国拍行域名（域先验写在包里）', () => {
    const cnFirst = porcelainPack.evidenceDomains('民间瓷器专场');
    const indexOfPoly = cnFirst.indexOf('polypm.com.cn');
    const indexOfSothebys = cnFirst.indexOf('sothebys.com');
    expect(indexOfPoly).toBeLessThan(indexOfSothebys);
  });
});

describe('日期写法解析（关键字段之一：年份）', () => {
  it.each([
    ['2014年5月18日', '2014-05-18', '2014-05-18'],
    ['2014年12月3日', '2014-12-03', '2014-12-03'],
    ['2014年5月至6月', '2014-05-01', '2014-06-30'],
    ['2014/05/18 - 2014/05/31', '2014-05-18', '2014-05-31'],
    ['2014-05', '2014-05-01', '2014-05-31'],
    ['2014.5', '2014-05-01', '2014-05-31'],
    ['2014年', '2014-01-01', '2014-12-31'],
    ['2014春季', '2014-01-01', '2014-06-30'],
    ['2014 秋拍', '2014-07-01', '2014-12-31'],
  ] as const)('%s → %s ~ %s', (text, from, to) => {
    expect(parseTimeScope(text)).toEqual({ from, to });
  });

  it('解析不出即全 null，不猜', () => {
    expect(parseTimeScope('近年')).toEqual({ from: null, to: null });
    expect(parseTimeScope(null)).toEqual({ from: null, to: null });
  });
});

describe('列名别名与值清洗', () => {
  it('不同提问的列名归一到本包字段键，"无/不确定"当缺失', () => {
    const mapped = porcelainPack.mapRow({
      拍卖行: '中国嘉德',
      时间: '2014年5月',
      专场名称: '瓷器工艺品',
      地点: '无',
      与本包无关的列: '丢掉',
    });
    expect(mapped).toEqual({ auctionHouse: '中国嘉德', dateText: '2014年5月', sessionName: '瓷器工艺品' });
  });

  it('类目标签从专场名与类目字段里出，供宿主系统按类目匹配', () => {
    expect(porcelainPack.categoryTagsOf({
      recordId: 'rec-1',
      fields: { sessionName: '民间瓷器珍品', category: '陶瓷', auctionHouse: '北京保利' },
      rawText: '',
    })).toEqual(['瓷器', '陶瓷', '民间瓷器']);
  });

  it('机构写法归一（简称 / 英文 / 全称算同一家）', () => {
    expect(canonicalHouseName('嘉德')).toBe('中国嘉德');
    expect(canonicalHouseName('中国嘉德国际拍卖有限公司')).toBe('中国嘉德');
    expect(canonicalHouseName('保利')).toBe('北京保利');
    expect(canonicalHouseName('Sotheby\'s')).toBe('苏富比');
  });

  it('机构名繁体字形折成简体后仍算同一家（模型写「蘇富比」不再被当成另一家）', () => {
    expect(canonicalHouseName('蘇富比')).toBe('苏富比');
  });
});

describe('记录对齐键与字段等价键（稳定性复问靠它们数复现次数）', () => {
  const record = (fields: Record<string, string>) => ({ recordId: 'rec-x', fields, rawText: '' });

  it('简称与全称、年份与年月，算同一场事件', () => {
    const a = porcelainPack.recordMatchKey(record({ auctionHouse: '嘉德', dateText: '2014年5月', sessionName: '瓷器工艺品专场' }));
    const b = porcelainPack.recordMatchKey(record({ auctionHouse: '中国嘉德国际拍卖有限公司', dateText: '2014', sessionName: '瓷器工艺品' }));
    expect(a).toBe(b);
  });

  it('不同机构或不同年份不算同一场', () => {
    const a = porcelainPack.recordMatchKey(record({ auctionHouse: '嘉德', dateText: '2014年5月', sessionName: '瓷器' }));
    const b = porcelainPack.recordMatchKey(record({ auctionHouse: '保利', dateText: '2014年5月', sessionName: '瓷器' }));
    const c = porcelainPack.recordMatchKey(record({ auctionHouse: '嘉德', dateText: '2016年5月', sessionName: '瓷器' }));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('括号编号的两场不对齐成一场（剥尾词不能顺手把编号也剥掉）', () => {
    const one = porcelainPack.recordMatchKey(record({ auctionHouse: '嘉德', dateText: '2014', sessionName: '瓷器（一）专场' }));
    const two = porcelainPack.recordMatchKey(record({ auctionHouse: '嘉德', dateText: '2014', sessionName: '瓷器（二）' }));
    expect(one).not.toBe(two);
  });

  it('字段等价键把机构简称、日期写法收敛到同一个键', () => {
    expect(porcelainPack.valueMatchKey('auctionHouse', '嘉德')).toBe(porcelainPack.valueMatchKey('auctionHouse', '中国嘉德'));
    expect(porcelainPack.valueMatchKey('dateText', '2014年5月')).toBe(porcelainPack.valueMatchKey('dateText', '2014-05'));
    expect(porcelainPack.valueMatchKey('sessionName', '民间瓷器')).not.toBe(porcelainPack.valueMatchKey('sessionName', '官窑瓷器'));
    // 多写一个"专场"尾词不算新变体（否则稳定率会被记低，稳定率会被误读）
    expect(porcelainPack.valueMatchKey('sessionName', '珍瓷雅玩')).toBe(porcelainPack.valueMatchKey('sessionName', '珍瓷雅玩专场'));
  });

  it('夹具域的记录对齐键与瓷器域不同形（策略包可换性）', () => {
    expect(stubPack.recordMatchKey({ recordId: 'r', fields: { issuer: '邮电部' }, rawText: '' })).toBe('stamp:邮电部');
  });

  it('同场次繁体与简体两种写法归同一变体（不再拆成两条）', () => {
    expect(porcelainPack.valueMatchKey('sessionName', '瓷器工藝品專場')).toBe(
      porcelainPack.valueMatchKey('sessionName', '瓷器工艺品专场'),
    );
  });
});

describe('详情链接识别（坐标臂整场摊开用）', () => {
  const hub = 'https://www.polypm.com.cn/auction/auction_list.html?infoId=1541';

  it('拍品详情页算，枢纽页与附件不算', () => {
    const base = { hubUrl: hub, anchorText: '清光绪 青花盘', pathname: '', search: '', candidateUrl: '' };
    const detail = { ...base, pathname: '/auction/product_details.html', search: '?infoId=1000000000000000650' };
    expect(porcelainPack.isDetailLink({ ...detail, candidateUrl: 'https://www.polypm.com.cn/auction/product_details.html?infoId=1' })).toBe(true);
    const hubAgain = { ...base, pathname: '/auction/auction_list.html', search: '', candidateUrl: hub };
    expect(porcelainPack.isDetailLink(hubAgain)).toBe(false);
    const pdf = { ...base, pathname: '/files/catalog.pdf', search: '', candidateUrl: 'https://www.polypm.com.cn/files/catalog.pdf' };
    expect(porcelainPack.isDetailLink(pdf)).toBe(false);
  });

  it('导航锚文本直接否掉（"更多"链到详情路径也不算）', () => {
    expect(porcelainPack.isDetailLink({
      hubUrl: hub,
      candidateUrl: 'https://www.polypm.com.cn/auction/product_details.html?infoId=2',
      anchorText: '查看更多',
      pathname: '/auction/product_details.html',
      search: '?infoId=2',
    })).toBe(false);
  });

  it('带 infoId 的场次页仍是枢纽页（两跳的第一跳，不是拍品详情）', () => {    const sessionList = {
      hubUrl: hub,
      candidateUrl: 'https://www.polypm.com.cn/auction/auction_list.html?oldData=false&infoId=79',
      anchorText: '瓷器工艺品专场',
      pathname: '/auction/auction_list.html',
      search: '?oldData=false&infoId=79',
    };
    const sessionIndex = {
      ...sessionList,
      candidateUrl: 'https://www.polypm.com.cn/auction/auction_index.html?infoId=1541',
      pathname: '/auction/auction_index.html',
      search: '?infoId=1541',
    };
    const lot = {
      ...sessionList,
      candidateUrl: 'https://www.polypm.com.cn/auction/product_details.html?infoId=1000000000000000650',
      pathname: '/auction/product_details.html',
      search: '?infoId=1000000000000000650',
    };
    expect(porcelainPack.isDetailLink(sessionList)).toBe(false);
    expect(porcelainPack.isDetailLink(sessionIndex)).toBe(false);
    expect(porcelainPack.isDetailLink(lot)).toBe(true);
  });

  it('枢纽页形态只喂排序与重取预算：索引/场次列表像枢纽，拍品详情与新闻稿不像', () => {
    expect(porcelainPack.isHubUrl?.('https://www.polypm.com.cn/auction/auction_index.html?infoId=1541')).toBe(true);
    expect(porcelainPack.isHubUrl?.('https://www.polypm.com.cn/auction/auction_list.html?oldData=false&infoId=79')).toBe(true);
    expect(porcelainPack.isHubUrl?.('https://www.polypm.com.cn/auction/product_details.html?infoId=1001')).toBe(false);
    expect(porcelainPack.isHubUrl?.('https://news.example.com/2021/11/25/1027738.shtml')).toBe(false);
  });
});
