import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const pairs = [
        ['manifest.json', 'dist/manifest.json'],
        ['icons', 'dist/icons'],
        ['sounds', 'dist/sounds'],
        ['src/content/styles/toast.css', 'dist/toast.css']
      ]
      for (const [src, dest] of pairs) {
        if (existsSync(src)) {
          const destDir = dest.includes('/') ? dest.substring(0, dest.lastIndexOf('/')) : '.'
          if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
          cpSync(src, dest, { recursive: true })
        }
      }
      // Generate popup.html with correct script reference
      const html = readFileSync('src/popup/index.html', 'utf-8')
      const built = html.replace(
        '<script type="module" src="/src/popup/main.tsx"></script>',
        '<script type="module" src="popup.js"></script>'
      )
      writeFileSync('dist/popup.html', built)
    }
  }
}

export default defineConfig({
  plugins: [react(), copyStaticAssets()],
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
