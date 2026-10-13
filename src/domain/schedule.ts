/**
 * 作息与时间基础类型。
 *
 * 本项目刻意区分两个概念（见 docs/architecture.md 约定 6）：
 * - TimeOfDay：当地时间的"零点后分钟数"，取值 0–1439，表示一个时刻。
 * - DurationMinutes：一段时长，表示"多久"，可能超过 1440。
 * 两者都是 number，但语义不同、不可互换。V0 用字段名与函数签名区分，不引入 branded type。
 *
 * 本模块不依赖 React、不依赖浏览器 API，可用 node --test 直接验证。
 */

/** 当地时间的零点后分钟数（0–1439）。 */
export type TimeOfDay = number

/** 一段时长（分钟）。 */
export type DurationMinutes = number

export const MINUTES_PER_DAY = 1440

export interface Schedule {
  /** 起床时刻。它同时是个人日的边界锚点（D-007）。 */
  wakeAt: TimeOfDay
  /** 就寝时刻。通常小于 wakeAt，即跨过午夜。 */
  sleepAt: TimeOfDay
  /**
   * 计划睡眠时长。显式存储，不从 sleepAt→wakeAt 推导：
   * 那个区间包含入睡延迟与醒来误差，推导值会偏乐观；
   * 且 V0.3 引入"实际作息"时需要独立字段承载。
   */
  sleepDurationMinutes: DurationMinutes
}

/** 某个真实时刻所在自然日的 00:00。使用本地时间字段构造，不涉及 UTC 换算。 */
export function startOfLocalDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate())
}

/** 取某个真实时刻的 TimeOfDay。 */
export function toTimeOfDay(at: Date): TimeOfDay {
  return at.getHours() * 60 + at.getMinutes()
}

/** 从某个真实时刻起加上一段时长，返回新的真实时刻。 */
export function addMinutes(at: Date, minutes: DurationMinutes): Date {
  return new Date(at.getTime() + minutes * 60_000)
}

function assertDuration(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0 || value >= MINUTES_PER_DAY) {
    throw new RangeError(
      `${label} 必须是 1 到 ${MINUTES_PER_DAY - 1} 之间的整数分钟数，收到：${value}`,
    )
  }
}

/** 校验一个值是否是合法的 TimeOfDay。导出给只需要校验时刻的调用方（如 PersonalDayResolver）。 */
export function assertTimeOfDay(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= MINUTES_PER_DAY) {
    throw new RangeError(
      `${label} 必须是 0 到 ${MINUTES_PER_DAY - 1} 之间的整数分钟数，收到：${value}`,
    )
  }
}

/**
 * 校验作息不变量。在个人日与个人时间的计算入口调用，
 * 让"坏数据"在进入计算前就失败，而不是产出看起来合理的错误结果。
 *
 * 包含一条**交叉一致性**校验：wakeAt 与 sleepAt 的间隔决定了"清醒期有多长"，
 * 而 sleepDurationMinutes 也表达了同一件事。两者必须在 1 分钟内吻合，
 * 否则模块内部会"按 A 计算却对外报告 B"，产生最难排查的错误。
 */
export function assertValidSchedule(schedule: Schedule): void {
  assertTimeOfDay(schedule.wakeAt, 'wakeAt')
  assertTimeOfDay(schedule.sleepAt, 'sleepAt')
  assertDuration(schedule.sleepDurationMinutes, 'sleepDurationMinutes')

  if (schedule.sleepAt === schedule.wakeAt) {
    throw new RangeError(`sleepAt 不能与 wakeAt 相同（${schedule.wakeAt}）：作息会退化为 0 分钟清醒期`)
  }

  const intervalMinutes =
    schedule.sleepAt > schedule.wakeAt
      ? schedule.sleepAt - schedule.wakeAt
      : MINUTES_PER_DAY - schedule.wakeAt + schedule.sleepAt
  const intervalSleepMinutes = MINUTES_PER_DAY - intervalMinutes

  if (Math.abs(intervalSleepMinutes - schedule.sleepDurationMinutes) > 1) {
    throw new RangeError(
      `作息自相矛盾：wakeAt=${schedule.wakeAt} 与 sleepAt=${schedule.sleepAt} 的间隔 ` +
        `意味着睡眠 ${intervalSleepMinutes} 分钟，但 sleepDurationMinutes=${schedule.sleepDurationMinutes}`,
    )
  }
}
