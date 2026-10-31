// src/index.ts
/**
 * 包对外出口（只做再导出，不放逻辑）
 *
 * 深路径 `openlodestar/lodestar/<module>` 仍可直接引用（`exports` 里的 `"./*"` 通配）。
 * 这里只把宿主系统（消费者）最常用的一层收拢到包根：引擎、底稿契约、坐标只读入口、
 * 存储适配器、策略包契约与示例包、裁决与引文纪律。
 *
 * 收口到 barrel 是后续可选项：新增模块时先加一条再导出，迁移期不动深路径调用点。
 */

export * from './lodestar/types';
export * from './lodestar/engine';
export * from './lodestar/ids';
export * from './lodestar/normalize';
export * from './lodestar/paths';
export * from './lodestar/anchor-source';
export * from './lodestar/search-phrases';
export * from './lodestar/access';
export * from './lodestar/trace-log';
export * from './lodestar/evidence-check';
export * from './lodestar/source-run-report';
export * from './lodestar/source-site-verify';
export * from './lodestar/storage/adapter';
export * from './lodestar/packs/pack';
export * from './lodestar/packs/requirements';
export * from './lodestar/packs/porcelain';
export * from './lodestar/adjudicate/compare';
export * from './lodestar/adjudicate/voting';
export * from './lodestar/adjudicate/page-fetch';
export * from './lodestar/intake/atomize';
export * from './lodestar/intake/prompts';
export * from './lodestar/intake/source-elicitation';
export * from './lodestar/record-gate/source-anchor';
