// src/integrations/search-providers/contract.ts
/**
 * 搜索提供者契约（初版）
 *
 * 这是**扩展生态的接口承诺**：第三方提供者过这份检查，引擎就能把它当一等公民用。
 * 刻意不依赖 vitest——扩展包作者可以在自己的仓库里 import 这份检查跑。
 *
 * 已定条款（只列能离线自动验证的部分；"搜得准不准"不在契约里，那是评估集的事）：
 * 1. name 是小写 slug（字母开头，只含小写字母/数字/连字符）；
 * 2. capabilities 若声明，得是对象；`siteOperator` 若声明必须是 boolean
 *    （声明 true 意味着真的支持 `site:` 语法——检索层会据此发域定向查询）；
 * 3. 空查询集短路：不发请求、不抛错、返回空 results；
 * 4. 结果项形状：url 为 http(s)；title/snippet 为字符串；position 从 1 起；
 *    queryIndex 落在查询下标范围内。
 *
 * 第 4 条需要真实调用才能验证，用 `resultItemViolations()` 在拿到结果后检查。
 */

import type { SearchProvider, SearchResultItem } from './types';

export interface ContractViolation {
  /** 条款 id（见 SEARCH_PROVIDER_CONTRACT_CLAUSES） */
  clause: string;
  detail: string;
}

export const SEARCH_PROVIDER_CONTRACT_CLAUSES: ReadonlyArray<{ id: string; text: string }> = [
  { id: 'name-slug', text: 'name 是小写 slug（字母开头，只含小写字母/数字/连字符）' },
  { id: 'capabilities-shape', text: 'capabilities 若声明必须为对象；siteOperator 若声明必须为 boolean' },
  { id: 'empty-queries', text: '空查询集短路：不抛错、返回空 results（不发任何请求）' },
  {
    id: 'result-shape',
    text: '结果项：url 为 http(s)；title/snippet 为字符串；position 从 1 起；queryIndex 在查询下标范围内',
  },
];

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * 跑一遍离线可验证的契约条款。
 *
 * @returns 违规清单（空数组 = 通过）
 */
export async function checkSearchProviderContract(provider: SearchProvider): Promise<ContractViolation[]> {
  const violations: ContractViolation[] = [];

  if (typeof provider.name !== 'string' || !NAME_PATTERN.test(provider.name)) {
    violations.push({ clause: 'name-slug', detail: `name=${String(provider.name)} 不是小写 slug` });
  }

  const capabilities: unknown = provider.capabilities;
  if (capabilities !== undefined) {
    if (capabilities === null || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
      violations.push({ clause: 'capabilities-shape', detail: 'capabilities 必须是对象（不想声明就整个省掉）' });
    } else {
      const siteOperator = (capabilities as { siteOperator?: unknown }).siteOperator;
      if (siteOperator !== undefined && typeof siteOperator !== 'boolean') {
        violations.push({ clause: 'capabilities-shape', detail: `siteOperator=${String(siteOperator)} 不是 boolean` });
      }
    }
  }

  if (typeof provider.search !== 'function') {
    violations.push({ clause: 'empty-queries', detail: 'search 不是函数' });
    return violations;
  }

  try {
    const empty = await provider.search([], { numResults: 3, language: 'en' });
    if (!Array.isArray(empty.results)) {
      violations.push({ clause: 'empty-queries', detail: 'search([]) 的 results 不是数组' });
    } else if (empty.results.length !== 0) {
      violations.push({ clause: 'empty-queries', detail: `search([]) 返回了 ${empty.results.length} 条结果` });
    }
  } catch (error) {
    violations.push({
      clause: 'empty-queries',
      detail: `search([]) 抛错：${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return violations;
}

/** 检查一批结果的形状（在真实调用拿到结果后使用） */
export function resultItemViolations(items: SearchResultItem[], queryCount: number): ContractViolation[] {
  const violations: ContractViolation[] = [];
  for (const item of items) {
    const detailOf = (detail: string): ContractViolation => ({ clause: 'result-shape', detail: `${detail}（url=${String(item?.url)}）` });
    if (!/^https?:\/\//i.test(item?.url ?? '')) violations.push(detailOf('url 不是 http(s)'));
    if (typeof item?.title !== 'string') violations.push(detailOf('title 不是字符串'));
    if (typeof item?.snippet !== 'string') violations.push(detailOf('snippet 不是字符串'));
    if (!Number.isInteger(item?.position) || item.position < 1) violations.push(detailOf('position 不是从 1 起的整数'));
    if (!Number.isInteger(item?.queryIndex) || item.queryIndex < 0 || item.queryIndex >= queryCount) {
      violations.push(detailOf(`queryIndex 越界（查询数 ${queryCount}）`));
    }
  }
  return violations;
}
