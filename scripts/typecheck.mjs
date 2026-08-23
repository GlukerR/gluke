/**
 * Typecheck в изолированном build-каталоге.
 *
 * Штатный `nuxt typecheck` генерирует типы и контент-шаблоны в `.nuxt` —
 * в тот же каталог, который использует работающий dev-сервер. При этом
 * `@nuxt/content` во время prepare не пересобирает дамп контента, поэтому
 * манифест/дамп в `.nuxt` перезаписываются пустыми. Dev-сервер подхватывает
 * их по hot-reload, integrity-check роняет таблицу `_content_site`, а
 * переимпорт падает на пустом дампе — страницы начинают отдавать 500.
 *
 * Здесь типы и шаблоны пишутся в `.nuxt-typecheck`, а vue-tsc проверяет
 * проект по `tsconfig.typecheck.json`, ссылающемуся на этот каталог.
 * Работающий dev-сервер и его `.data/content/contents.sqlite` не затрагиваются.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { buildNuxt, loadNuxt, writeTypes } from 'nuxt/kit'

const rootDir = process.cwd()
const buildDir = '.nuxt-typecheck'
const require = createRequire(`${rootDir}/package.json`)

const nuxt = await loadNuxt({
  cwd: rootDir,
  overrides: {
    /* Только генерация типов — без полноценной сборки и без пересборки контента. */
    _prepare: true,
    buildDir,
  },
})

await writeTypes(nuxt)
await buildNuxt(nuxt)
await nuxt.close()

const vueTscBin = require.resolve('vue-tsc/bin/vue-tsc.js')
const result = spawnSync(
  process.execPath,
  [vueTscBin, '-b', '--noEmit', 'tsconfig.typecheck.json'],
  { cwd: rootDir, stdio: 'inherit' },
)

process.exit(result.status ?? 1)
