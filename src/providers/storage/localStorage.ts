/**
 * Schedule 的 localStorage 实现。
 *
 * **定位**：这是从"硬编码默认作息"到"IndexedDB（第 5 步）"之间的过渡实现。
 * 它存在的唯一理由是：让设置界面的改动能真的活过刷新——否则用户改完刷新即丢，
 * 那和硬编码没有区别。第 5 步会新增 IndexedDBStorage，此处整体退场。
 *
 * 与 D-002 的关系：D-002 选定 IndexedDB 并把它隔离在 StorageProvider 之后。
 * 当前选择 localStorage 是**对 D-002 时间顺序的调整，不是对它的否定**：
 * 接口已经按 IndexedDB 的异步形态定义，所以替换时 UI 与领域层都不需要改。
 * 这一点已记入 D-013。
 */

import { fromRecord, toRecord } from './scheduleRecord.ts'
import { SCHEDULE_STORAGE_KEY, StorageError } from './index.ts'
import type { StorageProvider } from './index.ts'
import type { Schedule } from '../../domain/schedule.ts'

export function createLocalStorageScheduleStorage(storage: Storage): StorageProvider {
  return {
    async saveSchedule(schedule: Schedule): Promise<void> {
      let serialized: string
      try {
        serialized = JSON.stringify(toRecord(schedule))
      } catch (cause) {
        throw new StorageError('作息数据无法序列化', { cause })
      }

      try {
        storage.setItem(SCHEDULE_STORAGE_KEY, serialized)
      } catch (cause) {
        // 配额用尽、Safari 隐私模式、用户禁用本地存储都会走到这里。
        throw new StorageError('无法写入本地存储：可能已禁用本地存储或空间不足', { cause })
      }
    },

    async loadSchedule(): Promise<Schedule | null> {
      let serialized: string | null
      try {
        serialized = storage.getItem(SCHEDULE_STORAGE_KEY)
      } catch (cause) {
        throw new StorageError('无法读取本地存储', { cause })
      }

      if (serialized === null) return null

      let parsed: unknown
      try {
        parsed = JSON.parse(serialized)
      } catch {
        // 数据被手工改坏或来自不兼容的旧版本：按"没有作息"处理，让用户重新设置。
        // 这里刻意不抛错——读取失败是可恢复的预期情况，由 fromRecord 统一判定。
        return null
      }

      return fromRecord(parsed)
    },
  }
}

/** 纯内存实现：用于 localStorage 不可用（隐私模式、禁用存储、非浏览器环境）时兜底。 */
export function createMemoryScheduleStorage(): StorageProvider {
  let current: Schedule | null = null

  return {
    async saveSchedule(schedule: Schedule): Promise<void> {
      current = { ...schedule }
    },
    async loadSchedule(): Promise<Schedule | null> {
      return current === null ? null : { ...current }
    },
  }
}

/**
 * 选出当前环境可用的实现，优先级：localStorage → 内存。
 *
 * 探测方式是**实际写一次探测键**，而不是判断 `typeof localStorage !== 'undefined'`：
 * 后者在 Safari 隐私模式下为 true，但一写就抛异常。
 */
export function createScheduleStorage(): StorageProvider {
  try {
    const probeKey = 'nightcat.storage-probe'
    globalThis.localStorage.setItem(probeKey, '1')
    globalThis.localStorage.removeItem(probeKey)
    return createLocalStorageScheduleStorage(globalThis.localStorage)
  } catch {
    return createMemoryScheduleStorage()
  }
}
