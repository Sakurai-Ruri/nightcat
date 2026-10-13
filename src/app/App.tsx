import './App.css'

const PHILOSOPHY = '我们不要求你按照世界的时钟生活，而是让世界的时钟更适合你的生活。'

/**
 * V0 骨架：这一版不包含任何领域逻辑。
 * 第 2 步会在 src/domain 实现 Schedule / PersonalClock / PersonalDayResolver，
 * 第 3 步再把 Civil Time / Personal Time 渲染到这里。
 */
function App() {
  return (
    <main className="app">
      <header>
        <h1>NightCat</h1>
        <p className="subtitle">夜猫子神器 · V0 骨架</p>
      </header>

      <blockquote>{PHILOSOPHY}</blockquote>

      <section>
        <h2>当前状态</h2>
        <ul>
          <li className="done">工程基线：React + TypeScript + Vite</li>
          <li className="todo">领域模型：Personal Time / Personal Day</li>
          <li className="todo">SolarProvider：日出日落与剩余自然光</li>
          <li className="todo">IndexedDB：作息与位置持久化</li>
          <li className="todo">AdviceEngine：最小规则建议</li>
        </ul>
      </section>

      <footer>
        <code>v0.0.0</code>
        <span>数据全部留在本地，不上传。</span>
      </footer>
    </main>
  )
}

export default App
