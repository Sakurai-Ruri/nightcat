/**
 * 展示层格式化。纯函数，可被 node --test 直接验证。
 *
 * 刻意不引入日期库：V0 只需要"分钟数 → 字符串"，`Intl` 与手写补零足够了。
 * 引入 dayjs/date-fns 属于"为了省 10 行代码承担一个长期依赖"，见 AGENTS.md 规则 3。
 */

import type { DurationMinutes, TimeOfDay } from '../domain/schedule.ts'

const pad2 = (value: number): string => String(value).padStart(2, '0')

/** 就寝/起床时刻输入框与文案用：780 → "13:00" */
export function formatTimeOfDay(minutes: TimeOfDay): string {
  const hour = Math.floor(minutes / 60)
  return `${pad2(hour)}:${pad2(minutes % 60)}`
}

/** 当前民用时间：带秒，让用户看得出页面在走。 */
export function formatCivilTime(at: Date): string {
  return `${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}`
}

/** 个人日锚点的日期，例如 "10月12日 13:00 起"。 */
export function formatPersonalDayStart(at: Date): string {
  const month = at.getMonth() + 1
  return `${month}月${at.getDate()}日 ${pad2(at.getHours())}:${pad2(at.getMinutes())} 起`
}

/**
 * 时长：0 → "0 分钟"，45 → "45 分钟"，240 → "4 小时"，252 → "4 小时 12 分"。
 * 整小时不显示 "0 分"——那会让"睡了 8 小时"显示成"8 小时 0 分"。
 */
export function formatDuration(minutes: DurationMinutes): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours === 0) return `${rest} 分钟`
  if (rest === 0) return `${hours} 小时`
  return `${hours} 小时 ${rest} 分`
}

/** 把 `input[type=time]` 的 "HH:MM" 转成 TimeOfDay；格式不符返回 null（不猜）。 */
export function parseTimeInput(value: string): TimeOfDay | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (match === null) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null

  return hour * 60 + minute
}
