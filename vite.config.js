import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/healthz': 'http://192.168.5.110:19001',
      '/ugreen': {
        target: 'http://192.168.5.110:18799',
        changeOrigin: true
      },
      '/builtin': {
        target: 'http://192.168.5.110:19001',
        changeOrigin: true
      },
      '/assets': {
        target: 'http://192.168.5.110:19001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/highlight.js/lib')) return 'highlight'
          if (id.includes('node_modules/highlight.js/styles')) return 'highlight-css'
          if (id.includes('node_modules/codemirror') || id.includes('node_modules/@codemirror')) return 'codemirror'
          if (id.includes('node_modules/marked')) return 'markdown'
          if (id.includes('node_modules/vue')) return 'vendor'
        }
      }
    }
  }
})
