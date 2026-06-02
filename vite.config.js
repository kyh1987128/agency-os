import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// 외부(인터넷) 접속용 설정.
// - host: true         → 0.0.0.0 바인딩 (LAN/터널에서 접근 가능)
// - allowedHosts: true → cloudflared *.trycloudflare.com 등 모든 호스트 허용
// - proxy              → /api, /uploads 요청을 백엔드(3001)로 전달.
//   덕분에 프론트는 상대경로(const API = "")만 쓰면 되고, 외부인 브라우저에서도
//   같은 오리진(5173)으로 데이터가 로드된다. SSE(/api/stream)도 프록시 통과.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
