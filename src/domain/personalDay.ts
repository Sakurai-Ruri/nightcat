/**
 * Personal Day Resolver：决定某个真实时刻属于哪个"个人日"（D-007）。
 *
 * 规则一句话：个人日 = 从当天起床时刻起，到次日同一时刻止。
 * 因此 13:00 起床的人，10/13 03:00 仍属于 10/12 个人日——
 * 这正是设计文档第 3.3 节的例子，也是本项目存在的理由之一：
 * 午夜 00:00 不是一天的分界线，起床时刻才是。
 */

import { assertTimeOfDay, startOfLocalDay, toTimeOfDay } from './schedule.ts'
import type { TimeOfDay } from './schedule.ts'

export interface ResolvedPersonalDay {
  /** 该个人日的起床时刻（唯一锚点）。 */
  personalDayStart: Date
}

/**
 * 判定 at 属于哪个个人日。
 *
 * 判定方式：at 是否已经越过"当天"的起床时刻。
 * - 已越过 → 个人日锚在今天。
 * - 未越过 → 说明还在上一轮清醒-睡眠周期里，锚在昨天。
 *
 * 注意：这里用"零点后分钟数"比较，不比较完整日期时间。
 * 该写法在本地时间轴上正确；夏令时切换日的误差见 D-010 的已知局限。
 */
export function resolvePersonalDay(wakeAt: TimeOfDay, at: Date): ResolvedPersonalDay {
  assertTimeOfDay(wakeAt, 'wakeAt')

  const dayStart = startOfLocalDay(at)
  if (toTimeOfDay(at) >= wakeAt) {
    return { personalDayStart: new Date(dayStart.getTime() + wakeAt * 60_000) }
  }

  dayStart.setDate(dayStart.getDate() - 1)
  return { personalDayStart: new Date(dayStart.getTime() + wakeAt * 60_000) }
}
