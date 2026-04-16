import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/main.tsx'),
        background: resolve(__dirname, 'src/background/serviceWorker.ts'),
        content: resolve(__dirname, 'src/content/toast.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo.name === 'content') return 'content.js'
          return '[name].js'
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'toast.css') return 'toast.css'
          return '[name].[ext]'
        },
        inlineDynamicImports: false
      },
      external: (id) => {
        // Don't externalize anything for content script
        if (id.includes('content')) return false
        return false
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
})
