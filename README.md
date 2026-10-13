# NightCat（夜猫子神器）

> 我们不要求你按照世界的时钟生活，而是让世界的时钟更适合你的生活。

NightCat 是一个面向非传统作息用户的**个人时间系统**。它不试图把用户纠正为"正常作息"，而是把现实世界的时间、日照、天气与日程重新映射到用户自己的作息之上，回答两个问题：

1. 现在对我来说，相当于一天中的什么时候？
2. 今天还剩多少可利用的自然光，接下来更适合做什么？

完整设计见 [`docs/PROJECT_DESIGN.md`](docs/PROJECT_DESIGN.md)。

## 当前状态：V0 骨架 + 领域层核心计算

已完成：

- **第 1 步**：React 19 + TypeScript 6 + Vite 8 工程可构建、可热更新；目录骨架按设计文档第 13 节立起
- **第 2 步**：`Schedule` / `PersonalDayResolver` / `PersonalClock` 三个领域模块，32 个测试全绿

尚未实现：UI 计算渲染（第 3 步）、日出日落与剩余自然光（第 4 步）、IndexedDB 持久化（第 5 步）、建议引擎（第 6 步）。因此现在还不能在界面上回答"现在是我一天中的什么时候"。

## 快速开始

```bash
cd nightcat
npm install
npm run dev        # http://localhost:5173
```

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（热更新） |
| `npm test` | 运行领域层测试（`node --test`，零测试依赖） |
| `npm run build` | `tsc -b` 三个项目类型检查 + 生产构建，产物在 `dist/` |
| `npm run lint` | oxlint 静态检查 |
| `npm run preview` | 本地预览 `dist/` 构建产物 |

> 若 npm 报 `EPERM`（本机 `~/.npm/_cacache` 有 root 属主文件），加 `--cache ../.npm-cache`：缓存目录在该用户目录下之外，避免用 sudo 改家目录权限。

## 目录结构

```text
nightcat/
├─ src/
│  ├─ app/          应用外壳（App.tsx / App.css）— 第 3 步接入真实数据
│  ├─ components/   展示组件：PersonalClock / SunlightCard / AdvicePanel
│  ├─ domain/       领域模型（已成模块）见下方
│  ├─ providers/    外部数据适配：solar / weather / storage
│  ├─ engines/      contextEngine / adviceEngine
│  ├─ index.css     全局样式变量
│  └─ main.tsx      React 入口
├─ docs/            领域、架构、决策、学习笔记
├─ AGENTS.md        AI 协作与学习模式规则
├─ index.html       Vite HTML 入口
└─ vite.config.ts
```

未落地的目录仍用 `.gitkeep` 占位；`src/domain/` 已实现，占位文件已删除。

## 领域层（第 2 步）

| 模块 | 职责 | 关键约定 |
| --- | --- | --- |
| `domain/schedule.ts` | `Schedule` 类型、`TimeOfDay` / `DurationMinutes`、作息合法性校验 | 起床时刻同时是个人日锚点 |
| `domain/personalDay.ts` | `resolvePersonalDay(wakeAt, at)`：某时刻属于哪个个人日 | 个人日 = 当天起床时刻 → 次日同一时刻 |
| `domain/personalTime.ts` | `computePersonalClock(schedule, at)`：个人时间、起床后时长、睡眠状态 | 未起床时 `awakeMinutes` 为 `null`，不用负数 |

三条设计取舍，都有测试钉住：

1. **个人日以起床时刻为锚**（D-007）。13:00 起床的人，次日 03:00 仍属于前一天的个人日。
2. **状态判定用未取整的瞬时值**，显示值才取整到分钟。若用取整值判状态，"就寝前一秒"会被误判成 `asleep`。
3. **`awakeMinutes + untilSleepMinutes` 恒等于清醒期总长**。两个数字若各自独立取整，会出现"已清醒 960 分钟、距就寝还剩 1 分钟"这种自相矛盾的显示。

已知局限（已在测试中显式记录，不假装不存在）：`elapsedMinutes` 按本地时间字段直接相减，**不补偿夏令时跳变**，切换日的真实经过时长可能与之相差 1 小时；连续熬夜超过 24 小时不会切分个人日。

## 依赖说明

目前只有 Vite React 模板的最小集合；新增依赖必须同样说明理由：

| 依赖 | 为什么需要 | 替代方案 | 它解决什么问题 |
| --- | --- | --- | --- |
| `react` / `react-dom` | UI 与状态驱动渲染 | Vue / Svelte / 原生 DOM | 用组件描述界面，状态变化自动重渲染 |
| `typescript` | 领域模型需要类型约束，也让 AI 生成的代码可审查 | 纯 JS + JSDoc | 编译期拦住 `PersonalDay`、`Schedule` 这类概念的低级错误 |
| `vite` + `@vitejs/plugin-react` | 开发服务器与生产构建 | webpack / Parcel / Rspack | 毫秒级热更新；把 TS/JSX 构建成浏览器可直接加载的静态资源 |
| `oxlint` | 静态检查 | ESLint | 快速发现可疑代码，配置成本低 |
| `@types/*`、`@types/node` | React / Node API 的类型声明 | — | 让类型检查覆盖第三方 API |

注意：Vite **不是**包管理器，它负责开发与构建；安装依赖用 npm。

## 隐私边界

作息与位置属于敏感个人数据。V0 默认本地优先：数据存 IndexedDB，不上传；位置允许手动选择城市，不强制精确定位。日照相关文案使用"预计自然光机会"（Estimated Daylight Opportunity）而非医学意义上的"日照剂量"，且不构成医疗建议。

## 版本路线

V0 可运行原型 → V0.1 可日用 → V0.2 环境感知（天气） → V0.3 作息历史 → V0.4 日程集成 → V0.5 通知与跨平台（PWA/Tauri） → V0.6 付费 AI 层。详见设计文档第 10 节。
