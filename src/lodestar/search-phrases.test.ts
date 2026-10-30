// src/lodestar/search-phrases.test.ts
/**
 * 检索键测试（离线，无网络产物）
 *
 * 钉三件事：标点剥空格的通用规则、短语由包的首选写法机械拼出（不造新词）、
 * 旧坐标（无 searchPhrases 列）按字段现算不要求重跑引擎。
 */

import { describe, it, expect } from 'vitest';
import { buildSearchPhrases, buildSourceSearchPhrases, searchPhrasesOf, stripPunctuationToSpaces } from './search-phrases';
import porcelainPack from './packs/porcelain';
import type { AnchorRecord } from './types';

describe('stripPunctuationToSpaces', () => {
  it('中英标点与全角符号都剥成单个空格，文字数字保留', () => {
    expect(stripPunctuationToSpaces('「禹贡」——御制瓷器专场（II）')).toBe('禹贡 御制瓷器专场 II');
    expect(stripPunctuationToSpaces('Poly Auction, 2021 Autumn')).toBe('Poly Auction 2021 Autumn');
  });

  it('连续标点折叠成一个空格，首尾不留空白', () => {
    expect(stripPunctuationToSpaces('  保利···禹贡！！')).toBe('保利 禹贡');
    expect(stripPunctuationToSpaces('')).toBe('');
  });

  it('日期与百分号这类非标点字符不动', () => {
    expect(stripPunctuationToSpaces('2021年11月')).toBe('2021年11月');
    expect(stripPunctuationToSpaces('成交额33.5亿')).toBe('成交额33 5亿');
  });
});

describe('buildSearchPhrases', () => {
  it('按关键字段顺序取包的首选写法拼合：全键一条 + 机构专场紧凑一条', () => {
    const phrases = buildSearchPhrases(
      { auctionHouse: '北京保利拍卖', dateText: '2021年11月', sessionName: '「禹贡」系列专场', location: null },
      porcelainPack,
    );
    expect(phrases.length).toBe(2);
    expect(phrases[0]).toBe('北京保利 2021秋季拍卖会 禹贡系列专场');
    expect(phrases[1]).toBe('北京保利 禹贡系列专场');
  });

  it('全角括号机构名（中国嘉德（香港））不把括号带进短语', () => {
    const phrases = buildSearchPhrases(
      { auctionHouse: '中国嘉德（香港）', dateText: '2024年4月', sessionName: '大巧若拙——竹月堂藏瓷II' },
      porcelainPack,
    );
    for (const phrase of phrases) {
      expect(phrase).not.toMatch(/[（）「」——]/);
      expect(phrase).not.toMatch(/\s{2,}/);
    }
  });

  it('关键字段全缺时返回空数组，不抛错', () => {
    expect(buildSearchPhrases({ auctionHouse: null, dateText: null, sessionName: null }, porcelainPack)).toEqual([]);
  });
});

describe('searchPhrasesOf', () => {
  it('旧坐标没有 searchPhrases 列时按字段现算', () => {
    const legacy = { fields: { auctionHouse: '北京保利拍卖', dateText: '2021年11月', sessionName: '「禹贡」系列专场' } } as unknown as AnchorRecord;
    expect(searchPhrasesOf(legacy, porcelainPack)).toEqual(buildSearchPhrases(legacy.fields, porcelainPack));
  });

  it('已有 searchPhrases 列的坐标原样返回，不重算', () => {
    const stored = {
      searchPhrases: ['落库的原短语'],
      fields: { auctionHouse: '北京保利拍卖', dateText: '2021年11月', sessionName: '「禹贡」系列专场' },
    } as unknown as AnchorRecord;
    expect(searchPhrasesOf(stored, porcelainPack)).toEqual(['落库的原短语']);
  });
});

describe('来源坐标的检索短语', () => {
  const FIELDS = {
    topic: '黄花梨躺椅',
    period: '清代',
    material: '黄花梨',
    sourceName: '中国嘉德',
    category: '古典家具',
  };

  it('包给来源短语：完整身份在前，主题紧凑形态在后（主题检索性最好）', () => {
    expect(buildSourceSearchPhrases(FIELDS, porcelainPack)).toEqual([
      '中国嘉德 清代 黄花梨 黄花梨躺椅',
      '清代 黄花梨 黄花梨躺椅',
      '黄花梨 黄花梨躺椅',
    ]);
  });

  it('searchPhrasesOf 按 kind 选生成器：source 坐标不会去拼事件的机构+时间+专场', () => {
    const source = { kind: 'source', fields: FIELDS } as unknown as AnchorRecord;
    expect(searchPhrasesOf(source, porcelainPack)).toEqual(buildSourceSearchPhrases(FIELDS, porcelainPack));
  });

  it('包没给来源短语时按来源关键字段机械拼合', () => {
    const bare = { ...porcelainPack, sourceSearchPhrases: undefined };
    expect(buildSourceSearchPhrases(FIELDS, bare)).toEqual(['黄花梨躺椅 清代']);
  });

  it('关键来源字段全缺 → 空数组（fields 本身就是身份，不造短语）', () => {
    expect(buildSourceSearchPhrases({ topic: null, period: null, material: '黄花梨' }, porcelainPack)).toEqual([]);
  });
});
