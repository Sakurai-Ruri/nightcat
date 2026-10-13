import { useEffect, useState } from 'react'
import { formatDuration, formatTimeOfDay, parseTimeInput } from '../app/format.ts'
import { deriveSleepDuration } from '../providers/storage/scheduleRecord.ts'
import type { Schedule } from '../domain/schedule.ts'

interface ScheduleSettingsProps {
  /** 已保存的作息，表单初值。 */
  schedule: Schedule
  /** 返回错误信息表示保存失败；返回 null 表示成功。 */
  onSave: (schedule: Schedule) => Promise<string | null>
}

type SaveState = 'idle' | 'saved' | 'error'

const SAVED_FEEDBACK_MS = 2400

/**
 * 作息设置。
 *
 * 用户只填**两个时刻**，"睡多久"是算出来的（`deriveSleepDuration`）。
 * 若让用户填三个数字，就会出现三者互相矛盾的数据——那正是
 * `assertValidSchedule` 的交叉一致性校验要拦的东西，不该让用户有机会制造它。
 *
 * 校验分两层，错误提示也分两种：
 * - 输入还没成型（缺字段、两个时刻相同）→ 内联提示，保存按钮禁用，不算错误。
 * - 保存失败（存储被禁用等）→ 红色提示。
 * 把两者混成一种提示，会让用户以为"填错了"，而其实只是浏览器不让存。
 */
export function ScheduleSettings({ schedule, onSave }: ScheduleSettingsProps) {
  const [wakeDraft, setWakeDraft] = useState(() => formatTimeOfDay(schedule.wakeAt))
  const [sleepDraft, setSleepDraft] = useState(() => formatTimeOfDay(schedule.sleepAt))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (saveState !== 'saved') return
    const timer = setTimeout(() => setSaveState('idle'), SAVED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [saveState])

  const wakeAt = parseTimeInput(wakeDraft)
  const sleepAt = parseTimeInput(sleepDraft)

  const derivedSleepMinutes =
    wakeAt === null || sleepAt === null ? null : deriveSleepDuration(wakeAt, sleepAt)

  const invalidReason =
    wakeAt === null || sleepAt === null
      ? '请把两个时刻都填写完整'
      : derivedSleepMinutes === null
        ? '起床与就寝时刻不能相同——那样就没有清醒期了'
        : null

  const isDirty = wakeDraft !== formatTimeOfDay(schedule.wakeAt) || sleepDraft !== formatTimeOfDay(schedule.sleepAt)
  const canSave = invalidReason === null && isDirty

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave || wakeAt === null || sleepAt === null || derivedSleepMinutes === null) return

    const failure = await onSave({ wakeAt, sleepAt, sleepDurationMinutes: derivedSleepMinutes })
    if (failure === null) {
      setSaveState('saved')
      setErrorMessage('')
      return
    }

    setSaveState('error')
    setErrorMessage(failure)
  }

  return (
    <section className="card settings-card">
      <h2>我的作息</h2>

      <form onSubmit={handleSubmit}>
        <div className="settings-card__fields">
          <label>
            <span>起床</span>
            <input
              type="time"
              value={wakeDraft}
              onChange={(event) => setWakeDraft(event.target.value)}
            />
          </label>

          <label>
            <span>就寝</span>
            <input
              type="time"
              value={sleepDraft}
              onChange={(event) => setSleepDraft(event.target.value)}
            />
          </label>
        </div>

        <p className="settings-card__derived">
          {derivedSleepMinutes === null
            ? '睡眠时长将在两个时刻都填好后自动算出'
            : `计划睡眠 ${formatDuration(derivedSleepMinutes)}（自动算出，不需要填）`}
        </p>

        {invalidReason !== null && <p className="settings-card__hint">{invalidReason}</p>}

        <div className="settings-card__actions">
          <button type="submit" disabled={!canSave}>
            保存
          </button>
          {saveState === 'saved' && <span className="settings-card__ok">已保存，下次打开仍然是这个作息</span>}
          {saveState === 'error' && <span className="settings-card__error">{errorMessage}</span>}
        </div>
      </form>

      <p className="settings-card__note">
        数据只存在这台设备的浏览器里，不上传。
      </p>
    </section>
  )
}
