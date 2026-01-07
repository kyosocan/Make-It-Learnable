import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages 需要设置 base 路径（仓库名）
  // 本地开发时使用 '/'，生产环境使用环境变量或默认值
  base: mode === 'production' ? (process.env.VITE_BASE_PATH || '/plan/') : '/',
  server: {
    proxy: {
      '/api-ai': {
        target: 'http://ai-service.tal.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-ai/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
}))

