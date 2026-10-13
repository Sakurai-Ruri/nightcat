import { useEffect, useState } from 'react'
import './App.css'
import { composeClockView } from './clockView.ts'
import { useCurrentTime } from './useCurrentTime.ts'
import { PersonalClock } from '../components/PersonalClock.tsx'
import { ScheduleSettings } from '../components/ScheduleSettings.tsx'
import type { Schedule } from '../domain/schedule.ts'
import { createScheduleStorage } from '../providers/storage/localStorage.ts'

/**
 * 存储实现在模块作用域创建一次：它代表一个"长期存在的基础设施"。
 * 若写在组件里，每次渲染都会新建一个实例（StrictMode 下还会翻倍）。
 * 工厂函数内部会探测 localStorage 是否真的可写，不可用时退化为内存实现。
 */
const storage = createScheduleStorage()

/**
 * 示例作息：13:00 起床、次日 05:00 就寝。
 * 它只在"用户从未保存过作息"时用于预填表单，并且页面会明确提示这是示例值——
 * 不是悄悄写死一个作息然后假装那是用户的设置。
 */
const DEFAULT_SCHEDULE: Schedule = {
  wakeAt: 13 * 60,
  sleepAt: 5 * 60,
  sleepDurationMinutes: 8 * 60,
}

function App() {
  const now = useCurrentTime()

  // 三种状态：仍在读取（null）/ 已读到或已保存 / 从未设置过（用示例值预填并自动展开表单）。
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [hasStoredSchedule, setHasStoredSchedule] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [loadFailure, setLoadFailure] = useState('')

  useEffect(() => {
    let cancelled = false

    storage
      .loadSchedule()
      .then((loaded) => {
        if (cancelled) return
        if (loaded !== null) {
          setSchedule(loaded)
          setHasStoredSchedule(true)
          return
        }
        setSchedule(DEFAULT_SCHEDULE)
        setHasStoredSchedule(false)
        setIsSettingsOpen(true)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setSchedule(DEFAULT_SCHEDULE)
        setHasStoredSchedule(false)
        setIsSettingsOpen(true)
        setLoadFailure(error instanceof Error ? error.message : '读取本地作息失败')
      })

    // 清理是必需的：StrictMode 下 effect 会跑两遍，不加锁会写入两次状态。
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async (next: Schedule): Promise<string | null> => {
    try {
      await storage.saveSchedule(next)
    } catch (error) {
      return error instanceof Error ? error.message : '保存失败'
    }

    setSchedule(next)
    setHasStoredSchedule(true)
    return null
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>NightCat</h1>
        <p className="app__subtitle">夜猫子神器 · 让世界的时钟更适合你的生活</p>
      </header>

      {schedule === null ? (
        <p className="app__loading">正在读取本地作息…</p>
      ) : (
        <>
          <PersonalClock view={composeClockView(schedule, now)} civilTime={now} />

          {!hasStoredSchedule && (
            <p className="app__notice">
              还没有设置过作息，当前是示例值。改好并保存后，它就是你的了。
              {loadFailure === '' ? '' : `（${loadFailure}）`}
            </p>
          )}

          {isSettingsOpen ? (
            <ScheduleSettings schedule={schedule} onSave={handleSave} />
          ) : (
            <button type="button" className="app__edit" onClick={() => setIsSettingsOpen(true)}>
              修改作息
            </button>
          )}
        </>
      )}

      <footer className="app__footer">
        <span>数据全部留在本地，不上传。</span>
        <span>剩余自然光与建议：第 4–6 步</span>
      </footer>
    </main>
  )
}

export default App
