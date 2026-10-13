/**
 * StorageProvider：作息与设置的持久化边界（设计文档第 8 节）。
 *
 * 接口刻意返回 Promise——当前实现是 localStorage（同步的），但第 5 步要换成
 * IndexedDB（异步）。若现在按同步写，第 5 步就得改所有调用点，这层隔离就白做了。
 *
 * 领域逻辑只认这个接口，不认 localStorage / IndexedDB。
 */

import type { Schedule } from '../../domain/schedule.ts'

export interface StorageProvider {
  saveSchedule(schedule: Schedule): Promise<void>
  /** 没有存过作息、或存的数据已损坏时返回 null。 */
  loadSchedule(): Promise<Schedule | null>
}

export const SCHEDULE_STORAGE_KEY = 'nightcat.schedule'

/** 数据损坏或不可用时抛这个，而不是让 JSON.parse 的原始错误泄漏到 UI。 */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StorageError'
  }
}
