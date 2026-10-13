/**
 * 每秒推进一次的"当前时间"。
 *
 * 三个刻意的选择：
 * 1. **存时刻而不是存计时器累加值**：每次 tick 都重新读 `new Date()`。
 *    若用 `setSeconds(prev => prev + 1)` 累加，标签页被挂起或系统睡眠后会漂移。
 * 2. **effect 里清掉定时器**：React 19 的 StrictMode 在开发环境会 mount→unmount→mount
 *    跑两遍，不清理就会留下两个每秒触发的定时器（见 docs/learning.md）。
 * 3. **整秒对齐**：不依赖"挂载那一刻"的毫秒偏移，否则时间会在 :00.37 这类怪时刻跳动。
 *
 * 关于性能：每秒一次重渲染是刻意的（民用时间要显示秒）。领域计算是几十次整数运算，
 * 不是瓶颈。若将来发现卡顿，优化点是"把秒级显示拆成独立组件"，而不是降低刷新频率。
 */

import { useEffect, useState } from 'react'

export function useCurrentTime(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const scheduleNextTick = () => {
      const delay = intervalMs - (Date.now() % intervalMs)
      timer = setTimeout(() => {
        setNow(new Date())
        scheduleNextTick()
      }, delay)
    }

    scheduleNextTick()
    return () => clearTimeout(timer)
  }, [intervalMs])

  return now
}
