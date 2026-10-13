# 架构（architecture.md）

核心原则：**领域逻辑与运行环境分离；变化大的部分通过接口隔离。**

## 当前真实状态（第 1 步之后）

```text
index.html
  └─ src/main.tsx            挂载 React 根节点（StrictMode）
       └─ src/app/App.tsx    静态骨架页，无领域逻辑
            └─ src/app/App.css
       └─ src/index.css      全局 CSS 变量
```

`src/domain`、`src/providers`、`src/engines`、`src/components` 目前只有 `.gitkeep`，是**目录占位**，不是已实现模块。数据流目前只有"React 渲染静态 JSX"这一条。

## 目标结构（V0 完成时）

```text
User Schedule ──► PersonalClock ────────┐
                                        │
SolarProvider ──────────────────────────┤
WeatherProvider（V0.2） ────────────────┼──► ContextEngine ──► AdviceEngine ──► UI
CalendarProvider（V0.4） ───────────────┘

StorageProvider：位于底层，为上层提供持久化，
但不让领域逻辑绑定 IndexedDB 或 SQLite。
```

## 模块职责（设计文档第 7 节）

| 模块 | 职责 | 落地步骤 |
| --- | --- | --- |
| `PersonalClock` | 计算个人时间、起床后时长、距离睡眠时长 | 第 2 步 |
| `PersonalDayResolver` | 决定某个真实时间属于哪个个人日 | 第 2 步 |
| `SolarProvider` | 提供日出、日落等太阳信息 | 第 4 步 |
| `WeatherProvider` | 提供天气与云量信息 | V0.2 |
| `ContextEngine` | 把作息、太阳、天气、日历数据标准化为 `DailyContext` | 第 4 步起 |
| `AdviceEngine` | 根据 `DailyContext` 生成建议 | 第 6 步 |
| `StorageProvider` | 保存与读取用户设置、历史记录 | 第 5 步 |
| `CalendarProvider` | 读取 Google Calendar / Exchange / Outlook 日程 | V0.4 |

## 依赖方向规则

1. 依赖只能指向**更稳定**的一侧：`UI → engines → domain`。
2. `domain` 不 import 任何 provider、任何浏览器 API（`localStorage` / `IndexedDB` / `fetch`），也不 import React。它只描述概念与纯计算，因此可以用固定时间数据直接测试。
3. provider 实现 domain 中定义的接口；`contextEngine` 只依赖接口，不依赖具体实现。
4. 组件（`src/components`）只接收已算好的数据并渲染，不自己发请求、不自己读数据库。

判断标准：如果我要把日出算法从"本地计算"换成"调用 API"，应该只改 `src/providers/solar` 一处——如果需要改 `PersonalClock` 或组件，说明抽象漏了。

## 变化点清单（最值得隔离的部分）

`Storage` / `Solar`、`Weather` Provider / `AdviceEngine` / 未来的 `CalendarProvider`。

"可扩展"不是提前实现所有可能性，而是让这些真正会变的部分有清晰边界。除此之外的东西一律先写直白实现。
