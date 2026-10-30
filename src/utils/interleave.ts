// src/utils/interleave.ts
/**
 * 按轨轮转交错合并（纯函数，全仓唯一定义点）
 *
 * 双语检索的两条轨（中文轨 / 英文轨）各自产出一批候选，合流时若简单首尾拼接，
 * 下游按搜索排序位截断会让"排得靠前的那一轨"整轨吃掉抓取配额。这里按轨轮转取：
 * 先每轨第 1 条、再每轨第 2 条……使两轨各占一半名额——这就是"抓取配额两轨均分"
 * 在合流层的唯一实现点，Lodestar 证据检索与宿主系统的采集臂共用。
 *
 * 跨轨同一个 key 只留先出现的那条（去重），重复项不占位次——所以某轨返回不足时
 * 另一轨自然补位，不会出现"空转的轨占着名额不放"。
 *
 */

/**
 * @param tracks 各轨已排好序的候选（轨内顺序保留）
 * @param keyOf 去重键（URL 级：`(item) => item.url`）
 * @param limit 合流后的条数上限（缺省不限）
 */
export function interleaveTracks<T>(
  tracks: readonly (readonly T[])[],
  keyOf: (item: T) => string,
  limit: number = Number.POSITIVE_INFINITY,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  const depth = tracks.reduce((max, track) => Math.max(max, track.length), 0);

  for (let i = 0; i < depth; i += 1) {
    for (const track of tracks) {
      const item = track[i];
      if (item === undefined) continue;
      const key = keyOf(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= limit) return merged;
    }
  }

  return merged;
}
