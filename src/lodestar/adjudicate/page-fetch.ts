// src/lodestar/adjudicate/page-fetch.ts
/**
 * 证据页抓取与正文快照落盘
 *
 * 快照存的是**模型实际读过的那份清洗正文**，不是原始 HTML。理由：证据必须自抓、引文必须逐字——
 * "引文能在自己的快照里逐字命中"，可比对的那份文本必须就是判定当时用的那份——
 * 存原始 HTML 而让模型读清洗文本，逐字校验会因标签与空白差异大面积失败，
 * 最后逼出"放宽匹配"这种自我削弱的改动。
 *
 * 抓取本身复用宿主系统既有通路（站点适配器 → 纯 fetch → 浏览器降级 + URL 缓存），
 * 浏览器不可用时把信号原样交给上层：那是 `paused`，不是判失败、也不消耗重试预算。
 *
 * 对**声明浏览器必备**的策略包（`requirements.browser === 'required'`），证据页直接走
 * 浏览器渲染、不再先试裸 fetch：这类域名的站点常以 200 返回一个只有导航与脚本的空壳，
 * 裸 fetch 既不报错也抓不到正文，先试后降级永远等不到降级。是否强制由调用方按包声明传入，
 * 引擎不替领域做判断。
 */

import { processHtml } from '../../integrations/scraper-strategies/scraper-utils';
import { fetchSinglePageHtml, type SinglePageResult } from '../../integrations/scraper-strategies';
import { findBrowserUnavailableError } from '../../utils/browser-unavailable-error';
import { snapshotRefFor } from '../paths';
import { writeSnapshot, type LodestarStore } from '../storage/adapter';

/**
 * 喂给比对模型的正文上限（约 8k token；再长页面尾部的命中概率低，且成本不可比）。
 * 每次抓取页都伴一次按此体积计费的模型调用，是本轮花费的第二个乘数，
 * 故留出 env 覆盖口：`LODESTAR_PAGE_TEXT_BUDGET`（不设即 16000 字）。
 */
export function pageTextCharBudget(): number {
  const parsed = Number(process.env.LODESTAR_PAGE_TEXT_BUDGET);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 16_000;
}

/** 默认上限（保留常量导出，供文档与测试引用） */
export const PAGE_TEXT_CHAR_BUDGET = 16_000;

/** 一页已抓回并准备好比对的证据素材 */
export interface CapturedPage {
  url: string;
  /** 清洗后的正文（模型读的就是这一份） */
  text: string;
  /** 底稿目录内的快照引用 */
  snapshotRef: string;
  /** 抓取时刻（ISO） */
  fetchedAt: string;
  strategy: 'cache' | 'site-adapter' | 'fetch' | 'browser';
}

/** 需要浏览器但浏览器不可用：上层据此把断言推进到 paused 状态 */
export class PageNeedsBrowserError extends Error {
  readonly url: string;
  constructor(url: string, message: string) {
    super(message);
    this.name = 'PageNeedsBrowserError';
    this.url = url;
  }
}

/** 抓页失败（4xx / 反爬 / 空页）：不是浏览器问题，记进足迹继续下一候选 */
export class PageFetchFailedError extends Error {
  readonly url: string;
  constructor(url: string, message: string) {
    super(message);
    this.name = 'PageFetchFailedError';
    this.url = url;
  }
}

/**
 * 抓取一页并落快照。
 *
 * @param evidenceId 快照按证据行命名（一行一文件，verify-quotes 脚本按它回查）
 * @param options.forceBrowser 跳过裸 fetch、直接用浏览器渲染（包声明浏览器必备时由上层传入）
 */
export async function captureEvidencePage(
  store: LodestarStore,
  evidenceId: string,
  url: string,
  options: { forceRefresh?: boolean; forceBrowser?: boolean } = {},
): Promise<CapturedPage> {
  let fetched: SinglePageResult;
  try {
    // allowSiteAdapter:false —— 证据必须是第三方页面上印着的那份正文，
    // 站点适配器按站方接口替我们拼的 HTML 不算（"我们自己改写过的正文"不算自抓原文）
    fetched = await fetchSinglePageHtml(url, {
      forceRefresh: options.forceRefresh,
      forceBrowser: options.forceBrowser,
      allowSiteAdapter: false,
    });
  } catch (error) {
    const unavailable = findBrowserUnavailableError(error);
    if (unavailable) throw new PageNeedsBrowserError(url, unavailable.message);
    throw new PageFetchFailedError(url, error instanceof Error ? error.message : String(error));
  }
  if (!fetched.ok) {
    throw new PageFetchFailedError(url, `抓回空页面（策略 ${fetched.strategy}）`);
  }

  const cleaned = await processHtml(fetched.html);
  const text = cleaned.trim() === '' ? fetched.html : cleaned;
  const snapshotText = text.slice(0, pageTextCharBudget());
  const snapshotRef = snapshotRefFor(evidenceId);
  await writeSnapshot(store, snapshotRef, snapshotText);

  return {
    url,
    text: snapshotText,
    snapshotRef,
    fetchedAt: new Date().toISOString(),
    strategy: fetched.strategy,
  };
}
