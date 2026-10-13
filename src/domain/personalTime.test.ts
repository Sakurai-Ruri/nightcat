/**
 * 第 2 步的全部测试：Schedule 校验、PersonalDayResolver、PersonalClock。
 *
 * 运行：npm test  （即 node --test src/，Node 24 直接跑 .ts，无需构建、无测试框架）
 *
 * 约定：所有时间断言都按**本地时间**构造与比较，不出现 UTC 字面量。
 * 因为领域层刻意用"本地时间字段"做运算（见 docs/architecture.md 约定 6），
 * 测试若混入 UTC 假设，会在别的时区机器上假失败。
 *
 * 状态判定是二选一的：清醒区间为 [起床, 就寝)，就寝瞬间即算 asleep。
 * 因此"刚过就寝时刻"与"临近下次起床"同为 asleep，由 elapsedMinutes 区分。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolvePersonalDay } from './personalDay.ts'
import { computePersonalClock, isWithinWakeWindow, sleepTimeOfDay } from './personalTime.ts'
import { addMinutes, assertValidSchedule, startOfLocalDay, toTimeOfDay } from './schedule.ts'
import type { Schedule } from './schedule.ts'

const MINUTES_PER_DAY = 1440

/**
 * 设计文档第 3.3 节的例子：13:00 起床、05:00 就寝（睡眠 8 小时）。
 * 预期清醒区间为 [13:00, 次日 05:00)。
 */
const 早起晚睡: Schedule = {
  wakeAt: 13 * 60,
  sleepAt: 5 * 60,
  sleepDurationMinutes: 8 * 60,
}

const dateTime = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date => new Date(year, month - 1, day, hour, minute, second)

const localStamp = (at: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ` +
    `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
  )
}

const assertLocalStamp = (actual: Date, expected: string): void => {
  assert.equal(localStamp(actual), expected, `本地时刻不符：${localStamp(actual)}`)
}

/**
 * 领域模块必须是纯的：不依赖 DOM、不依赖网络。
 * 断言写法刻意绕开 `globalThis.document` 直接访问——那要求 DOM 类型在场，
 * 而测试项目用的是 node 类型（tsconfig.test.json），根本不该有 DOM。
 */
test('领域模块可在无浏览器环境下运行', () => {
  const globals = globalThis as Record<string, unknown>
  assert.equal(typeof globals.document, 'undefined')
  assert.equal(typeof globals.window, 'undefined')
  assert.equal(typeof globals.fetch, 'function', 'Node 自带 fetch；领域层虽然可用，但不得调用它')
})

// ---------------------------------------------------------------------------
// 1. PersonalDayResolver：个人日边界（D-007）
// ---------------------------------------------------------------------------

test('设计文档原文例：13:00 起床，03:00 仍属于前一天的个人日', () => {
  const { personalDayStart } = resolvePersonalDay(早起晚睡.wakeAt, dateTime(2026, 10, 13, 3))
  assertLocalStamp(personalDayStart, '2026-10-12 13:00:00')
})

test('起床时刻即边界：13:00 属于当天个人日', () => {
  const { personalDayStart } = resolvePersonalDay(早起晚睡.wakeAt, dateTime(2026, 10, 12, 13))
  assertLocalStamp(personalDayStart, '2026-10-12 13:00:00')
})

test('起床前一分钟：12:59 仍属前一天个人日', () => {
  const { personalDayStart } = resolvePersonalDay(早起晚睡.wakeAt, dateTime(2026, 10, 12, 12, 59))
  assertLocalStamp(personalDayStart, '2026-10-11 13:00:00')
})

test('跨午夜前后属于同一个个人日', () => {
  const beforeMidnight = resolvePersonalDay(早起晚睡.wakeAt, dateTime(2026, 10, 12, 23, 59))
  const afterMidnight = resolvePersonalDay(早起晚睡.wakeAt, dateTime(2026, 10, 13, 0, 1))
  assertLocalStamp(beforeMidnight.personalDayStart, '2026-10-12 13:00:00')
  assertLocalStamp(afterMidnight.personalDayStart, '2026-10-12 13:00:00')
})

test('跨月：10/31 起床，11/01 凌晨属于 10/31 个人日', () => {
  const { personalDayStart } = resolvePersonalDay(早起晚睡.wakeAt, dateTime(2026, 11, 1, 3))
  assertLocalStamp(personalDayStart, '2026-10-31 13:00:00')
})

test('跨年：12/31 起床，元旦凌晨属于 12/31 个人日', () => {
  const { personalDayStart } = resolvePersonalDay(早起晚睡.wakeAt, dateTime(2027, 1, 1, 3))
  assertLocalStamp(personalDayStart, '2026-12-31 13:00:00')
})

test('个人日长度固定 24 小时：下一次起床时刻即下一个个人日', () => {
  const { personalDayStart } = resolvePersonalDay(早起晚睡.wakeAt, dateTime(2026, 10, 13, 13))
  assertLocalStamp(personalDayStart, '2026-10-13 13:00:00')
})

test('午夜起床的个人日边界：锚点 00:00，全天都在同一个个人日', () => {
  const { personalDayStart } = resolvePersonalDay(0, dateTime(2026, 10, 13, 0, 1))
  assertLocalStamp(personalDayStart, '2026-10-13 00:00:00')
})

test('当日最晚的起床时刻 23:59 不越界', () => {
  const { personalDayStart } = resolvePersonalDay(MINUTES_PER_DAY - 1, dateTime(2026, 10, 12, 23, 59))
  assertLocalStamp(personalDayStart, '2026-10-12 23:59:00')
})

test('拒绝非法起床时刻（负数与非整数）', () => {
  const at = dateTime(2026, 10, 12, 12)
  assert.throws(() => resolvePersonalDay(-1, at), RangeError)
  assert.throws(() => resolvePersonalDay(MINUTES_PER_DAY, at), RangeError)
  assert.throws(() => resolvePersonalDay(13 * 60 + 0.5, at), RangeError)
})

// ---------------------------------------------------------------------------
// 2. PersonalClock：个人时间与清醒状态
// ---------------------------------------------------------------------------

test('起床瞬间：elapsed 与 awakeMinutes 均为 0，state 为 awake', () => {
  const clock = computePersonalClock(早起晚睡, dateTime(2026, 10, 12, 13))
  assert.equal(clock.state, 'awake')
  assert.equal(clock.elapsedMinutes, 0)
  assert.equal(clock.awakeMinutes, 0)
  assert.equal(clock.untilSleepMinutes, 960)
  assertLocalStamp(clock.sleepStartsAt, '2026-10-13 05:00:00')
})

test('起床后 4 小时：现实 17:00 = 起床后 4 小时（设计文档第 3.2 节）', () => {
  const clock = computePersonalClock(早起晚睡, dateTime(2026, 10, 12, 17))
  assert.equal(clock.state, 'awake')
  assert.equal(clock.elapsedMinutes, 240)
  assert.equal(clock.awakeMinutes, 240)
  assert.equal(clock.untilSleepMinutes, 720)
})

test('就寝前一秒仍是 awake', () => {
  const clock = computePersonalClock(早起晚睡, dateTime(2026, 10, 13, 4, 59, 59))
  assert.equal(clock.state, 'awake')
  // 显示值取整到分钟：两个数字之和恒等于清醒期总长（960），不出现自相矛盾。
  assert.equal(clock.awakeMinutes, 960)
  assert.equal(clock.untilSleepMinutes, 0)
})

test('就寝瞬间转为 asleep，untilSleepMinutes 不为负', () => {
  const clock = computePersonalClock(早起晚睡, dateTime(2026, 10, 13, 5))
  assert.equal(clock.state, 'asleep')
  assert.equal(clock.awakeMinutes, null)
  assert.equal(clock.untilSleepMinutes, 0)
  assert.equal(clock.elapsedMinutes, 960)
})

test('就寝边界按瞬时值判定，不受显示取整影响（回归：曾用取整值判状态，导致睡前 1 秒误判为 asleep）', () => {
  const schedule: Schedule = { wakeAt: 13 * 60, sleepAt: 5 * 60, sleepDurationMinutes: 8 * 60 }
  const sleepStart = new Date(2026, 9, 12, 13, 0, 0).getTime() + 960 * 60_000

  const oneSecondBefore = computePersonalClock(schedule, new Date(sleepStart - 1000))
  assert.equal(oneSecondBefore.state, 'awake')
  // 显示值取整到 960 是可以接受的：它只用于展示，不参与状态判定。
  assert.equal(oneSecondBefore.elapsedMinutes, 960)
  assert.equal(oneSecondBefore.awakeMinutes, 960)
  assert.equal(oneSecondBefore.untilSleepMinutes, 0)

  const oneMillisecondBefore = computePersonalClock(schedule, new Date(sleepStart - 1))
  assert.equal(oneMillisecondBefore.state, 'awake')

  const oneMillisecondAfter = computePersonalClock(schedule, new Date(sleepStart + 1))
  assert.equal(oneMillisecondAfter.state, 'asleep')
  assert.equal(oneMillisecondAfter.awakeMinutes, null)
})

test('睡眠期：未起床时 awakeMinutes 为 null，且仍属于同一个个人日', () => {  const clock = computePersonalClock(早起晚睡, dateTime(2026, 10, 13, 12, 59))
  assert.equal(clock.state, 'asleep')
  assert.equal(clock.awakeMinutes, null)
  assert.equal(clock.untilSleepMinutes, 0)
  assert.equal(clock.elapsedMinutes, 1439)
  assertLocalStamp(clock.personalDayStart, '2026-10-12 13:00:00')
})

test('晚睡者当天上午 09:00：个人日已推进 20 小时，但起床后时长是 20 小时而非负值', () => {
  const clock = computePersonalClock(早起晚睡, dateTime(2026, 10, 13, 9))
  assert.equal(clock.state, 'asleep')
  assert.equal(clock.awakeMinutes, null)
  assert.equal(clock.elapsedMinutes, 1200)
  assertLocalStamp(clock.personalDayStart, '2026-10-12 13:00:00')
})

test('清醒时段内至少出现一次 asleep（用于规则引擎的"尚未起床"判断）', () => {
  assert.equal(isWithinWakeWindow(早起晚睡, dateTime(2026, 10, 13, 4)), true)
  assert.equal(isWithinWakeWindow(早起晚睡, dateTime(2026, 10, 13, 6)), false)
  assert.equal(isWithinWakeWindow(早起晚睡, dateTime(2026, 10, 12, 14)), true)
})

// ---------------------------------------------------------------------------
// 3. Schedule 校验：坏数据必须早失败
// ---------------------------------------------------------------------------

test('拒绝非法 wakeAt / sleepAt / sleepDurationMinutes', () => {
  assert.throws(() => assertValidSchedule({ ...早起晚睡, wakeAt: -1 }), RangeError)
  assert.throws(() => assertValidSchedule({ ...早起晚睡, wakeAt: 13 * 60 + 0.5 }), RangeError)
  assert.throws(() => assertValidSchedule({ ...早起晚睡, sleepAt: MINUTES_PER_DAY }), RangeError)
  assert.throws(() => assertValidSchedule({ ...早起晚睡, sleepDurationMinutes: 0 }), RangeError)
  assert.throws(() => assertValidSchedule({ ...早起晚睡, sleepDurationMinutes: MINUTES_PER_DAY }), RangeError)
  assert.throws(() => assertValidSchedule({ ...早起晚睡, sleepDurationMinutes: 480.5 }), RangeError)
})

test('拒绝 wakeAt 与 sleepAt 相同的退化作息', () => {
  assert.throws(
    () => assertValidSchedule({ wakeAt: 600, sleepAt: 600, sleepDurationMinutes: 480 }),
    RangeError,
  )
})

test('拒绝自相矛盾的作息：时长与起床/就寝间隔不一致', () => {
  // 13:00 起床、05:00 就寝 ⇒ 睡眠必然是 480 分钟，写成 300 分钟应被拒绝
  assert.throws(() => assertValidSchedule({ ...早起晚睡, sleepDurationMinutes: 300 }), RangeError)
})

test('容忍 1 分钟的四舍五入误差', () => {
  assert.doesNotThrow(() => assertValidSchedule({ ...早起晚睡, sleepDurationMinutes: 481 }))
  assert.throws(() => assertValidSchedule({ ...早起晚睡, sleepDurationMinutes: 482 }), RangeError)
})

test('接受不跨午夜的作息（早睡早起）', () => {
  const 早睡早起: Schedule = { wakeAt: 6 * 60, sleepAt: 22 * 60, sleepDurationMinutes: 8 * 60 }
  assert.doesNotThrow(() => assertValidSchedule(早睡早起))
  const clock = computePersonalClock(早睡早起, dateTime(2026, 10, 12, 6, 30))
  assert.equal(clock.state, 'awake')
  assert.equal(clock.awakeMinutes, 30)
  assert.equal(clock.untilSleepMinutes, 930)
  assertLocalStamp(clock.sleepStartsAt, '2026-10-12 22:00:00')
})

test('接受凌晨 04:00 起床 + 12 小时睡眠的极端作息', () => {
  const 极端: Schedule = { wakeAt: 4 * 60, sleepAt: 16 * 60, sleepDurationMinutes: 12 * 60 }
  assert.doesNotThrow(() => assertValidSchedule(极端))
  const clock = computePersonalClock(极端, dateTime(2026, 10, 12, 16, 30))
  assert.equal(clock.state, 'asleep')
  assert.equal(clock.untilSleepMinutes, 0)
})

test('拒绝长度为 1 天的睡眠时长（那等于没有清醒期）', () => {
  assert.throws(() => assertValidSchedule({ wakeAt: 0, sleepAt: 1, sleepDurationMinutes: MINUTES_PER_DAY }), RangeError)
})

test('wakeAt 落在 23:59 的作息在清醒期结束时跨到次日', () => {
  const 极晚: Schedule = { wakeAt: MINUTES_PER_DAY - 1, sleepAt: 23 * 60, sleepDurationMinutes: 60 }
  const clock = computePersonalClock(极晚, dateTime(2026, 10, 13, 0, 30))
  assert.equal(clock.state, 'awake')
  assert.equal(clock.awakeMinutes, 31)
  // 注意：untilSleepMinutes 指"距本个人日的就寝时刻"，即次日 22:59，而非当天 00:59。
  // 清醒期只持续 60 分钟，所以"还剩 22.5 小时"是正确的返回值。
  assert.equal(clock.untilSleepMinutes, 1349)
  assertLocalStamp(clock.sleepStartsAt, '2026-10-13 22:59:00')
})

// ---------------------------------------------------------------------------
// 4. 边界情况与已知局限（把当前行为钉住，避免以后悄悄变化）
// ---------------------------------------------------------------------------

test('60 小时不睡的极端情况：个人日不会切分，且不崩溃', () => {
  const clock = computePersonalClock(早起晚睡, dateTime(2026, 10, 14, 6))
  assert.equal(clock.state, 'asleep')
  assert.equal(clock.untilSleepMinutes, 0)
  assertLocalStamp(clock.personalDayStart, '2026-10-13 13:00:00')
})

test('夏令时切换日不崩溃；标注当前不做真实时区运算', () => {
  // 3 月第二个周日（美国规则）。若本机不使用夏令时，则跳过。
  const secondSundayOfMarch = (year: number): Date => {
    const d = dateTime(year, 3, 1)
    const offsetToSunday = (7 - d.getDay()) % 7
    return dateTime(year, 3, 1 + offsetToSunday + 7, 3, 0)
  }
  const transition = secondSundayOfMarch(2026)
  const before = dateTime(2026, 3, 1)
  if (transition.getTimezoneOffset() === before.getTimezoneOffset()) {
    return // 本机无夏令时，本用例不适用
  }

  const schedule: Schedule = { wakeAt: 12 * 60, sleepAt: 4 * 60, sleepDurationMinutes: 8 * 60 }
  const clock = computePersonalClock(schedule, transition)
  assert.equal(clock.state, 'awake')

  // 已知局限（D-010）：elapsedMinutes 按"本地时间字段"直接相减，
  // 不补偿夏令时跳变，因此真实经过时长与该值可能相差 1 小时。
  const rawDelta = transition.getTime() - clock.personalDayStart.getTime()
  assert.equal(clock.elapsedMinutes, Math.round(rawDelta / 60_000))
})

test('pure helper：addMinutes 跨月边界正确', () => {
  assertLocalStamp(addMinutes(dateTime(2026, 10, 31, 23), 120), '2026-11-01 01:00:00')
})

test('pure helper：startOfLocalDay 与 toTimeOfDay 与构造值一致', () => {
  const at = dateTime(2026, 10, 12, 17, 30)
  assertLocalStamp(startOfLocalDay(at), '2026-10-12 00:00:00')
  assert.equal(toTimeOfDay(at), 17 * 60 + 30)
})

test('pure helper：sleepTimeOfDay 反映本个人日的就寝时刻（含 0 的歧义）', () => {
  assert.equal(sleepTimeOfDay(早起晚睡), 5 * 60)
  // 09:00 起床 + 540 分钟睡眠 ⇒ 就寝时刻为次日 00:00，返回 0。这是已知歧义。
  assert.equal(sleepTimeOfDay({ wakeAt: 540, sleepAt: 0, sleepDurationMinutes: 540 }), 0)
})
