# 架构（architecture.md）

核心原则：**领域逻辑与运行环境分离；变化大的部分通过接口隔离。**

## 当前真实状态（第 3 步之后）

```text
index.html
  └─ src/main.tsx                    挂载 React 根节点（StrictMode）
       └─ src/app/App.tsx            接线：读存储 → 算视图 → 渲染
            ├─ src/app/useCurrentTime.ts   每秒推进的"当前时间"
            ├─ src/app/clockView.ts        领域对象 → 界面文案（纯函数，可测）
            ├─ src/app/format.ts           时间/时长格式化（纯函数，可测）
            ├─ src/components/PersonalClock.tsx     民用时间 / 个人时间 / 状态
            ├─ src/components/ScheduleSettings.tsx  作息设置表单
            └─ src/app/App.css
       └─ src/index.css              全局 CSS 变量

src/domain/                          ← 纯计算，可用 node --test 独立验证
  ├─ schedule.ts                     Schedule / TimeOfDay / DurationMinutes / 校验
  ├─ personalDay.ts                  resolvePersonalDay：个人日锚点（D-007）
  └─ personalTime.ts                 computePersonalClock：个人时间与清醒状态

src/providers/storage/               ← 持久化边界（第 3 步落地，D-013）
  ├─ index.ts                        StorageProvider 接口 + 错误类型
  ├─ scheduleRecord.ts               持久化格式与转换（纯函数，可测）
  └─ localStorage.ts                 localStorage 实现 + 内存兜底

src/engines/                         仍是 .gitkeep 目录占位
```

数据流现已**连通**：

```text
localStorage ──load──► App ──schedule──► composeClockView ──view──► PersonalClock
                        │                        ▲
                        │                   useCurrentTime（每秒一次）
                        │
                   ScheduleSettings ──onSave──► storage.saveSchedule
```

第 3 步刻意把**能测的逻辑从组件里挤出来**：组件本身没有自动化验证（没有浏览器测试方案，D-009），
所以"状态文案怎么拼""时长怎么格式化"都放进了 `clockView.ts` / `format.ts` 两个纯函数模块，
组件只剩渲染。这也是"第 3 步只做第 3 步的事"和"要能自动验证"之间的折中。

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
| `StorageProvider` | 保存与读取用户设置、历史记录 | 🟡 第 3 步已落地 localStorage（D-013）；第 5 步换 IndexedDB |
| `CalendarProvider` | 读取 Google Calendar / Exchange / Outlook 日程 | V0.4 |

## 依赖方向规则

1. 依赖只能指向**更稳定**的一侧：`UI → engines → domain`。
2. `domain` 不 import 任何 provider、任何浏览器 API（`localStorage` / `IndexedDB` / `fetch`），也不 import React。它只描述概念与纯计算，因此可以用固定时间数据直接测试。
3. provider 实现 domain 中定义的接口；`contextEngine` 只依赖接口，不依赖具体实现。
4. 组件（`src/components`）只接收已算好的数据并渲染，不自己发请求、不自己读数据库。
5. `src/domain/**` 与 `src/engines/**` 内部的相对导入一律带 `.ts` 后缀（`import { x } from './foo.ts'`）。这是 `node --test` 的硬要求，与模板的 `allowImportingTsExtensions` 一致，详见 D-009。
6. `domain` 内部不使用 `Date` 对象参与计算，只用 `TimeOfDay`（0–1439 的分钟数）与 `DurationMinutes` 做整数运算。`Date` 只在边界（读取设备当前时间、格式化展示）出现，这样领域层不受时区与夏令时影响。

判断标准：如果我要把日出算法从"本地计算"换成"调用 API"，应该只改 `src/providers/solar` 一处——如果需要改 `PersonalClock` 或组件，说明抽象漏了。

**这条判断标准已经在 Storage 上实测过一次**：第 3 步把持久化从 localStorage 换成（将来）IndexedDB 时，
需要改的只有 `src/providers/storage/` 一个目录——`App.tsx` 只认 `StorageProvider` 接口，
领域层完全不知道存储存在。这就是"隔离变化点"从口号变成可检验事实的样子。

同理，为了让第 4 步的接入也能满足这条标准，`App.tsx` 里不出现任何 `fetch`，
只出现 `storage.loadSchedule()` 这样的接口调用。

## 变化点清单（最值得隔离的部分）

`Storage` / `Solar`、`Weather` Provider / `AdviceEngine` / 未来的 `CalendarProvider`。

"可扩展"不是提前实现所有可能性，而是让这些真正会变的部分有清晰边界。除此之外的东西一律先写直白实现。
