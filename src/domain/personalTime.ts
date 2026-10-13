/**
 * Personal Clock：把民用时间换算成"用户自己的一天"里的位置。
 *
 * 回答的问题：现在是本个人日的第几个小时、我起床多久了、距离就寝还剩多久、我是否清醒。
 * 它不关心日出日落（那是 SolarProvider 与 ContextEngine 的事），只做纯时间换算。
 */

import { resolvePersonalDay } from './personalDay.ts'
import { addMinutes, assertValidSchedule, MINUTES_PER_DAY } from './schedule.ts'
import type { DurationMinutes, Schedule, TimeOfDay } from './schedule.ts'

export type WakeState = 'asleep' | 'awake'

export interface PersonalClock {
  /** 本个人日的起床时刻。 */
  personalDayStart: Date
  /** 此刻是否处于清醒区间（[起床, 就寝)）。 */
  state: WakeState
  /** 距本个人日锚点已经过去多久（0–1439）。 */
  elapsedMinutes: DurationMinutes
  /**
   * 起床后多久。**未起床时为 null，不用负数**（设计文档第 3.2 节）：
   * 负数会把"还没开始"和"已经过去很久"混在同一个数值空间里，
   * 调用方迟早得写 `> 0` 判断；null 让类型系统在编译期替我们拦住这种混淆。
   */
  awakeMinutes: DurationMinutes | null
  /** 本个人日的就寝时刻。 */
  sleepStartsAt: Date
  /** 距就寝还剩多久；已到就寝时刻则为 0（不返回负数）。 */
  untilSleepMinutes: DurationMinutes
}

/** 计算某时刻的个人时间。schedule 不合法时抛 RangeError。 */
export function computePersonalClock(
  schedule: Schedule,
  at: Date,
): PersonalClock {
  assertValidSchedule(schedule)

  const { personalDayStart } = resolvePersonalDay(schedule.wakeAt, at)
  const elapsedExactMs = at.getTime() - personalDayStart.getTime()
  const elapsedMinutes = Math.round(elapsedExactMs / 60_000)

  // 清醒区间 = [起床, 起床 + 清醒时长)，其中清醒时长 = 一天 − 计划睡眠时长。
  const awakeWindowMinutes = MINUTES_PER_DAY - schedule.sleepDurationMinutes
  const sleepStartsAt = addMinutes(personalDayStart, awakeWindowMinutes)

  // 状态用**未取整的瞬时值**判定，不能用 elapsedMinutes：
  // 就寝前一秒的 elapsed 是 959.98 分钟，取整后等于 960，会被误判成 asleep。
  // 显示用的取整值与判定用的边界值必须分开，否则边界处必然出现一秒级的错判。
  const state: WakeState = elapsedExactMs < awakeWindowMinutes * 60_000 ? 'awake' : 'asleep'

  if (state === 'asleep') {
    // 已经进入睡眠期：起床后时长无意义，等待下一个个人日重新计算。
    return {
      personalDayStart,
      state,
      elapsedMinutes,
      awakeMinutes: null,
      sleepStartsAt,
      untilSleepMinutes: 0,
    }
  }

  return {
    personalDayStart,
    state,
    elapsedMinutes,
    awakeMinutes: elapsedMinutes,
    sleepStartsAt,
    // 由已取整的 elapsedMinutes 反推，保证 awakeMinutes + untilSleepMinutes
    // 恒等于清醒期总长。若两个值各自独立取整，在就寝前一秒会出现
    // "已清醒 960 分钟、距就寝还剩 1 分钟"这种总和超过清醒期的矛盾显示。
    // 代价：就寝前一秒的"剩余"会显示为 0，而它实际是 1 分钟——这是取整的诚实代价。
    untilSleepMinutes: awakeWindowMinutes - elapsedMinutes,
  }
}

/** 判断某时刻是否处于清醒区间。语义等价于 `computePersonalClock(...).state === 'awake'`。 */
export function isWithinWakeWindow(schedule: Schedule, at: Date): boolean {
  return computePersonalClock(schedule, at).state === 'awake'
}

/**
 * 由起床时刻与睡眠时长算出本个人日的就寝时刻。
 *
 * 已知限制：结果为 0 时语义有歧义——`0` 既表示 00:00，也无法与"无值"区分。
 * 例：09:00 起床 + 540 分钟睡眠 → 就寝时刻是次日 00:00，返回 0。
 * V0 不使用这个函数的返回值（就寝时刻由 `PersonalClock.sleepStartsAt` 以 Date 表达），
 * 保留它是为了给"作息表格化展示"提供纯函数，等真需要表示"无值"时再改成 `TimeOfDay | null`。
 */
export function sleepTimeOfDay(schedule: Schedule): TimeOfDay {
  assertValidSchedule(schedule)
  const raw = schedule.wakeAt + (MINUTES_PER_DAY - schedule.sleepDurationMinutes)
  return raw % MINUTES_PER_DAY
}
