import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/* Тесты лежат рядом с кодом (app/ и shared/), поэтому попадают и в `pnpm typecheck`
   (tsconfig.app.json включает всё app/), и в прогон vitest. Раннер запускает
   модули вне Nuxt, поэтому алиасы, которые Nuxt раздаёт приложению, повторяем здесь. */
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      /* Nuxt раздаёт `~` на папку app/; без него любой модуль приложения,
         который импортирует соседа по алиасу, в тестах не резолвится. */
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    /* shared/ раздаётся и приложению, и серверу: выбор языка для первого
       визита живёт именно там, поэтому раннер должен видеть и её. */
    include: ['app/**/*.test.ts', 'shared/**/*.test.ts'],
  },
})
