# 学习笔记（learning.md）

记录开发过程中**第一次遇到、或真正想明白了**的技术概念。判断标准：能不能用自己的话把它讲清楚，并说出它在本项目里解决了什么问题。不是抄文档。

---

## 第 1 步：工程基线（React + TypeScript + Vite）

### 脚手架、框架、构建工具是三件事

`npm create vite@latest nightcat -- --template react-ts` 一次性做了三件事：下载模板、生成工程文件、告诉我接下来跑 `npm install`。理解上的关键点是**它们各自负责什么**：

- `npm create` / `npm install` 属于**包管理器**（npm）的职责：把依赖装到 `node_modules`，并写死版本到 `package-lock.json`。
- 模板（`--template react-ts`）只是**一堆初始文件**：`src/`、`index.html`、`tsconfig*.json`、`vite.config.ts`。它没有任何魔法，里面的每一行都可以改。
- Vite 是**开发服务器 + 构建工具**，不是包管理器。这正好是设计文档第 5 节特意点出的一句话，现在有了具体对应物。

### `index.html` 是入口，而且它就在项目根目录

以前对前端工程的印象是"JS 文件是入口"。Vite 的模型是：`index.html` 是入口，它里面用 `<script type="module" src="/src/main.tsx">` 指向真正的 TS 入口。所以改页面标题、语言、meta 是改 `index.html`，不是改 React 代码。

`<div id="root">` 则是给 React 用的挂载点：`main.tsx` 里 `createRoot(document.getElementById('root')!)` 把整棵组件树挂上去。`!` 是 TS 的非空断言——我（开发者）向编译器保证这个元素一定存在，如果不存在就会在运行时报错。这是类型系统帮不上忙的地方，需要自己保证 `index.html` 与 `main.tsx` 的约定一致。

### `tsc -b` 与 `vite build` 是两件不同的事

`npm run build` 实际跑的是 `tsc -b && vite build`：

- `tsc -b`（build mode）只做**类型检查**，因为 `tsconfig.app.json` 里设了 `noEmit: true`——它不产出 JS，只产出错误。
- `vite build` 才是真正打包：把 TS/JSX/CSS 转成浏览器能直接加载的产物（`dist/`），做压缩和 tree-shaking。

这解释了为什么"类型错误"和"能不能构建出页面"是两回事：`vite build` 用的是 esbuild 转换，它会**直接丢掉类型**、不做类型检查。所以只跑 `vite build` 可能构建成功但类型是错的——`tsc -b` 是必须单独跑的那道闸。

Vite 8 里 `tsc -b` 还用了「项目引用」（`tsconfig.json` 里 `references` 指向 `tsconfig.app.json` 与 `tsconfig.node.json`）。原因是浏览器代码和 Node 侧配置（`vite.config.ts`）的运行环境不同：前者需要 DOM 类型，后者需要 Node 类型，混在一个配置里会互相污染。

### React 19 的 `StrictMode` 会让开发环境渲染两次

`main.tsx` 里包了 `<StrictMode>`。它只在开发模式生效，会**故意**把组件渲染两次、effect 跑两遍（挂载→卸载→再挂载），用来提前暴露"副作用没清理干净"的问题。

这对 NightCat 有直接影响：后面写"读 IndexedDB、写 IndexedDB"或"发请求"的 effect 时，必须写成**幂等且能清理**的，否则开发环境下会出现重复写入或重复请求。这不是 bug，是 StrictMode 在替我试压。

### 为什么目录里放了 `.gitkeep`

Git 不追踪空目录。`src/domain/` 这类目录 V0 暂时是空的，但我想让目录结构在仓库里可见，所以放一个空的 `.gitkeep` 占位。等到真正实现模块时删掉它——它不代表任何设计意图，只是 Git 的补丁。

---

## 第 2 步：领域层核心计算（Schedule / PersonalDay / PersonalClock）

### 领域层为什么不用 `Date` 做运算

`PersonalClock` 要做的事是"某个时刻相对于起床时刻过了多久"。最直觉的写法是拿两个 `Date` 相减取毫秒差。我没有这么做，而是先把时刻转成**零点后分钟数**（`TimeOfDay`，0–1439）再做整数运算。

原因是 `Date` 是一个"绝对时间点"（内部就是 UTC 毫秒数），而个人日关心的是**墙上的时钟**：用户说"我 13:00 起床"，指的是当地时钟显示 13:00，不是某个 UTC 瞬间。这两个概念在夏令时切换日会分叉——那天当地时钟会跳过或重复一小时。用 `Date` 相减得到的是物理经过时长，用分钟数相减得到的是时钟表盘走过的距离，本项目要的是后者。

代价我也写在测试里了：`elapsedMinutes` 不补偿夏令时跳变。这是**有意识的取舍**，不是没想到——测试专门断言了这个行为，免得以后有人以为它是 bug 顺手"修"成另一种语义。

### 一个 15 秒的 bug：用取整值做边界判断

第一轮测试有一条挂了：`04:59:59`（就寝时刻是 `05:00:00`）被判成 `asleep`。

原因是我把 `elapsedMinutes` 算成了 `Math.round(959.98) = 960`，然后又用这个**取整后**的值去和清醒期长度 960 比较，`960 < 960` 为假 → 判成就寝。逻辑没错，错在把"给人看的数字"喂给了"做判断的边界"。

修法是分开两件事：状态用**未取整的毫秒差**判定（`elapsedExactMs < awakeWindowMinutes * 60_000`），显示值才取整。这是同一类错误的通用形态——**凡是"显示值"与"判定值"共用一个变量，边界处必然差一个取整单位**。

修完我补了一条回归测试，直接钉住睡前 1 毫秒 / 后 1 毫秒这两个点。

### 第二个 bug：两个显示数字加起来超过了总数

修完上面那条，又发现 `awakeMinutes`（960）与 `untilSleepMinutes`（1）相加等于 961，超过清醒期总长 960。界面会显示"已清醒 960 分钟、距就寝还剩 1 分钟"这种自相矛盾的话。

根因是两个值各自独立取整。改成**由同一个取整值反推**（`untilSleepMinutes = 清醒期总长 − elapsedMinutes`），两者之和恒等于总长。代价是睡前 1 秒的"剩余"显示为 0 而非 1 分钟——取整的诚实代价，比矛盾显示好。

这两条合起来是一句可复用的经验：**取整只能发生一次，且必须发生在最外层**。

### 让坏数据在入口就失败

`assertValidSchedule` 除了逐字段范围校验，还做了一条**交叉一致性**校验：`wakeAt` 到 `sleepAt` 的间隔蕴含"睡眠多少分钟"，而 `sleepDurationMinutes` 也表达同一件事，两者必须在 1 分钟内吻合。

如果不校验，就会出现最难受的一类 bug：**模块按 A 计算，却对外报告 B**。例如作息写"13:00 起床、05:00 就寝、睡 5 小时"——三个数字自相矛盾，但每个单独看都合法。这种数据进来的表现是"数字看起来都对，就是不符合直觉"，排查成本极高。宁可在入口抛 `RangeError`。

顺带记一个代码味道：我第一版 `resolvePersonalDay` 为了复用校验，现场造了个假 `Schedule`（`sleepAt: 0, sleepDurationMinutes: 1439`）——纯粹为了满足函数签名。这种"为了调用而编造数据"的写法是抽象漏了的信号，改成把 `assertTimeOfDay` 单独导出就干净了。

### `node --test` 跑 TypeScript 的两条硬约束（实测）

- Node 24 的 type stripping **默认开启**，`node --test "src/**/*.test.ts"` 可以直接跑 `.ts`，不需要 tsx、ts-node 或任何框架。
- **相对导入必须带 `.ts` 后缀**：`from './foo.ts'` 通过，`from './foo'` 报 `ERR_MODULE_NOT_FOUND`。这不是风格问题，是 Node 的 ESM 解析要求。
- glob **要加引号**交给 Node 自己展开：`node --test src/` 会把目录当模块加载并报 `MODULE_NOT_FOUND`。
- 附带好处：`allowImportingTsExtensions: true` 本来就开着，所以同一个 `.ts` 后缀在 Vite 里也能解析——一份代码两处都能跑。

### 为什么测试要单独一个 tsconfig

`node:test` 的类型来自 `@types/node`，而 `tsconfig.app.json` 的 `types` 只有 `vite/client`。于是测试文件在"浏览器项目"里类型检查失败。

我没有简单地把 `"node"` 加进 `types`（那是本能反应），因为那会让 `process`、`Buffer` 这类 Node 全局在 UI 代码里也变成合法的——而"领域层不依赖运行环境"正是这个项目最想守住的边界。改用独立项目 `tsconfig.test.json`，并让 app 项目 `exclude` 掉测试文件。

验证方式值得记：`npx tsc -p tsconfig.app.json --showConfig` 会打印该项目**实际纳入的文件清单**。靠它我才确认 exclude 生效（5 个文件 → 4 个），而不是靠"改了应该就好了"。

---

## 待理解（下一步要弄清的）

- Vite 的 HMR 到底替换了什么？为什么改组件能保留状态，改 `index.css` 却直接生效？
- TypeScript 的 `verbatimModuleSyntax` 为什么要求类型导入写成 `import type { X }`？（第 2 步已经照做，但还没真正理解它的作用）
- React 里"每秒刷新一次的当前时间"该怎么写，才能既触发重渲染又不至于把领域计算重复跑（第 3 步会遇到）。
