import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Тесты берут модули интерфейса как есть, поэтому им нужен тот же алиас «@»,
// что и сборке: без него проверить можно только код без единого импорта из src.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  }
})
