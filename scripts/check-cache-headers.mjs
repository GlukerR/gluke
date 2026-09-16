/**
 * Проверка кэша на собранном сервере: кэшируются ли страницы, закрыт ли корень
 * и работает ли версия картинки в адресе варианта `/_ipx/**`.
 *
 * Почему отдельным скриптом, а не юнит-тестом. Кэш страниц и версия картинки
 * живут не в коде приложения, а в заголовках ответа и в разборе адреса ipx.
 * Юнит-тест проверит только то, что мы сами написали в конфиге; здесь же
 * запрашивается настоящий ответ настоящей сборки — то, что увидит CDN.
 *
 * Поводы для проверки конкретные. Потерянный `routeRules` не ломает страницу:
 * она просто снова считается на каждый заход, и симптом «сайт не грузится»
 * возвращается тихо (`docs/changes-log.md` §69). Закрытый `no-store` у корня
 * наоборот обязателен: корень персонализирован (язык выбирается по cookie и
 * стране), и общий кэш отдал бы русскому гостю английскую страницу. А версия в
 * адресе ipx держится на том, что ipx игнорирует незнакомый модификатор — это
 * поведение чужой библиотеки, и если оно изменится, узнать об этом нужно
 * проверкой, а не жалобой клиента.
 *
 * Использование:
 *
 *   pnpm build && pnpm check:cache
 *
 * Входит в `pnpm check` сразу после сборки.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { collectImageVersions } from './media-versions.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverEntry = join(root, '.output', 'server', 'index.mjs')

/** Сколько ждать первый ответ сервера: холодный старт Nitro на Windows небыстрый. */
const START_TIMEOUT_MS = 60_000
/** Окно свежести страниц из `nuxt.config.ts`. Проверяется, что оно вообще есть. */
const PAGE_FRESHNESS = 's-maxage=60'

const failures = []

function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer()

    probe.once('error', rejectPort)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolvePort(port))
    })
  })
}

function sleep(ms) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, ms))
}

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${name}`)
    return
  }

  failures.push(`${name}: ${detail}`)
  console.log(`  ✗ ${name} — ${detail}`)
}

/** Один заголовок ответа без учёта регистра: имена приходят в разном виде. */
function header(response, name) {
  return response.headers.get(name) ?? ''
}

/** Ждём, пока сервер начнёт отвечать: порт занят задолго до готовности Nitro. */
async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + START_TIMEOUT_MS
  let lastError = 'сервер не ответил'

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`сервер завершился с кодом ${child.exitCode}`)
    }

    try {
      const response = await fetch(`${baseUrl}/robots.txt`)

      if (response.ok) {
        return
      }

      lastError = `robots.txt ответил ${response.status}`
    }
    catch (error) {
      lastError = error.message
    }

    await sleep(500)
  }

  throw new Error(`сервер не поднялся за ${START_TIMEOUT_MS / 1000} с: ${lastError}`)
}

async function main() {
  if (!existsSync(serverEntry)) {
    console.error('[check:cache] нет собранного сервера: .output/server/index.mjs')
    console.error('[check:cache] сначала соберите проект — pnpm build')
    process.exit(1)
  }

  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  /* Те же переменные, с которыми поднимается превью-сервер (docs/run.md):
     прод-сборка должна отвечать как прод, а не как dev. */
  const child = spawn(process.execPath, [serverEntry], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      NUXT_SITE_ENV: 'production',
      NUXT_SITE_URL: baseUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let serverLog = ''
  child.stdout.on('data', (chunk) => {
    serverLog += chunk
  })
  child.stderr.on('data', (chunk) => {
    serverLog += chunk
  })

  try {
    await waitForServer(baseUrl, child)

    console.log(`[check:cache] сервер поднят на ${baseUrl}`)

    /* 1. Страница кэшируется на CDN, но не в браузере: `max-age=0` оставляет
       перепроверку, а `s-maxage` с запасом отдаёт копию из ближайшего PoP. */
    const page = await fetch(`${baseUrl}/ru/projects/rp-grand`)
    const pageCache = header(page, 'cache-control')

    console.log('[check:cache] страница кейса:')
    check('отвечает 200', page.status === 200, `статус ${page.status}`)
    check('окно свежести на CDN', pageCache.includes(PAGE_FRESHNESS), `cache-control: ${pageCache}`)
    check('есть запас на пересборку', pageCache.includes('stale-while-revalidate'), `cache-control: ${pageCache}`)
    check('есть запас на отказ зоны', pageCache.includes('stale-if-error'), `cache-control: ${pageCache}`)

    /* Заголовки можно настроить, а модификатор в разметку не добавить — тогда
       кэш будет длинным, а картинка так и останется прежней после замены файла.
       Глубже, чем наличие версии в адресах каталога, лезть незачем: форму
       адреса проверяет юнит-тест. */
    const catalog = await fetch(`${baseUrl}/ru/projects`)
    const catalogHtml = await catalog.text()
    const sample = catalogHtml.match(/\/_ipx\/[^"'\s]*/)?.[0]

    console.log('[check:cache] каталог проектов:')
    check('отвечает 200', catalog.status === 200, `статус ${catalog.status}`)
    check(
      'версия картинки доходит до разметки',
      /\/_ipx\/[^"'\s]*v_[0-9a-f]{8}/.test(catalogHtml),
      `в HTML нет адреса варианта с версией; пример адреса: ${sample ?? '(адресов ipx нет вовсе)'}`,
    )

    /* 2. Корень персонализирован: общий кэш запрещён, а `Vary` перечисляет
       заголовки, по которым выбор языка принимается. */
    const root_ = await fetch(`${baseUrl}/`, { redirect: 'manual' })
    const rootCache = header(root_, 'cache-control')
    const rootVary = header(root_, 'vary')

    console.log('[check:cache] корень:')
    check('не кэшируется общим кэшем', rootCache.includes('no-store') && rootCache.includes('private'), `cache-control: ${rootCache}`)
    check('перечисляет Vary', /cookie/i.test(rootVary), `vary: ${rootVary || '(нет)'}`)

    /* 3. Картинки берут версию из карты отпечатков — берём настоящую пару
       «адрес + отпечаток», чтобы адрес совпадал с тем, что уходит на страницу. */
    const [src, version] = Object.entries(collectImageVersions())[0] ?? []

    console.log('[check:cache] версия картинки в адресе ipx:')

    if (!src || !version) {
      check('карта отпечатков не пуста', false, 'collectImageVersions() вернул пустую карту')
    }
    else {
      const versioned = await fetch(`${baseUrl}/_ipx/f_jpeg&s_640x360&v_${version}${src}`)
      const contentType = header(versioned, 'content-type')

      check(`ipx принимает версию (${src})`, versioned.status === 200, `статус ${versioned.status}`)
      check('картинка отдаётся картинкой', contentType.startsWith('image/'), `content-type: ${contentType || '(нет)'}`)

      const plain = await fetch(`${baseUrl}/_ipx/f_jpeg&s_640x360${src}`)
      check('без версии адрес по-прежнему работает', plain.status === 200, `статус ${plain.status}`)

      const imageCache = header(versioned, 'cache-control')
      check('вариант картинки кэшируется надолго', imageCache.includes('s-maxage='), `cache-control: ${imageCache}`)
    }
  }
  catch (error) {
    failures.push(error.message)
    console.error(`[check:cache] ${error.message}`)

    if (serverLog.trim()) {
      console.error('[check:cache] вывод сервера:')
      console.error(serverLog.trim().split('\n').slice(-20).join('\n'))
    }
  }
  finally {
    child.kill()
  }

  if (failures.length) {
    console.error(`\n[check:cache] не прошло проверок: ${failures.length}\n`)
    for (const failure of failures) {
      console.error(`  ${failure}`)
    }
    process.exit(1)
  }

  console.log('\n[check:cache] кэш страниц, закрытый корень и версия картинок — на месте')
}

await main()
