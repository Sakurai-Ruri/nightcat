/**
 * 存储层的测试（node --test，零依赖）。
 *
 * 只测**纯函数**部分：`toRecord` / `fromRecord` / `deriveSleepDuration`。
 * 不测 localStorage 实现——它需要 DOM 环境，而当前没有浏览器测试方案（见 D-009）。
 * 这也是刻意的架构结果：把容易出错的数据校验放在纯函数里，就能在 Node 里测完。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deriveSleepDuration, fromRecord, toRecord } from './scheduleRecord.ts'
import type { Schedule } from '../../domain/schedule.ts'

const 早起晚睡: Schedule = { wakeAt: 780, sleepAt: 300, sleepDurationMinutes: 480 }

test('写入再读出得到等价的作息', () => {
  const restored = fromRecord(toRecord(早起晚睡))
  assert.deepEqual(restored, 早起晚睡)
})

test('记录带 schemaVersion，便于将来迁移', () => {
  assert.equal(toRecord(早起晚睡).schemaVersion, 1)
})

test('写入路径拒绝非法作息（这是我们自己的数据，不合法即 bug）', () => {
  assert.throws(() => toRecord({ ...早起晚睡, sleepDurationMinutes: 300 }), RangeError)
})

test('读取路径对各种坏数据返回 null，而不是抛错', () => {
  assert.equal(fromRecord(null), null)
  assert.equal(fromRecord(undefined), null)
  assert.equal(fromRecord('not json'), null)
  assert.equal(fromRecord(42), null)
  assert.equal(fromRecord({}), null)
})

test('读取路径拒绝版本不匹配的数据', () => {
  assert.equal(fromRecord({ ...toRecord(早起晚睡), schemaVersion: 2 }), null)
})

test('读取路径拒绝字段类型错误的数据', () => {
  const base = toRecord(早起晚睡)
  assert.equal(fromRecord({ ...base, wakeAt: '780' }), null)
  assert.equal(fromRecord({ ...base, sleepAt: null }), null)
  assert.equal(fromRecord({ ...base, sleepDurationMinutes: undefined }), null)
})

test('读取路径拒绝字段自相矛盾的数据（复用领域层校验）', () => {
  assert.equal(fromRecord({ ...toRecord(早起晚睡), sleepDurationMinutes: 300 }), null)
})

test('读取路径拒绝越界数值', () => {
  const base = toRecord(早起晚睡)
  assert.equal(fromRecord({ ...base, wakeAt: -1 }), null)
  assert.equal(fromRecord({ ...base, sleepAt: 1440 }), null)
  assert.equal(fromRecord({ ...base, sleepDurationMinutes: 0 }), null)
})

test('旧版本多出的未知字段不影响读取（向前兼容）', () => {
  const withExtra = { ...toRecord(早起晚睡), someFutureField: 'x' }
  assert.deepEqual(fromRecord(withExtra), 早起晚睡)
})

// ---------------------------------------------------------------------------
// deriveSleepDuration：设置界面的核心换算
// ---------------------------------------------------------------------------

test('跨午夜的作息：13:00 起床 05:00 就寝 ⇒ 睡眠 480 分钟', () => {
  assert.equal(deriveSleepDuration(780, 300), 480)
})

test('不跨午夜的作息：06:00 起床 22:00 就寝 ⇒ 睡眠 480 分钟', () => {
  assert.equal(deriveSleepDuration(360, 1320), 480)
})

test('两个时刻相同 ⇒ null（退化作息，不猜是睡 0 还是 24 小时）', () => {
  assert.equal(deriveSleepDuration(780, 780), null)
})

test('推导结果与领域层校验一致：不会产出被 assertValidSchedule 拒绝的作息', () => {
  const cases: Array<[number, number]> = [
    [780, 300],
    [360, 1320],
    [0, 480],
    [1439, 0],
    [600, 601],
  ]

  for (const [wakeAt, sleepAt] of cases) {
    const sleepDurationMinutes = deriveSleepDuration(wakeAt, sleepAt)
    assert.notEqual(sleepDurationMinutes, null, `${wakeAt}→${sleepAt} 应能推导出时长`)

    const schedule: Schedule = {
      wakeAt,
      sleepAt,
      sleepDurationMinutes: sleepDurationMinutes as number,
    }
    assert.doesNotThrow(() => toRecord(schedule), `${wakeAt}→${sleepAt} 应通过校验`)
  }
})
