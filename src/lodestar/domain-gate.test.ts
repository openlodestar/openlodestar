// src/lodestar/domain-gate.test.ts
/**
 * 域名真实性闸：只淘汰"地址不存在"，不碰"真站拒绝抓取"
 *
 * 这一道闸的全部价值在于两类失败不能混：
 * - 解析不到（ENOTFOUND / NXDOMAIN / ENODATA）→ 线索是假的，淘汰；
 * - 超时、SERVFAIL、临时网络故障 → 这次没问到，保留等下次（`unknown`）。
 * 把后者也淘汰，等于用一次 DNS 抖动把真站判死。
 */

import { describe, expect, it } from 'vitest';
import {
  classifyDnsFailure,
  domainOf,
  domainVerdictOf,
  gateCandidatesByDomain,
  type DomainCheckFixture,
} from './domain-gate';
import { measureLiveRecall, type LiveRecallFixture } from './live-recall';
import porcelainPack from './packs/porcelain';

function fixture(checks: DomainCheckFixture['checks']): DomainCheckFixture {
  return { version: 1, kind: 'domain-check-replay', capturedAt: '2026-11-09T00:00:00.000Z', checks };
}

describe('domainOf', () => {
  it('取主机名：小写、去掉 www.', () => {
    expect(domainOf('https://www.Artnet.com/articles/x')).toBe('artnet.com');
    expect(domainOf('http://china-guardian.com/a/b')).toBe('china-guardian.com');
  });

  it('解析不出 URL 时返回空串（不抛错）', () => {
    expect(domainOf('not a url')).toBe('');
  });
});

describe('classifyDnsFailure', () => {
  it('明确的"没有这条记录"判为 nonexistent', () => {
    for (const code of ['ENOTFOUND', 'NXDOMAIN', 'ENODATA']) {
      const error = Object.assign(new Error(`queryA ${code}`), { code });
      expect(classifyDnsFailure(error).verdict).toBe('nonexistent');
    }
  });

  it('超时与临时故障判为 unknown（保留，不判死）', () => {
    for (const code of ['ETIMEOUT', 'SERVFAIL', 'EAI_AGAIN', 'ECONNREFUSED']) {
      const error = Object.assign(new Error(`queryA ${code}`), { code });
      expect(classifyDnsFailure(error).verdict).toBe('unknown');
    }
  });

  it('保留原始错误消息，供人复核', () => {
    const error = Object.assign(new Error('getaddrinfo ENOTFOUND china-guardian.com'), { code: 'ENOTFOUND' });
    expect(classifyDnsFailure(error).detail).toContain('getaddrinfo ENOTFOUND');
  });
});

describe('domainVerdictOf', () => {
  const sample = fixture([
    { domain: 'china-guardian.com', verdict: 'nonexistent', detail: 'getaddrinfo ENOTFOUND' },
    { domain: 'artnet.com', verdict: 'exists', detail: '151.101.1.1' },
    { domain: 'slow.example', verdict: 'unknown', detail: 'timeout' },
  ]);

  it('查得到就返回冻结的判定', () => {
    expect(domainVerdictOf(sample, 'https://www.china-guardian.com/x')).toBe('nonexistent');
    expect(domainVerdictOf(sample, 'https://artnet.com/x')).toBe('exists');
    expect(domainVerdictOf(sample, 'https://slow.example/x')).toBe('unknown');
  });

  it('不在样本里的域名按 unknown 保留（不凭缺失判死）', () => {
    expect(domainVerdictOf(sample, 'https://unknown.example/x')).toBe('unknown');
    expect(domainVerdictOf(undefined, 'https://china-guardian.com/x')).toBe('unknown');
  });
});

describe('gateCandidatesByDomain', () => {
  const sample = fixture([
    { domain: 'china-guardian.com', verdict: 'nonexistent' },
    { domain: 'artnet.com', verdict: 'exists' },
    { domain: 'slow.example', verdict: 'unknown' },
  ]);
  const items = [
    { url: 'https://china-guardian.com/a' },
    { url: 'https://artnet.com/b' },
    { url: 'https://slow.example/c' },
    { url: 'https://not-in-sample.example/d' },
  ];

  it('只淘汰"地址不存在"，保留解析成功与判不了的', () => {
    const { kept, rejected } = gateCandidatesByDomain(items, sample);
    expect(kept.map((item) => item.url)).toEqual([
      'https://artnet.com/b',
      'https://slow.example/c',
      'https://not-in-sample.example/d',
    ]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ url: 'https://china-guardian.com/a', domain: 'china-guardian.com' });
    expect(rejected[0]!.reason).toContain('这个地址不存在');
  });

  it('"真站被拦"不在这道闸里：artnet 即使 403 也保留', () => {
    const { kept } = gateCandidatesByDomain([{ url: 'https://artnet.com/b' }], sample);
    expect(kept).toHaveLength(1);
  });
});

describe('召回层接入（measureLiveRecall）', () => {
  function recallFixture(items: Array<{ url: string; title: string }>): LiveRecallFixture {
    return {
      slug: 'synthetic',
      queries: ['北京保利 2021冬季拍卖会 禹贡 盛清御瓷新风尚'],
      translation: null,
      matchTerms: ['北京保利'],
      tracks: [
        {
          language: null,
          queries: ['北京保利 2021冬季拍卖会 禹贡 盛清御瓷新风尚'],
          results: items.map((item, index) => ({
            ...item,
            snippet: '北京保利 2021 冬季拍卖会',
            position: index + 1,
            queryIndex: 0,
          })),
        },
      ],
    };
  }

  const domains = fixture([{ domain: 'china-guardian.com', verdict: 'nonexistent' }]);

  it('编造域名的页被淘汰，只剩真域名时仍算召回成功', () => {
    const result = measureLiveRecall(
      { ...recallFixture([
        { url: 'https://china-guardian.com/a', title: '北京保利 2021 冬季拍卖会' },
        { url: 'https://artnet.com/b', title: '北京保利 2021 冬季拍卖会' },
      ]), domains },
      porcelainPack,
    );
    expect(result.rows[0]!.adjudicable).toBe(1);
    expect(result.rows[0]!.hit).toBe(true);
    expect(result.domainRejected).toEqual([
      { queryIndex: 0, url: 'https://china-guardian.com/a', domain: 'china-guardian.com' },
    ]);
  });

  it('整页都是编造域名时不算召回成功（静态自洽率跟着掉）', () => {
    const result = measureLiveRecall(
      { ...recallFixture([{ url: 'https://china-guardian.com/a', title: '北京保利 2021 冬季拍卖会' }]), domains },
      porcelainPack,
    );
    expect(result.rows[0]!.adjudicable).toBe(0);
    expect(result.hit).toBe(0);
    expect(result.value).toBe(0);
  });
});
