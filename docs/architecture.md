# 架构（architecture.md）

核心原则：**领域逻辑与运行环境分离；变化大的部分通过接口隔离。**

## 当前真实状态（第 2 步之后）

```text
index.html
  └─ src/main.tsx            挂载 React 根节点（StrictMode）
       └─ src/app/App.tsx    静态骨架页，仍未接入领域计算
            └─ src/app/App.css
       └─ src/index.css      全局 CSS 变量

src/domain/                  ← 已实现，可用 node --test 独立验证
  ├─ schedule.ts             Schedule / TimeOfDay / DurationMinutes / 校验
  ├─ personalDay.ts          resolvePersonalDay：个人日锚点（D-007）
  ├─ personalTime.ts         computePersonalClock：个人时间与清醒状态
  └─ personalTime.test.ts    32 个测试，覆盖边界与已知局限

src/components/、src/providers/、src/engines/   仍是 .gitkeep 目录占位
```

数据流目前有两条、且**尚未连通**：

1. 工程链路：`main.tsx` → `App.tsx`（静态 JSX，没有任何计算）。
2. 领域链路：`schedule.ts` ← `personalDay.ts` ← `personalTime.ts`，只被测试调用。

第 3 步要做的正是把第 2 条接到第 1 条上。

## TypeScript 项目划分（三个 project reference）

`tsc -b` 会依次检查三个项目，它们的运行环境不同，混在一起会互相污染类型：

| 配置 | 覆盖范围 | `types` | 为什么不合并 |
| --- | --- | --- | --- |
| `tsconfig.app.json` | `src/`（**排除** `*.test.ts`） | `vite/client`、DOM | 浏览器代码不该看见 `process` 这类 Node 全局 |
| `tsconfig.node.json` | `vite.config.ts` | `node` | 构建配置运行在 Node 里，不需要 DOM |
| `tsconfig.test.json` | `src/**/*.test.ts` | `node` | 测试用 `node:test`，不该看见 DOM |

关键点：`tsconfig.app.json` 必须显式 `exclude` 测试文件。否则 `include: ["src"]` 会把测试文件也纳入浏览器项目的检查，而它用的是 `node:test`——于是 `tsc -b` 会在"给浏览器准备的配置"里报 Node 类型错误。

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
| `PersonalClock` | 计算个人时间、起床后时长、距离睡眠时长 | ✅ 第 2 步 |
| `PersonalDayResolver` | 决定某个真实时间属于哪个个人日 | ✅ 第 2 步 |
| `SolarProvider` | 提供日出、日落等太阳信息（Open-Meteo API，见 D-010；原"本地算法"决策已由 D-008 记录推翻过程） | 第 4 步 |
| `WeatherProvider` | 提供天气与云量信息（与 SolarProvider 同源、同一次请求，见 D-010） | V0.2 |
| `ContextEngine` | 把作息、太阳、天气、日历数据标准化为 `DailyContext` | 第 4 步起 |
| `AdviceEngine` | 根据 `DailyContext` 生成建议 | 第 6 步 |
| `StorageProvider` | 保存与读取用户设置、历史记录 | 第 5 步 |
| `CalendarProvider` | 读取 Google Calendar / Exchange / Outlook 日程 | V0.4 |

## 依赖方向规则

1. 依赖只能指向**更稳定**的一侧：`UI → engines → domain`。
2. `domain` 不 import 任何 provider、任何浏览器 API（`localStorage` / `IndexedDB` / `fetch`），也不 import React。它只描述概念与纯计算，因此可以用固定时间数据直接测试。
3. provider 实现 domain 中定义的接口；`contextEngine` 只依赖接口，不依赖具体实现。
4. 组件（`src/components`）只接收已算好的数据并渲染，不自己发请求、不自己读数据库。
5. `src/domain/**` 与 `src/engines/**` 内部的相对导入一律带 `.ts` 后缀（`import { x } from './foo.ts'`）。这是 `node --test` 的硬要求，与模板的 `allowImportingTsExtensions` 一致，详见 D-009。
6. `domain` 内部不使用 `Date` 对象参与计算，只用 `TimeOfDay`（0–1439 的分钟数）与 `DurationMinutes` 做整数运算。`Date` 只在边界（读取设备当前时间、格式化展示）出现，这样领域层不受时区与夏令时影响。

判断标准：如果我要把日出算法从"本地计算"换成"调用 API"，应该只改 `src/providers/solar` 一处——如果需要改 `PersonalClock` 或组件，说明抽象漏了。

## 变化点清单（最值得隔离的部分）

`Storage` / `Solar`、`Weather` Provider / `AdviceEngine` / 未来的 `CalendarProvider`。

"可扩展"不是提前实现所有可能性，而是让这些真正会变的部分有清晰边界。除此之外的东西一律先写直白实现。
