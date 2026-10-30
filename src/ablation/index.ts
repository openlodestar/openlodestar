// src/ablation/index.ts
/**
 * 消融状态（本仓库只保留"全部开启"这一个实现）
 *
 * 引擎各环节接受一个 `AblationState`：它回答"某个机制是否被关掉"。
 * 独立开源版不提供实验性的开关装配入口——`NO_ABLATIONS` 让所有机制正常生效，
 * 与宿主系统默认运行时的行为一致。
 */

/** 可消融的机制名（与宿主系统保持同名，便于对照两侧的评测口径） */
export type MechanismId =
  | 'source-whitelist'
  | 'source-blacklist'
  | 'source-targeted'
  | 'dual-track'
  | 'concretization';

/** 消融状态：`isOff(id)` 为 true 表示该机制被关掉 */
export interface AblationState {
  isOff(mechanismId: MechanismId): boolean;
}

/** 全部机制开启（默认） */
export const NO_ABLATIONS: AblationState = {
  isOff: () => false,
};
