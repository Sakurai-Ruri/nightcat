/**
 * 把领域对象整理成"界面上要显示的那些字"。
 *
 * 为什么单独一层而不是写在组件里：组件没法用 node --test 验证（没有浏览器测试方案，见 D-009），
 * 而"还剩多少自然光""是清醒还是已经睡了"这类判断一旦错，用户在界面上是看不出来的。
 * 这个函数是纯的，测试可以直接断言它的输出。
 */

import { computePersonalClock } from '../domain/personalTime.ts'
import type { PersonalClock } from '../domain/personalTime.ts'
import type { Schedule } from '../domain/schedule.ts'
import { formatDuration, formatPersonalDayStart, formatTimeOfDay } from './format.ts'

export interface ClockView {
  /** 完整领域对象。UI 需要哪部分就取哪部分，不在这里裁剪。 */
  clock: PersonalClock
  /** 例如 "10月12日 13:00 起"。 */
  personalDayLabel: string
  /** 个人日锚点的钟点，例如 "13:00"。 */
  personalDayStartClock: string
  /** 一句状态描述，例如 "起床后 4 小时 12 分" / "你还在睡（本个人日的 05:00 起）"。 */
  stateSummary: string
  /** 距就寝还剩多久；已就寝为 "已到就寝时刻"。 */
  untilSleepLabel: string
}

export function composeClockView(schedule: Schedule, at: Date): ClockView {
  const clock = computePersonalClock(schedule, at)
  const personalDayStartClock = formatTimeOfDay(schedule.wakeAt)

  const stateSummary =
    clock.state === 'awake' && clock.awakeMinutes !== null
      ? `起床后 ${formatDuration(clock.awakeMinutes)}`
      : `你还在睡（本个人日 ${personalDayStartClock} 起）`

  const untilSleepLabel =
    clock.state === 'awake'
      ? formatDuration(clock.untilSleepMinutes)
      : '已到就寝时刻'

  return {
    clock,
    personalDayLabel: formatPersonalDayStart(clock.personalDayStart),
    personalDayStartClock,
    stateSummary,
    untilSleepLabel,
  }
}
