NightCat（夜猫子神器）
项目设计、技术路线与版本演进
初始设计稿 · 先完成最小可运行版本，再按真实使用需求演进

“我们不要求你按照世界的时钟生活，而是让世界的时钟更适合你的生活。”

# 1. 项目概述
项目暂定名：NightCat / 夜猫子神器。
NightCat 是一个面向非传统作息用户的“个人时间系统”。它不试图把用户纠正为所谓的正常作息，而是把现实世界的时间、日照、天气与日程重新映射到用户自己的作息之上，让用户知道：现在对我来说相当于一天中的什么时候，我今天还剩多少可利用的自然光，以及接下来更适合做什么。
产品哲学：我们不要求你按照世界的时钟生活，而是让世界的时钟更适合你的生活。
第一阶段目标不是做一个复杂的健康管理平台，而是完成一个最小可运行、可长期迭代的个人工具，并在开发过程中保持清晰的领域模型和可替换接口。
# 2. 核心问题与产品价值
传统日历和天气应用默认“自然日”和“标准作息”是一致的。例如凌晨 03:00 会被视为新的一天，但对一个 05:00 睡、13:00 起的人来说，凌晨 03:00 很可能仍然属于前一天的“晚上”。
NightCat 解决的核心问题包括：
民用时间并不能准确表达用户一天中的主观阶段。
日出、日落与用户清醒区间之间存在错位。
普通日历无法直观表达“这个会议发生在我起床后多久”。
夜间作息用户容易错过自然光窗口，但普通天气 App 不会结合个人作息给出提示。
因此产品的核心不是“提醒早睡”，而是建立一层 Personal Temporal Layer（个人时间层），把现实世界信息转换成对当前用户有意义的时间语义。
# 3. 核心领域模型
3.1 Civil Time（民用时间）
现实世界当地时间，例如 2026-10-12 17:00，UTC+8。它是外部世界的时间基准。
3.2 Personal Time（个人时间）
相对于用户起床时刻计算的主观时间。例如用户 13:00 起床，那么现实 17:00 可以表达为“起床后 4 小时”。未来还可以映射为更直观的“个人上午/下午/晚上”。
3.3 Personal Day（个人日）
NightCat 不直接把午夜 00:00 作为一天的边界。一个 Personal Day 从用户的起床或设定的个人日边界开始，到下一次睡眠周期结束为止。
例：用户 2026-10-12 13:00 起床，2026-10-13 05:00 睡觉，则 2026-10-13 03:00 仍属于“2026-10-12 个人日”。
3.4 Solar / Environment Context（太阳与环境上下文）
由地理位置和日期计算或获取日出、日落、太阳高度等基础信息，并结合天气形成“可利用自然光窗口”。
3.5 Advice（建议）
Advice Engine 不直接依赖某个天气 API 或某个 UI。它只消费标准化后的上下文并产生建议。这样规则引擎、LLM 引擎、混合引擎可以互换。
# 4. MVP：第一版只解决一个问题
MVP 的目标：回答“按照我的作息，现在相当于几点，以及今天还有多少自然光可以利用？”
用户输入：
起床时间
睡眠时间
所在位置（手动城市或经纬度）
系统计算：
当前 Civil Time
当前 Personal Time
当前是否处于清醒区间
当日日出/日落
用户清醒区间与日照区间的交集
今日剩余自然光时间
第一版规则建议示例：
若用户尚未起床，不提醒出门。
若剩余日照不足 60 分钟且用户清醒，提示“今天自然光窗口不多了，可以考虑现在出门”。
若已经日落，显示“今日自然光窗口已结束”。
第一版不做：账号、多设备同步、复杂健康建议、微服务、消息队列、LLM、社交功能。
# 5. V0 技术栈
推荐组合：React + TypeScript + Vite + IndexedDB。
React：负责 UI 组件和状态驱动的界面更新。例如 PersonalClock、SunlightCard、AdvicePanel。
TypeScript：负责类型约束和领域模型表达。对于 PersonalDay、Schedule、DailyContext、Provider 等概念，类型系统可以防止大量低级错误，并提升 AI 生成代码的可审查性。
Vite：开发服务器 + 前端构建工具。开发时提供快速启动和热更新；发布时把 React/TypeScript 项目构建成浏览器可加载的静态资源。它不是包管理器；npm/pnpm 才更接近 Python 的 pip。
IndexedDB：浏览器内置本地数据库。V0 只需要保存单用户的作息、位置、偏好与少量历史，无需服务器。IndexedDB 足够离线、隐私友好，且无需维护数据库服务。
V0 不需要传统后端：核心功能主要是本地计算 + 外部公开数据查询。只有当出现账号、同步、付费 LLM、密钥保护等需求时，再引入后端。
# 6. Web App、PWA 与 Tauri 的关系
这不是三个必须依次替换的技术，而是同一套核心代码的不同运行形态。
推荐关系：
React + TypeScript
      |
     Vite
      |
  +---+----------------+
  |                    |
Web App             Tauri App
  |
 PWA
Web App：部署为网站，用户通过浏览器访问。代码更新后用户刷新即可使用新版本。
PWA：在 Web App 基础上加入 Service Worker、离线缓存、安装到桌面/主屏幕、部分通知能力。仍然属于 Web 技术。
Tauri：把 Web 前端放入本地 WebView，并通过 Rust/Tauri 获得更强的系统能力，例如 SQLite、文件访问、系统托盘、开机启动和更可靠的后台通知。它是真正的桌面应用，而不是简单的网页快捷方式。
因此合理的开发顺序是：先做 Web MVP；如果需要安装体验和离线能力，增强为 PWA；当确实需要更强系统能力时，再提供 Tauri 桌面版本。
# 7. 建议架构
核心原则：领域逻辑与运行环境分离；变化大的部分通过接口隔离。
建议模块：
PersonalClock：计算个人时间、起床后时长、距离睡眠时长。
PersonalDayResolver：决定某个真实时间属于哪个个人日。
SolarProvider：提供日出、日落等太阳信息。
WeatherProvider：提供天气与云量等信息。
ContextEngine：把作息、太阳、天气、日历等数据标准化为 DailyContext。
AdviceEngine：根据 DailyContext 生成建议。
StorageProvider：保存与读取用户设置、历史记录。
CalendarProvider（后续）：读取 Google Calendar / Exchange / Outlook 等日程。
示意：
User Schedule -> PersonalClock ----+
                                  |
SolarProvider --------------------+--> ContextEngine --> AdviceEngine --> UI
WeatherProvider ------------------+
CalendarProvider (later) ---------+
StorageProvider 位于底层，为上层模块提供持久化，但不让领域逻辑绑定 IndexedDB 或 SQLite。
# 8. 接口设计示例
以下接口只是方向，不要求 V0 一开始全部实现：
interface StorageProvider {
  saveSchedule(schedule: Schedule): Promise<void>
  loadSchedule(): Promise<Schedule | null>
}
interface SolarProvider {
  getSolarContext(date: Date, location: Location): Promise<SolarContext>
}
interface AdviceEngine {
  generate(context: DailyContext): Promise<Advice[]>
}
这样可以实现：
IndexedDBStorage -> SQLiteStorage -> CloudStorage
RuleBasedAdviceEngine -> LLMAdviceEngine -> HybridAdviceEngine
某天气服务 -> 另一个天气服务
“可扩展”不意味着提前做微服务或插件系统，而是让变化最频繁的依赖不要渗透到整个项目。
# 9. 数据、隐私与健康边界
作息与位置属于较敏感的个人数据。V0 默认本地优先：能不上传就不上传；位置可允许用户手动选择城市，避免强制精确定位。
天气与日照建议应使用克制文案。第一阶段更适合称为 Estimated Daylight Opportunity（预计自然光机会），而不是医学意义上的“日照剂量”。
简单估计模型可以是：清醒区间 ∩ 太阳位于地平线以上区间，再乘以天气修正因子。天气修正因子只是产品层估计，不应声称能准确代表照度或医学效果。
未来若加入太阳高度、云量、UV、环境光传感器等数据，可以提高估计质量，但仍应明确“不构成医疗建议”。
# 10. 版本演进路线
V0 - 可运行原型
React + TypeScript + Vite
设置起床/睡眠时间
位置输入
Personal Time
Personal Day
日出/日落
剩余自然光
IndexedDB 本地存储
V0.1 - 可日常使用
更完整的个人日边界处理
本地历史记录
基础规则建议
失败/无网络情况下的降级逻辑
V0.2 - 环境感知
WeatherProvider
云量/天气修正
Estimated Daylight Opportunity
更丰富的规则型 Advice Engine
V0.3 - 作息历史
记录实际起床和睡眠
统计作息偏移
允许计划作息与实际作息分开
可选的自动调整个人时间模型
V0.4 - 日程集成
CalendarProvider
Google Calendar / Exchange / Outlook 等
将现实日程转换为“起床后 X 小时”
检测发生在睡眠期或刚起床后的事件
V0.5 - 通知与跨平台增强
PWA 安装与离线缓存
通知：剩余日照、临近事件等
评估 Tauri 桌面版本
若使用 Tauri，引入 SQLite 和系统托盘/开机启动
V0.6 - 付费 AI 层
后端代理 LLM API，避免客户端暴露密钥
LLMAdviceEngine / HybridAdviceEngine
每日行动建议
日程报告
对天气、日照、作息、日程进行综合解释
免费版保留规则引擎，付费版出售“综合理解与个性化表达”
# 11. 什么时候需要后端
V0-V0.3 默认不需要后端。
出现以下需求时再引入：
1. 多设备同步：需要账号体系和云数据库。
2. 付费 LLM：需要服务器保护 API Key、计费与限流。
3. 云端历史与备份：需要用户数据存储。
4. 团队或多用户功能：需要权限和共享模型。
后端技术可以选择 Node/TypeScript 或 Go。若目标是延续 TS/Agent 学习路线，可优先 Node/TypeScript；若后续需要复用已有 Go 基础，也可以用 Go。数据库到这一阶段再考虑 PostgreSQL。
不要因为“未来可能需要”就在第一版加入服务器。
# 12. IndexedDB、SQLite、PostgreSQL 的演进
IndexedDB：适合 Web/PWA、本地优先、无需安装数据库。V0 首选。
SQLite：适合 Tauri/桌面应用。它是应用直接管理的本地数据库文件，查询能力强于 IndexedDB。
PostgreSQL：适合云端账号、同步、多人数据与后台服务。
可以通过 StorageProvider 把三者隔离：
IndexedDBStorage -> SQLiteStorage -> Postgres-backed API。
注意：实际迁移时并不一定完全“无缝替换”，但保持领域层不依赖具体数据库能显著降低改动范围。
# 13. 推荐目录结构
nightcat/
├─ src/
│  ├─ app/
│  │  └─ App.tsx
│  ├─ components/
│  │  ├─ PersonalClock.tsx
│  │  ├─ SunlightCard.tsx
│  │  └─ AdvicePanel.tsx
│  ├─ domain/
│  │  ├─ schedule.ts
│  │  ├─ personalTime.ts
│  │  ├─ personalDay.ts
│  │  └─ context.ts
│  ├─ providers/
│  │  ├─ solar/
│  │  ├─ weather/
│  │  └─ storage/
│  ├─ engines/
│  │  ├─ contextEngine.ts
│  │  └─ adviceEngine.ts
│  └─ main.tsx
├─ docs/
│  ├─ PROJECT_DESIGN.md
│  ├─ domain.md
│  ├─ architecture.md
│  ├─ decisions.md
│  └─ learning.md
├─ AGENTS.md
├─ package.json
└─ vite.config.ts
不要为了目录漂亮而提前创建大量空模块。随着 V0 功能落地逐步拆分。
# 14. Git 与版本管理
使用 Git 管理版本，但保持流程简单。
建议：
main：始终保持可运行。
feature/personal-clock
feature/personal-day
feature/solar
feature/storage
feature/weather（V0.2）
每个分支解决一个明确问题。Commit 说明应表达“为什么改”而不只是“改了什么”。
版本可使用语义化风格：v0.1.0、v0.2.0 等，但在早期不必追求复杂发布流程。核心目标是保证每个阶段都有一个可运行基线。
# 15. Vibe Coding + 学习模式
目标不是禁止 AI 写代码，而是避免“项目完成了，但知识仍然属于 AI”。推荐把 AI 作为结对程序员和 Reviewer，而不是完全外包程序员。
开发规则：
1. 先设计，后实现。新模块先说明职责、输入输出和依赖，再写代码。
2. 小步生成。一次最多实现一个清晰功能或少量文件，不直接“完成整个项目”。
3. 新依赖必须解释。加入库时记录：为什么需要、替代方案是什么、它解决什么问题。
4. 每次 AI 生成代码后做 Code Review：这段代码做什么？为什么这样设计？如果不用这个抽象会怎样？
5. 关键逻辑至少自己修改一次。通过重命名、拆函数、补测试或修改行为，验证自己真正理解。
6. 每完成一个功能更新 learning.md 和 decisions.md。
7. 不把“能跑”视为完成；至少能解释核心数据流和关键接口。
建议 AGENTS.md / Learning Mode 规则：
Explain architecture before implementation.
Do not create more than 3 files at once unless necessary.
Explain every new dependency.
After implementation, summarize concepts learned, design decisions and trade-offs.
Prefer asking the developer to review or modify core logic rather than silently replacing it.
学习重点不是记住 React API，而是理解数据流、状态、边界、接口和变化点。
# 16. 文档体系
docs/domain.md：定义 Personal Time、Personal Day、Solar Context 等领域概念。
docs/architecture.md：说明模块依赖和数据流。
docs/decisions.md：记录架构决策，例如“为什么 V0 不做后端”“为什么用 IndexedDB”。可以逐步演进成 ADR（Architecture Decision Record）。
docs/learning.md：记录开发过程中第一次遇到或真正理解的技术概念，例如 Vite、React state、IndexedDB transaction、Service Worker。
PROJECT_DESIGN.md：作为项目总览，只记录相对稳定的设计，不塞入每次实现细节。
# 17. 明确避免的过度设计
V0 不需要：
微服务
Kubernetes
消息队列
复杂事件总线
完整插件系统
账号与 OAuth
云数据库
LLM
为未来未知需求写大量接口
“可修改性”不是预先实现所有可能性，而是让真正可能变化的部分具有清晰边界。对于 NightCat，目前最值得隔离的是 Storage、Solar/Weather Provider、Advice Engine 和未来 Calendar Provider。
# 18. 下一步实施顺序
第 1 步：初始化 React + TypeScript + Vite 仓库，建立 Git main。
第 2 步：只实现 Schedule、PersonalClock、PersonalDayResolver，并用固定时间数据测试。
第 3 步：实现最简单 UI，显示 Civil Time / Personal Time。
第 4 步：加入 SolarProvider，计算日出/日落与剩余自然光。
第 5 步：加入 IndexedDB，持久化用户作息和位置。
第 6 步：实现最简单 RuleBasedAdviceEngine。
第 7 步：部署 Web App，实际连续使用几天，再决定 V0.1 改什么。
第一版完成标准：一个真实用户可以设置自己的作息和位置，刷新页面后数据仍在，并能在任意时刻看懂“现在是我的一天中的什么时候、今天还剩多少自然光”。
在这个标准完成前，不进入天气、日历、Tauri 或 LLM。