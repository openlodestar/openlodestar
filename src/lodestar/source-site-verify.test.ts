import { describe, expect, it } from 'vitest';
import {
  htmlToPlainText,
  renderSiteVerifyReport,
  siteSearchQuery,
  topicHits,
  type SiteVerifyReportInput,
} from './source-site-verify';

const TOPIC = { period: '清代', material: '黄花梨', topic: '黄花梨躺椅' };

describe('htmlToPlainText', () => {
  it('去掉脚本、样式、标签与实体', () => {
    const html = '<div>清代<b>黄花梨</b>&nbsp;躺椅</div><script>var x=1</script>';
    expect(htmlToPlainText(html)).toBe('清代 黄花梨 躺椅');
  });
});

describe('siteSearchQuery', () => {
  it('按域名约束，材质与器物分开时都拼上，年代不进查询', () => {
    expect(siteSearchQuery('cguardian.com', TOPIC)).toBe('site:cguardian.com 黄花梨躺椅');
    expect(siteSearchQuery('artron.net', { period: null, material: null, topic: '黄花梨躺椅' })).toBe(
      'site:artron.net 黄花梨躺椅',
    );
  });

  it('没有器物主题时返回 null（只剩域名会搜回整站）', () => {
    expect(siteSearchQuery('artron.net', { period: '清代', material: '黄花梨', topic: null })).toBeNull();
  });
});

describe('topicHits', () => {
  it('页面同时写到材质与器物即命中，年代只记加分', () => {
    const hit = topicHits('清代黄花梨躺椅，长 180cm', TOPIC);
    expect(hit).toEqual({ material: true, object: true, period: true, matched: true });
  });

  it('材质同义词（花梨）也认；只写到类别不算', () => {
    expect(topicHits('花梨木躺椅', TOPIC).matched).toBe(true);
    expect(topicHits('古典家具专场', TOPIC).matched).toBe(false);
    expect(topicHits('黄花梨圈椅', TOPIC).matched).toBe(false);
  });

  it('没给材质时要求器物词完整出现', () => {
    const topic = { period: null, material: null, topic: '黄花梨躺椅' };
    expect(topicHits('清代黄花梨躺椅', topic).matched).toBe(true);
    expect(topicHits('黄花梨圈椅', topic).matched).toBe(false);
  });
});

describe('renderSiteVerifyReport', () => {
  it('逐站写判定与页面命中，表格竖线转义', () => {
    const input: SiteVerifyReportInput = {
      meta: { stamp: '20261025-190000', topic: TOPIC, maxPagesPerSite: 2, maxTotalPages: 6, browser: true },
      sites: [
        {
          site: '中国|嘉德',
          domains: ['cguardian.com'],
          searches: [{ domain: 'cguardian.com', query: 'site:cguardian.com 黄花梨躺椅', resultCount: 8 }],
          pages: [
            {
              url: 'https://www.cguardian.com/a',
              ok: true,
              fetcher: 'fetch',
              plainLength: 500,
              mention: { material: true, object: true, period: true, matched: true },
            },
          ],
          verdict: 'hit',
        },
        {
          site: '雅昌艺术网',
          domains: [],
          searches: [],
          pages: [],
          verdict: 'no-domain',
          note: '记忆里的站名对不上已知白名单域',
        },
      ],
    };
    const md = renderSiteVerifyReport(input);
    expect(md).toContain('中国\\|嘉德');
    expect(md).toContain('### 中国|嘉德 — 命中');
    expect(md).toContain('### 雅昌艺术网 — 无已知域名');
    expect(md).toContain('命中 1 · 未命中 0 · 其他 1');
    expect(md).toContain('命中不等于入口可采');
  });
});
