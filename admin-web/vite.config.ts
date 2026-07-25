import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// 抑制 Rolldown 对第三方包的 /* #__PURE__ */ 警告
function suppressPureAnnotationWarning(): Plugin {
  return {
    name: 'suppress-pure-annotation-warning',
    buildStart() {
      const orig = console.warn
      console.warn = (...args: unknown[]) => {
        const msg = String(args[0] || '')
        if (msg.includes('INVALID_ANNOTATION') || msg.includes('comment ignored')) return
        orig(...args)
      }
    }
  }
}

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })]
    }),
    suppressPureAnnotationWarning()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5178,
    strictPort: true
  },
  build: {
    sourcemap: false,
    cssMinify: false,
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/element-plus')) return 'element-plus'
          if (id.includes('node_modules/@element-plus')) return 'element-icons'
          if (id.includes('node_modules/@cloudbase')) return 'cloudbase-sdk'
          if (id.includes('node_modules/vue') || id.includes('node_modules/pinia') || id.includes('node_modules/vue-router')) return 'vue-vendor'
        }
      }
    }
  }
})
