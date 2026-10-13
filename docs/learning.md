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

## 待理解（下一步要弄清的）

- Vite 的 HMR 到底替换了什么？为什么改组件能保留状态，改 `index.css` 却直接生效？
- TypeScript 的 `verbatimModuleSyntax`（模板默认开启）为什么要求类型导入写成 `import type { X }`？
- IndexedDB 的事务（transaction）模型：为什么它比 `localStorage` 难用，换来的是什么。
