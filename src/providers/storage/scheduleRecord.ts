/**
 * Schedule 的持久化表示与转换。
 *
 * 为什么需要这一层：领域模型（`Schedule`）是**内部结构**，持久化格式是**对外契约**。
 * 两者会长得不一样——例如以后要加 `schemaVersion` 做迁移，或把 `wakeAt` 换成
 * "按星期区分的数组"。若直接把领域对象塞进存储，任何模型调整都会变成"旧数据读不出来"。
 *
 * 本模块是纯函数：不接触 localStorage / IndexedDB，因此可以用 node --test 直接验证。
 */

import { assertValidSchedule } from '../../domain/schedule.ts'
import type { Schedule } from '../../domain/schedule.ts'

/** 持久化记录：字段与 Schedule 一致，但带 schemaVersion 以便将来迁移。 */
export interface ScheduleRecord {
  schemaVersion: 1
  wakeAt: number
  sleepAt: number
  sleepDurationMinutes: number
}

export const SCHEDULE_SCHEMA_VERSION = 1

export function toRecord(schedule: Schedule): ScheduleRecord {
  assertValidSchedule(schedule)
  return {
    schemaVersion: SCHEDULE_SCHEMA_VERSION,
    wakeAt: schedule.wakeAt,
    sleepAt: schedule.sleepAt,
    sleepDurationMinutes: schedule.sleepDurationMinutes,
  }
}

/**
 * 把存储里的未知数据转回 Schedule。
 *
 * 返回 `null` 表示"没有可用的作息"，而不是抛异常——因为这是**读取路径**：
 * 数据可能来自旧版本、被手工改坏、或被别的程序写错。读取失败属于预期情况，
 * 调用方需要走"让用户重新设置"的分支，而不是崩溃。
 *
 * 抛异常只留给"写入路径"（toRecord）：那是我们自己的数据，不合法就是 bug。
 */
export function fromRecord(raw: unknown): Schedule | null {
  if (typeof raw !== 'object' || raw === null) return null

  const record = raw as Partial<ScheduleRecord>

  if (record.schemaVersion !== SCHEDULE_SCHEMA_VERSION) return null

  const { wakeAt, sleepAt, sleepDurationMinutes } = record
  if (
    typeof wakeAt !== 'number' ||
    typeof sleepAt !== 'number' ||
    typeof sleepDurationMinutes !== 'number'
  ) {
    return null
  }

  const schedule: Schedule = { wakeAt, sleepAt, sleepDurationMinutes }

  // 复用领域层的校验，避免"存储层接受、领域层拒绝"这种不一致。
  try {
    assertValidSchedule(schedule)
  } catch {
    return null
  }

  return schedule
}

/**
 * 由起床时刻与就寝时刻推导计划睡眠时长。
 *
 * 这是设置界面的核心换算：用户只需要填两个时刻，"睡多久"是算出来的，
 * 而不是让他填三个数字——那样就会出现三个字段互相矛盾（见 D-007 与 schedule.ts 的校验）。
 *
 * 返回 `null` 表示两个时刻相同（作息退化，没有清醒期），不是合法输入。
 * 注意 `sleepAt === wakeAt` 在数学上有两种解释（睡 0 分钟或睡满 24 小时），
 * 因此不猜，直接判为无效，让 UI 去提示用户。
 */
export function deriveSleepDuration(wakeAt: number, sleepAt: number): number | null {
  if (wakeAt === sleepAt) return null

  const awakeMinutes = sleepAt > wakeAt ? sleepAt - wakeAt : 1440 - wakeAt + sleepAt
  return 1440 - awakeMinutes
}
