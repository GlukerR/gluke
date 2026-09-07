import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/* Тесты лежат рядом с кодом внутри app/, поэтому попадают и в `pnpm typecheck`
   (tsconfig.app.json включает всё app/), и в прогон vitest. Раннер запускает
   модули вне Nuxt, поэтому алиасы, которые Nuxt раздаёт приложению, повторяем здесь. */
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
  },
})
