import type { ClockView } from '../app/clockView.ts'
import { formatCivilTime } from '../app/format.ts'

interface PersonalClockProps {
  view: ClockView
  civilTime: Date
}

/**
 * Civil Time 与 Personal Time 的展示。
 *
 * 组件只接收算好的数据并渲染——不自己读时间、不自己读存储（见 docs/architecture.md 规则 4）。
 * 这里仅有两个例外，都是无害的格式化：`formatCivilTime` 与 `toLocaleDateString`。
 */
export function PersonalClock({ view, civilTime }: PersonalClockProps) {
  const { clock } = view

  return (
    <section className="card clock-card">
      <div className="clock-card__row">
        <span className="clock-card__label">民用时间</span>
        <span className="clock-card__value">
          {formatCivilTime(civilTime)}
          <span className="clock-card__date">
            {civilTime.toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </span>
        </span>
      </div>

      <div className="clock-card__row clock-card__row--accent">
        <span className="clock-card__label">个人时间</span>
        <span className="clock-card__value">{view.stateSummary}</span>
      </div>

      <dl className="clock-card__facts">
        <div>
          <dt>个人日</dt>
          <dd>{view.personalDayLabel}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{clock.state === 'awake' ? '清醒' : '睡眠中'}</dd>
        </div>
        <div>
          <dt>距就寝</dt>
          <dd>{view.untilSleepLabel}</dd>
        </div>
      </dl>
    </section>
  )
}
