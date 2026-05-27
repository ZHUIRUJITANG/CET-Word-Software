import { resolve, join } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// Custom plugin to copy sql.js WASM file
function copySqlJsWasm() {
  return {
    name: 'copy-sql-js-wasm',
    closeBundle() {
      const wasmSource = join(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm')
      const wasmDest = join(__dirname, 'out/main/sql-wasm.wasm')
      if (existsSync(wasmSource)) {
        if (!existsSync(join(__dirname, 'out/main'))) {
          mkdirSync(join(__dirname, 'out/main'), { recursive: true })
        }
        copyFileSync(wasmSource, wasmDest)
        console.log('Copied sql-wasm.wasm to out/main/')
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copySqlJsWasm()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [vue()],
    server: {
      host: 'localhost',
      port: 15173
    }
  }
})
