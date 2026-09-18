/**
 * Проба кэша на живом деплое: `pnpm check:cache:prod`.
 *
 * Зачем отдельно от `check:cache`. Тот скрипт поднимает собранный сервер и
 * смотрит, что отдаёт **наш** код. Эдж-кэш живёт не в коде, а в платформе:
 * Vercel вырезает `s-maxage`, `stale-while-revalidate` и `stale-if-error` из
 * ответа серверной функции, поэтому по локальному ответу нельзя судить, что
 * увидит посетитель. Здесь запрашивается настоящий домен.
 *
 * Что проверяется и почему именно это:
 *
 * 1. Директивы в `cdn-cache-control`. Это единственный заголовок, в котором
 *    задуманный набор доезжает до клиента целым; без него кэш может работать,
 *    но настройка невидима, и поломку не отличить от неё же работающей
 *    (`docs/changes-log.md` §76).
 * 2. Кэш действительно работает. Две пробы с паузой: `x-vercel-cache` должен
 *    ответить `HIT`, `STALE` или `REVALIDATED`, а не дважды `MISS`. Одного
 *    заголовка в ответе мало — важно, что копия из PoP берётся.
 * 3. `/_vercel/image` живёт по набору картинок, а не по страничному. На Vercel
 *    варианты картинок отдаёт платформенный оптимизатор, адрес в HTML другой,
 *    чем у `/_ipx/**`, и без своей строки в `routeRules` он попадал под правило
 *    `/**` с шестьюдесятью секундами.
 * 4. Статика `public/**` идёт по набору `MEDIA_CACHE` — так правило `vercel.json`
 *    для `/media/(.*)` проверяется уже после переезда в `routeRules`.
 * 5. Корень закрыт от общего кэша: он персонализирован по cookie и стране, и
 *    общий кэш отдал бы русскому гостю английскую страницу.
 * 6. Функция исполняется в той зоне, что заявлена в `vercel.json`. Зона есть в
 *    двух местах сразу: `regions` в конфиге и поле проекта
 *    `serverlessFunctionRegion` (Settings → Functions). По умолчанию у нового
 *    проекта там `iad1`, и расхождение не видно ни в сборке, ни в ответе, пока
 *    в конфиг не добавлена сверка: у проекта `gluke` в дашборде стоял `iad1`,
 *    хотя функции исполнялись во `fra1` (`docs/changes-log.md` §79).
 *
 * Адрес берётся из `CACHE_PROBE_URL` (по умолчанию боевой домен), поэтому
 * скрипт годится и для превью-деплоя.
 *
 * Использование:
 *
 *   pnpm check:cache:prod
 *   CACHE_PROBE_URL=https://gluke.vercel.app pnpm check:cache:prod
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'

const baseUrl = (process.env.CACHE_PROBE_URL ?? 'https://gluke.ru').replace(/\/+$/, '')

/** Зона функций из `vercel.json`: то, что мы считаем задуманным. */
const declaredRegion = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')).regions?.[0] ?? ''

/** Пауза между пробами одной страницы: свежий ответ должен успеть лечь в кэш. */
const RECHECK_DELAY_MS = 3000
/** Сколько ждать ответа: домен может быть на прогреве после деплоя. */
const REQUEST_TIMEOUT_MS = 25_000

/** Страница кейса: серверный рендер, то есть ответ функции. */
const PAGE_PATH = '/ru/projects/softlogic'
/** Файл статики: адрес не версионируется, поэтому у него свой срок жизни. */
const MEDIA_PATH = '/media/projects/alphatent/cover.jpg'
/** Адрес варианта картинки ровно в той форме, в какой он уходит в HTML. */
const IMAGE_PATH = `/_vercel/image?url=${encodeURIComponent(MEDIA_PATH)}&w=640&q=75`

const failures = []

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${name}`)
    return
  }

  failures.push(`${name}: ${detail}`)
  console.log(`  ✗ ${name} — ${detail}`)
}

function sleep(ms) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, ms))
}

/** Заголовок ответа без учёта регистра: имена приходят в разном виде. */
function header(response, name) {
  return response.headers.get(name) ?? ''
}

/** Ответ деплоя вместе с телом: часть проверок смотрит и разметку, и заголовки. */
async function probe(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  return { path, response, body: await response.text() }
}

/**
 * Зона, в которой исполнился ответ функции.
 *
 * `x-vercel-id` выглядит как `<зона края>::<зона функции>::<номер>`; у ответа
 * без функции (статика, вариант картинки) второй части нет — там зона не
 * участвует, и это не ошибка, а другой вид ответа.
 *
 * @param {Response} response
 * @returns {{ edge: string, fn: string }}
 */
function servedBy(response) {
  const [edge = '', fn = ''] = header(response, 'x-vercel-id').split('::')
  return { edge: edge.trim(), fn: fn.replace(/-.*$/, '').trim() }
}

/** Кэширует ли Vercel этот ответ: `MISS` на обеих пробах означает, что нет. */
function edgeState(response) {
  return header(response, 'x-vercel-cache').toUpperCase()
}

async function main() {
  console.log(`[check:cache:prod] проба ${baseUrl}`)

  /* 1–2. Страница: директивы в зеркале и работающая копия в PoP. */
  const first = await probe(PAGE_PATH)
  const firstState = edgeState(first.response)
  const pageCdn = header(first.response, 'cdn-cache-control')
  const pageCache = header(first.response, 'cache-control')

  await sleep(RECHECK_DELAY_MS)

  const second = await probe(PAGE_PATH)
  const secondState = edgeState(second.response)
  const cachedAtEdge = [firstState, secondState].some(state => ['HIT', 'STALE', 'REVALIDATED'].includes(state))

  console.log(`[check:cache:prod] страница ${PAGE_PATH}:`)
  check('отвечает 200', first.response.status === 200, `статус ${first.response.status}`)
  check(
    'окно свежести страницы видно в зеркале CDN',
    pageCdn.includes('s-maxage=60'),
    `cdn-cache-control: ${pageCdn || '(нет)'}`,
  )
  check(
    'запас на пересборку и на отказ зоны виден в зеркале CDN',
    pageCdn.includes('stale-while-revalidate') && pageCdn.includes('stale-if-error'),
    `cdn-cache-control: ${pageCdn || '(нет)'}`,
  )
  check(
    'браузер не кэширует разметку',
    pageCache.includes('max-age=0'),
    `cache-control: ${pageCache}`,
  )
  check(
    'копия из кэша CDN действительно берётся',
    cachedAtEdge,
    `x-vercel-cache: ${firstState} → ${secondState} (обе пробы мимо кэша)`,
  )
  check(
    'у снятой копии есть возраст',
    !cachedAtEdge || header(second.response, 'age') !== '' || header(first.response, 'age') !== '',
    'в кэшированном ответе нет заголовка age',
  )

  /* 3. Вариант картинки: свой набор, а не страничные 60 секунд. */
  const image = await probe(IMAGE_PATH)
  const imageCdn = header(image.response, 'cdn-cache-control')

  console.log('[check:cache:prod] вариант картинки /_vercel/image:')
  check('отвечает 200', image.response.status === 200, `статус ${image.response.status}`)
  check('отдаётся картинкой', header(image.response, 'content-type').startsWith('image/'), `content-type: ${header(image.response, 'content-type') || '(нет)'}`)
  check(
    'неделя на CDN вместо страничных 60 секунд',
    imageCdn.includes('s-maxage=604800'),
    `cdn-cache-control: ${imageCdn || '(нет)'}`,
  )

  /* 4. Статика из public/: срок в браузере часовой, на CDN недельный. */
  const media = await probe(MEDIA_PATH)
  const mediaCache = header(media.response, 'cache-control')
  const mediaCdn = header(media.response, 'cdn-cache-control')

  console.log(`[check:cache:prod] статика ${MEDIA_PATH}:`)
  check('отвечает 200', media.response.status === 200, `статус ${media.response.status}`)
  check('час в браузере', mediaCache.includes('max-age=3600'), `cache-control: ${mediaCache}`)
  check('неделя на CDN', mediaCdn.includes('s-maxage=604800'), `cdn-cache-control: ${mediaCdn || '(нет)'}`)

  /* 5. Корень: персонализирован, общий кэш запрещён в обоих заголовках. */
  const root = await probe('/')
  const rootCache = header(root.response, 'cache-control')
  const rootCdn = header(root.response, 'cdn-cache-control')

  console.log('[check:cache:prod] корень:')
  check('закрыт от общего кэша', rootCache.includes('private') && rootCache.includes('no-store'), `cache-control: ${rootCache}`)
  check('запрет продублирован в зеркале CDN', rootCdn.includes('private') && rootCdn.includes('no-store'), `cdn-cache-control: ${rootCdn || '(нет)'}`)
  check('не отдан из общего кэша', !['HIT', 'STALE'].includes(edgeState(root.response)), `x-vercel-cache: ${edgeState(root.response)}`)
  check('разметка пришла', root.body.length > 1000, `тело ответа ${root.body.length} байт`)

  /* 6. Зона функции: сравнение того, что просили в конфиге, с тем, что
     ответил деплой. Запрос со сбивающим кэш параметром, чтобы заголовок
     описывал этот рендер, а не лежащую копию. */
  const fresh = await probe(`${PAGE_PATH}?region-probe=${Date.now()}`)
  const served = servedBy(fresh.response)

  console.log('[check:cache:prod] зона функции:')
  check(
    'в конфиге заявлена одна зона',
    Boolean(declaredRegion),
    `vercel.json: regions=${JSON.stringify(declaredRegion || null)}`,
  )
  check(
    'разметку отрисовала функция, а не статика',
    Boolean(served.fn),
    `x-vercel-id: ${header(fresh.response, 'x-vercel-id') || '(нет)'}`,
  )
  check(
    `функция исполняется в зоне ${declaredRegion || '(не задана)'}`,
    Boolean(served.fn) && served.fn === declaredRegion,
    `x-vercel-id: ${header(fresh.response, 'x-vercel-id') || '(нет)'} — исполнение в ${served.fn || '(неизвестно)'}, а конфиг просит ${declaredRegion || '(ничего)'}`,
  )

  if (failures.length) {
    console.error(`\n[check:cache:prod] не прошло проверок: ${failures.length}\n`)
    for (const failure of failures) {
      console.error(`  ${failure}`)
    }
    process.exit(1)
  }

  console.log('\n[check:cache:prod] директивы доезжают до клиента, эдж-кэш их исполняет, корень закрыт, зона функции совпадает с конфигом')
}

await main()
