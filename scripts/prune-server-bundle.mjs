/**
 * Трим бандлов сборки: чужие платформенные бинарники в деплой не едут.
 *
 * Зачем. Прогон трассировки зависимостей кладёт в `node_modules` собранного
 * сервера пакеты целиком, а `better-sqlite3` и `sharp` везут в комплекте
 * бинарники под все платформы, которые им известны. В нашей сборке это восемь
 * prebuilds `better-sqlite3` (linux, linuxmusl, darwin, win32 × x64/arm64) —
 * около 16 МБ, из которых на Vercel нужен один файл. Каждый сохранённый деплой
 * хранит свою копию бандла столько, сколько живёт политика хранения проекта
 * (`scripts/deployment-retention.mjs`), поэтому лишние мегабайты умножаются на
 * число деплоев и считаются в Usage как Functions Storage.
 *
 * Множитель внутри одного деплоя. У пресета Vercel вывод сборки — не один
 * сервер, а каталог функций: `.vercel/output/functions/*.func`, и Nitro
 * раскладывает `node_modules` **в каждую** функцию отдельной копией. В нашей
 * сборке таких функций девять, то есть одни и те же 16 МБ prebuilds лежат в
 * деплое девять раз (измерено: 31,3 МБ на функцию, 250 МБ на все функции при
 * 300 МБ статики). Поэтому трим обязан обходить и `.output/server`, и каждую
 * функцию; починка одного сервера оставляла бы основную часть мусора.
 *
 * Что считается чужим. Целевая платформа берётся из окружения сборки: сборка и
 * исполнение на Vercel идут на linux-x64, локальная прод-сборка запускается на
 * машине разработчика. Правило «оставить бинарники текущей платформы» работает
 * в обоих случаях без переменных окружения: на linux остаётся `linux-x64.node`,
 * на Windows — `win32-x64.node`.
 *
 * На linux намеренно остаётся и musl-вариант: Vercel исполняет функции на glibc,
 * но если окружение когда-нибудь сменится, цена ошибки — неработающая база
 * контента на каждой странице, а цена подстраховки — два мегабайта. Незнакомые
 * имена не удаляются: правило трогает только те, что точно описывают другую
 * платформу.
 *
 * Использование:
 *
 *   node scripts/prune-server-bundle.mjs               # почистить вывод сборки
 *   node scripts/prune-server-bundle.mjs --dry-run     # показать, что удалилось бы
 *   node scripts/prune-server-bundle.mjs --verbose      # перечислить файлы
 *   node scripts/prune-server-bundle.mjs --dir .output/server
 *
 * Вызывается автоматически из `scripts/nuxt-run.mjs` после успешной сборки.
 */
import { existsSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** Где сборка держит бандлы: сервер Nitro и функции вывода Vercel. */
const DEFAULT_SERVER_DIR = join('.output', 'server')
const DEFAULT_FUNCTIONS_DIR = join('.vercel', 'output', 'functions')

/**
 * Имена `prebuilds`, которые нужны текущей платформе.
 *
 * @param {string} platform
 * @param {string} arch
 * @returns {string[]}
 */
export function keepPrebuildNames(platform, arch) {
  const names = [`${platform}-${arch}.node`]

  if (platform === 'linux') {
    names.push(`linuxmusl-${arch}.node`)
  }

  return names
}

/**
 * Имена каталогов `@img/*`, которые нужны текущей платформе.
 *
 * @param {string} platform
 * @param {string} arch
 * @returns {string[]}
 */
export function keepImgNames(platform, arch) {
  const names = [`-${platform}-${arch}`]

  if (platform === 'linux') {
    names.push(`-linuxmusl-${arch}`)
  }

  return names
}

/**
 * Чужой ли файл prebuild: удаляем только те имена, которые точно описывают
 * другую платформу, а незнакомые оставляем на месте.
 *
 * @param {string} name
 * @param {{ platform: string, arch: string }} target
 * @returns {boolean}
 */
export function isForeignPrebuild(name, target) {
  return name.endsWith('.node') && !keepPrebuildNames(target.platform, target.arch).includes(name)
}

/**
 * Чужой ли каталог `@img/*`. Правило трогает только имена вида
 * `sharp-<platform>-<arch>`: незнакомое имя (например, `sharp-wasm32`) — это
 * неизвестная сущность, а не другая платформа, и оно остаётся.
 *
 * @param {string} name
 * @param {{ platform: string, arch: string }} target
 * @returns {boolean}
 */
export function isForeignImgDir(name, target) {
  if (!/^sharp-(linuxmusl|linux|darwin|win32)-[a-z0-9]+$/.test(name)) {
    return false
  }

  return !keepImgNames(target.platform, target.arch).some(suffix => name.endsWith(suffix))
}

/**
 * Размер каталога рекурсивно: нужен для отчёта и проверки выигрыша.
 *
 * @param {string} path
 * @returns {number}
 */
export function directorySize(path) {
  let total = 0

  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name)

    if (entry.isDirectory()) {
      total += directorySize(child)
    }
    else if (entry.isFile()) {
      try {
        total += statSync(child).size
      }
      catch {
        // Файл исчез между чтением и измерением — на результат это не влияет.
      }
    }
  }

  return total
}

/**
 * Все `node_modules` внутри вывода сборки: сервер Nitro и каждая функция
 * пресета Vercel (в них лежат отдельные копии одних и тех же пакетов).
 *
 * @param {{ serverDir?: string, functionsDir?: string }} [options]
 * @returns {string[]}
 */
export function bundleNodeModulesDirs(options = {}) {
  const dirs = []
  /* Один и тот же каталог может прийти по нескольким путям: пресет Vercel
     оставляет одну настоящую функцию и ссылается на неё из остальных
     (`index.func` → `__fallback.func`). Без этой развязки один и тот же файл
     считался бы столько раз, сколько функций (и удалялся бы столько же раз). */
  const seen = new Set()

  const add = (modules) => {
    if (!existsSync(modules)) {
      return
    }

    let real = modules

    try {
      real = realpathSync(modules)
    }
    catch {
      // Разрешить путь не удалось — работаем с тем, что дали.
    }

    if (seen.has(real)) {
      return
    }

    seen.add(real)
    dirs.push(modules)
  }

  add(join(options.serverDir ?? DEFAULT_SERVER_DIR, 'node_modules'))

  const functionsDir = options.functionsDir ?? DEFAULT_FUNCTIONS_DIR

  try {
    for (const entry of readdirSync(functionsDir, { withFileTypes: true })) {
      add(join(functionsDir, entry.name, 'node_modules'))
    }
  }
  catch {
    // Вывода пресета Vercel нет — обычная локальная сборка.
  }

  return dirs
}

/**
 * Список лишних платформенных файлов и каталогов внутри одного бандла.
 *
 * @param {string} nodeModules каталог `node_modules` собранного бандла
 * @param {{ platform?: string, arch?: string }} [target]
 * @returns {string[]}
 */
export function foreignPlatformPaths(nodeModules, target = {}) {
  const platform = target.platform ?? process.platform
  const arch = target.arch ?? process.arch
  const found = []

  const prebuilds = join(nodeModules, 'better-sqlite3', 'prebuilds')

  try {
    for (const entry of readdirSync(prebuilds)) {
      if (isForeignPrebuild(entry, { platform, arch })) {
        found.push(join(prebuilds, entry))
      }
    }
  }
  catch {
    // Пакета или каталога нет — чистить нечего.
  }

  const img = join(nodeModules, '@img')

  try {
    for (const entry of readdirSync(img, { withFileTypes: true })) {
      if (entry.isDirectory() && isForeignImgDir(entry.name, { platform, arch })) {
        found.push(join(img, entry.name))
      }
    }
  }
  catch {
    // Каталога `@img` нет — например, сборка без sharp.
  }

  return found
}

/**
 * Почистить вывод сборки: удалить платформенные файлы чужих систем.
 *
 * @param {{
 *   serverDir?: string,
 *   functionsDir?: string,
 *   dirs?: string[],
 *   platform?: string,
 *   arch?: string,
 *   dryRun?: boolean,
 * }} [options]
 * @returns {{
 *   removed: { path: string, bytes: number }[],
 *   byDir: { dir: string, removed: number, bytes: number }[],
 *   freedBytes: number,
 *   kept: string[],
 *   dirs: string[],
 * }}
 */
export function pruneServerBundle(options = {}) {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const dirs = options.dirs ?? bundleNodeModulesDirs(options)
  const removed = []
  const byDir = []

  for (const dir of dirs) {
    let dirBytes = 0
    let dirRemoved = 0

    for (const path of foreignPlatformPaths(dir, { platform, arch })) {
      let bytes = 0

      try {
        const stats = statSync(path)
        bytes = stats.isDirectory() ? directorySize(path) : stats.size
      }
      catch {
        // Не посчитать размер — не повод не удалить файл.
      }

      if (!options.dryRun) {
        rmSync(path, { recursive: true, force: true })
      }

      removed.push({ path, bytes })
      dirBytes += bytes
      dirRemoved += 1
    }

    if (dirRemoved) {
      byDir.push({ dir, removed: dirRemoved, bytes: dirBytes })
    }
  }

  return {
    removed,
    byDir,
    freedBytes: removed.reduce((sum, item) => sum + item.bytes, 0),
    kept: [`${platform}-${arch}`, ...(platform === 'linux' ? [`linuxmusl-${arch}`] : [])],
    dirs,
  }
}

/**
 * Человекочитаемый вывод прогона: его печатает и CLI, и сборка.
 *
 * @param {ReturnType<typeof pruneServerBundle>} result
 * @param {{ dryRun?: boolean, verbose?: boolean }} [options]
 */
export function report(result, options = {}) {
  const mb = bytes => `${(bytes / 1048576).toFixed(1)} МБ`

  if (!result.dirs.length) {
    console.log('[prune] вывода сборки не нашлось — чистить нечего')
    return
  }

  if (!result.removed.length) {
    console.log(`[prune] в ${result.dirs.length} бандлах чужих платформенных файлов нет (нужны ${result.kept.join(', ')})`)
    return
  }

  for (const item of result.byDir) {
    console.log(`[prune] ${item.dir}: ${item.removed} файлов, ${mb(item.bytes)}`)
  }

  if (options.verbose) {
    for (const item of result.removed) {
      console.log(`  − ${mb(item.bytes).padStart(8)}  ${item.path}`)
    }
  }

  console.log(
    `[prune] ${options.dryRun ? 'удалилось бы' : 'удалено'} всего: ${result.removed.length} файлов, ${mb(result.freedBytes)}`
    + ` — оставлены бинарники ${result.kept.join(', ')}`,
  )
}

/** Разбор аргументов командной строки. */
export function parseArgs(argv) {
  const options = {
    serverDir: DEFAULT_SERVER_DIR,
    functionsDir: DEFAULT_FUNCTIONS_DIR,
    dryRun: false,
    verbose: false,
    platform: process.platform,
    arch: process.arch,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--dry-run') {
      options.dryRun = true
    }
    else if (arg === '--verbose') {
      options.verbose = true
    }
    else if (arg === '--dir') {
      options.serverDir = argv[index + 1] ?? options.serverDir
      index += 1
    }
    else if (arg === '--functions') {
      options.functionsDir = argv[index + 1] ?? options.functionsDir
      index += 1
    }
    else if (arg === '--platform') {
      options.platform = argv[index + 1] ?? options.platform
      index += 1
    }
    else if (arg === '--arch') {
      options.arch = argv[index + 1] ?? options.arch
      index += 1
    }
    else {
      throw new Error(`неизвестный аргумент «${arg}»`)
    }
  }

  return options
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2))
  const result = pruneServerBundle(options)

  report(result, { dryRun: options.dryRun, verbose: options.verbose })
}

export { DEFAULT_FUNCTIONS_DIR, DEFAULT_SERVER_DIR }
