/**
 * 展示层测试（node --test，零依赖）。
 *
 * 为什么值得测：这些函数处理的是"用户输入"和"给人看的字符串"，
 * 两头都是容易出错的地方——`parseTimeInput` 要拒绝各种脏输入，
 * `formatDuration` 要避免"8 小时 0 分"这类别扭输出。
 * `composeClockView` 里那句状态文案有两种分支，测试是它们唯一的覆盖手段。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { composeClockView } from './clockView.ts'
import { formatCivilTime, formatDuration, formatPersonalDayStart, formatTimeOfDay, parseTimeInput } from './format.ts'
import type { Schedule } from '../domain/schedule.ts'

const 早起晚睡: Schedule = { wakeAt: 780, sleepAt: 300, sleepDurationMinutes: 480 }

const dateTime = (y: number, m: number, d: number, h = 0, min = 0): Date =>
  new Date(y, m - 1, d, h, min)

// ---------------------------------------------------------------------------
// formatTimeOfDay
// ---------------------------------------------------------------------------

test('formatTimeOfDay 补零到两位', () => {
  assert.equal(formatTimeOfDay(780), '13:00')
  assert.equal(formatTimeOfDay(0), '00:00')
  assert.equal(formatTimeOfDay(59), '00:59')
  assert.equal(formatTimeOfDay(1439), '23:59')
})

test('formatCivilTime 带秒', () => {
  assert.equal(formatCivilTime(new Date(2026, 9, 12, 9, 5, 7)), '09:05:07')
})

test('formatPersonalDayStart 给出月日与钟点', () => {
  assert.equal(formatPersonalDayStart(new Date(2026, 9, 12, 13, 0)), '10月12日 13:00 起')
})

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

test('formatDuration 不输出"0 分"，也不输出"0 小时"', () => {
  assert.equal(formatDuration(0), '0 分钟')
  assert.equal(formatDuration(45), '45 分钟')
  assert.equal(formatDuration(60), '1 小时')
  assert.equal(formatDuration(480), '8 小时')
  assert.equal(formatDuration(252), '4 小时 12 分')
  assert.equal(formatDuration(1439), '23 小时 59 分')
})

// ---------------------------------------------------------------------------
// parseTimeInput：脏输入必须返回 null，不能猜
// ---------------------------------------------------------------------------

test('parseTimeInput 接受 input[type=time] 的常规输出', () => {
  assert.equal(parseTimeInput('13:00'), 780)
  assert.equal(parseTimeInput('00:00'), 0)
  assert.equal(parseTimeInput('23:59'), 1439)
  assert.equal(parseTimeInput('9:05'), 545)
})

test('parseTimeInput 容忍首尾空格', () => {
  assert.equal(parseTimeInput('  07:30  '), 450)
})

test('parseTimeInput 对脏输入返回 null', () => {
  for (const dirty of ['', '  ', 'abc', '13', '13:', ':30', '24:00', '23:60', '13:0', '13:000', '-1:00', '1:2', '13.30']) {
    assert.equal(parseTimeInput(dirty), null, `应拒绝：${JSON.stringify(dirty)}`)
  }
})

test('parseTimeInput 与 formatTimeOfDay 互为逆运算', () => {
  for (const minutes of [0, 1, 59, 60, 599, 780, 1438, 1439]) {
    assert.equal(parseTimeInput(formatTimeOfDay(minutes)), minutes)
  }
})

// ---------------------------------------------------------------------------
// composeClockView：状态文案的两个分支
// ---------------------------------------------------------------------------

test('清醒时给出"起床后 X"，距就寝给出剩余时长', () => {
  const view = composeClockView(早起晚睡, dateTime(2026, 10, 12, 17))
  assert.equal(view.clock.state, 'awake')
  assert.equal(view.stateSummary, '起床后 4 小时')
  assert.equal(view.untilSleepLabel, '12 小时')
  assert.equal(view.personalDayLabel, '10月12日 13:00 起')
  assert.equal(view.personalDayStartClock, '13:00')
})

test('睡眠期不显示"起床后"，而是说明本个人日的起始钟点', () => {
  const view = composeClockView(早起晚睡, dateTime(2026, 10, 13, 9))
  assert.equal(view.clock.state, 'asleep')
  assert.equal(view.stateSummary, '你还在睡（本个人日 13:00 起）')
  assert.equal(view.untilSleepLabel, '已到就寝时刻')
})

test('起床瞬间显示"起床后 0 分钟"', () => {
  const view = composeClockView(早起晚睡, dateTime(2026, 10, 12, 13))
  assert.equal(view.stateSummary, '起床后 0 分钟')
})

test('凌晨 03:00 的个人日标签落在前一天（设计文档 3.3 节）', () => {
  const view = composeClockView(早起晚睡, dateTime(2026, 10, 13, 3))
  assert.equal(view.personalDayLabel, '10月12日 13:00 起')
  assert.equal(view.clock.state, 'awake')
  assert.equal(view.untilSleepLabel, '2 小时')
})
