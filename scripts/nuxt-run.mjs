/**
 * Production build / generate в отдельном build-каталоге.
 *
 * `nuxt build` / `nuxt generate` и `nuxt dev` по умолчанию делят корневой
 * `.nuxt`, и работающий dev-сервер переписывает туда свои dev-шаблоны:
 * например, `@nuxt/icon` генерирует `nuxt-icon-server-bundle.mjs` с
 * `createRequire(import.meta.url)` только в dev-режиме (`isBundling = !dev`).
 * Если прод-сборка подхватывает такой шаблон, nitro заменяет `import.meta.url`
 * на плейсхолдер `"file:///_entry.js"` и prerender падает на Windows
 * (createRequire не принимает этот путь). Отдельный buildDir изолирует сборку
 * от dev-сервера: `pnpm build` / `pnpm generate` работают даже при запущенном
 * dev (и после `rm -rf .nuxt`).
 *
 * Использование: `node scripts/nuxt-run.mjs <build|generate>`
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const command = process.argv[2] ?? 'build'
if (command !== 'build' && command !== 'generate') {
  console.error(`[nuxt-run] unknown command "${command}" (expected "build" or "generate")`)
  process.exit(1)
}

const nuxtBin = resolve('node_modules/nuxt/bin/nuxt.mjs')
const buildDir = process.env.NUXT_BUILD_DIR || '.nuxt-build'

/* Встроенный typecheck (`typescript.typeCheck`) гоняет vue-tsc -b по корневому
   `tsconfig.json`, который ссылается на `.nuxt/tsconfig.*.json`. Если `.nuxt`
   отсутствует (например, после `rm -rf .nuxt`), сначала генерируем его через
   `nuxt prepare` (prepare идёт в корневой `.nuxt`, без переопределения
   buildDir) — иначе typecheck падает с TS5083. Сама сборка при этом идёт
   в `.nuxt-build` и dev-шаблоны не подхватывает. */
if (!existsSync('.nuxt/tsconfig.app.json')) {
  console.log('[nuxt-run] .nuxt is missing — running nuxt prepare first')
  const prepared = spawnSync(process.execPath, [nuxtBin, 'prepare'], { stdio: 'inherit' })
  if (prepared.status !== 0) {
    process.exit(prepared.status ?? 1)
  }
}

const child = spawn(process.execPath, [nuxtBin, command], {
  stdio: 'inherit',
  env: { ...process.env, NUXT_BUILD_DIR: buildDir },
})
child.on('exit', code => process.exit(code ?? 1))
