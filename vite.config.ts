import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 必须显式写 127.0.0.1，不能留默认值。
    //
    // 原因：默认情况下 Vite 传 'localhost' 给 Node 监听，而 Node 17+ 不再重排 DNS 结果，
    // macOS 的 getaddrinfo 会把 localhost 解析成 ::1 排在前，于是开发服务器**只绑 IPv6**。
    // 而 /etc/hosts 里 `127.0.0.1 localhost` 也占一行，浏览器可能先试 IPv4 → 连接被拒，
    // 表现为"无法访问此网站"，但命令行 curl 却能通（curl 会回退到 ::1），非常容易误判成
    // "服务没起来"。写死 127.0.0.1 可消除这个歧义。
    //
    // 另外本机开着代理（Clash 类，127.0.0.1:7897），其绕过列表含 127.0.0.1 但不含 ::1，
    // 走 IPv4 也能顺带避开代理这一层的不确定性。
    host: '127.0.0.1',
    port: 5173,
    // 端口被占用时直接报错，而不是悄悄换到 5174——否则地址栏里的 URL 会与预期不符。
    strictPort: true,
  },
})
