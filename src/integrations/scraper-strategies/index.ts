// src/integrations/scraper-strategies/index.ts
/** 单页 HTML 获取（唯一出口） */

export { fetchSinglePageHtml, closeSinglePageBrowser, type SinglePageResult } from './single-page-fetch';
export { processHtml } from './scraper-utils';
