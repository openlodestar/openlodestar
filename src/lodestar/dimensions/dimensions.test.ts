import { describe, expect, it } from 'vitest';
import { assertionTimeWindow, evidenceTimeWindow } from '../packs/porcelain/rules';
import { parseComparison, quoteMatches } from '../adjudicate/compare';
import {
  DIMENSION_STATE_WEIGHT,
  dimensionForField,
  gradeDimensions,
  registerDimension,
  type DimensionEntry,
} from './index';
import { compareTimeDimension } from './time';
import { cityOf, compareInstitutionDimension } from './institution';

function entry(dimension: string, state: DimensionEntry['state'], cap = 1, label = dimension): DimensionEntry {
  return { dimension, label, state, cap };
}

describe('时间维度：复用现有窗口读数，不复制季节表', () => {
  it('断言侧不扩、证据侧季节词两端各放宽一个月', () => {
    expect(assertionTimeWindow('2021年秋季')).toEqual({ from: '2021-09-01', to: '2021-11-30' });
    expect(evidenceTimeWindow('2021年秋季')).toEqual({ from: '2021-08-01', to: '2021-12-31' });
    expect(assertionTimeWindow('2021年12月5日')).toEqual({ from: '2021-12-05', to: '2021-12-05' });
    expect(evidenceTimeWindow('2021年12月5日')).toEqual({ from: '2021-12-05', to: '2021-12-05' });
  });

  it('证据更细且落在断言范围内 → 完全对上', () => {
    expect(compareTimeDimension('2021年秋季', '2021年10月')).toMatchObject({ state: 'exact' });
    expect(compareTimeDimension('2021年秋季', '2021年秋季')).toMatchObject({ state: 'exact' });
  });

  it('同一段时间的粗写 → 口径相容', () => {
    expect(compareTimeDimension('2021年10月', '2021年秋季')).toMatchObject({ state: 'caliber' });
  });

  it('秋季 对 8 月 → 口径相容，折算 0.7', () => {
    const result = compareTimeDimension('2021年8月', '2021年秋季');
    expect(result.state).toBe('caliber');
    expect(DIMENSION_STATE_WEIGHT[result.state]).toBe(0.7);
  });

  it('秋季 对 12 月 → 边缘相容，折算 0.3', () => {
    const result = compareTimeDimension('2021年12月', '2021年秋季');
    expect(result.state).toBe('edge');
    expect(DIMENSION_STATE_WEIGHT[result.state]).toBe(0.3);
  });

  it('日期只擦到放宽圈的边 → 边缘相容', () => {
    const result = compareTimeDimension('2021年12月5日', '2021年秋季');
    expect(result.state).toBe('edge');
  });

  it('放宽窗也不相交 → 明确冲突', () => {
    expect(compareTimeDimension('2022年春季', '2021年秋季')).toMatchObject({ state: 'conflict' });
  });

  it('任一侧解析不出 → 无从判断', () => {
    expect(compareTimeDimension('那一年秋天前后', '2021年秋季')).toMatchObject({ state: 'unknown' });
  });
});

describe('机构维度：同名与地点限定词', () => {
  it('北京嘉德 对 在北京市的嘉德 → 完全对上', () => {
    expect(compareInstitutionDimension('在北京市的嘉德', '北京嘉德')).toMatchObject({ state: 'exact' });
  });

  it('一方多带地点限定词 → 口径相容', () => {
    expect(compareInstitutionDimension('中国嘉德', '北京嘉德')).toMatchObject({ state: 'caliber' });
  });

  it('限定词指向不同城市 → 明确冲突', () => {
    expect(compareInstitutionDimension('北京嘉德', '香港嘉德')).toMatchObject({ state: 'conflict' });
  });

  it('不同机构 → 没对上', () => {
    expect(compareInstitutionDimension('北京嘉德', '北京保利')).toMatchObject({ state: 'mismatch' });
  });

  it('城市词归一（北京市按北京算）', () => {
    expect(cityOf('在北京市的嘉德')).toBe('北京');
  });
});

describe('跨维度累积与判定顺序', () => {
  it('验收一：秋季＋北京嘉德 对 8月＋北京市的嘉德 → 强坐标', () => {
    const time = compareTimeDimension('2021年8月', '2021年秋季');
    const institution = compareInstitutionDimension('北京市的嘉德', '北京嘉德');
    const grade = gradeDimensions([
      entry('porcelain:dateText', time.state, 1, '举办时间'),
      entry('porcelain:auctionHouse', institution.state, 1, '拍卖机构'),
    ]);

    expect(time.state).toBe('caliber');
    expect(institution.state).toBe('exact');
    expect(grade.score).toBe(1.7);
    expect(grade.grade).toBe('strong');
    expect(grade.basis).toContain('举办时间');
    expect(grade.basis).toContain('拍卖机构');
  });

  it('验收二：秋季 对 12月5日 → 不是强坐标，但高于零', () => {
    const time = compareTimeDimension('2021年12月5日', '2021年秋季');
    const grade = gradeDimensions([entry('porcelain:dateText', time.state)]);

    expect(time.state).toBe('edge');
    expect(grade.grade).toBe('weak');
    expect(grade.score).toBeGreaterThan(0);
    expect(grade.score).toBe(0.3);
  });

  it('冲突否决先于算分：任一维冲突直接判弱', () => {
    const grade = gradeDimensions([
      entry('porcelain:dateText', 'exact'),
      entry('porcelain:auctionHouse', 'conflict'),
    ]);

    expect(grade.grade).toBe('weak');
    expect(grade.score).toBe(0);
    expect(grade.conflictDimensions).toEqual(['porcelain:auctionHouse']);
  });

  it('单维完全对上只有 1.0，够不到强坐标（必须两维起步）', () => {
    const grade = gradeDimensions([entry('porcelain:dateText', 'exact')]);
    expect(grade.score).toBe(1);
    expect(grade.grade).toBe('weak');
  });

  it('次要维度上限 0.5：两个次要维度口径相容也升不了强', () => {
    const grade = gradeDimensions([
      entry('secondary:a', 'caliber', 0.5),
      entry('secondary:b', 'caliber', 0.5),
    ]);
    expect(grade.score).toBe(0.7);
    expect(grade.grade).toBe('weak');
  });
});

describe('维度注册：加一份实现即可接入，核心不改', () => {
  it('注册后可按 域:字段 取到', () => {
    registerDimension({
      id: 'test:material',
      label: '材质',
      weightCap: 1,
      canStandAlone: false,
      edgeRule: '同义写法算口径相容',
      compare: () => ({ state: 'exact', note: '测试维度' }),
    });

    expect(dimensionForField('test', 'material')?.id).toBe('test:material');
    expect(dimensionForField('test', 'material')?.compare({ claimValue: '青花', matchedValue: '青花瓷' }).state).toBe(
      'exact',
    );
  });
});

describe('抽取层只摘逐字原文值', () => {
  it('parseComparison 读取 matchedValue', () => {
    const raw = JSON.stringify({
      relation: 'supports',
      quote: '2021年秋季拍卖会于北京举行',
      matchedValue: '2021年秋季',
      contentWeight: 1,
      pageTopic: '秋拍报道',
      rationale: '页面直接写明了时间',
    });
    const outcome = parseComparison(raw);
    expect('rejected' in outcome).toBe(false);
    if (!('rejected' in outcome)) expect(outcome.matchedValue).toBe('2021年秋季');
  });

  it('匹配校验按引文子串：改写后的值不算命中', () => {
    expect(quoteMatches('2021年秋季', '2021年秋季拍卖会于北京举行')).toBe(true);
    expect(quoteMatches('2021年8月', '2021年秋季拍卖会于北京举行')).toBe(false);
  });
});
