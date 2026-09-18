/*
 * Аудит деплоя ловит то, что не даёт ошибки само по себе: расхождение настроек
 * между конфигом и дашбордом, подменённую директиву кэша, разорванное звено
 * пуржа. Цена пропуска — не падение сайта, а незаметная жизнь по другой
 * настройке, поэтому проверяется само сравнение: то, что оно обязано считать
 * расхождением, и то, что расхождением не является.
 *
 * Сам модуль — `scripts/deploy-audit.mjs` (он ходит в API и на домен, то есть
 * node-код). Здесь проверяются части, которые от сети не зависят.
 */
import { describe, expect, it } from 'vitest'
import { directiveGaps, purgeGaps, regionGaps, retentionGaps, servedRegion } from '../../scripts/deploy-audit.mjs'
import { DEFAULT_RETENTION } from '../../scripts/deployment-retention.mjs'
import { MEDIA_CACHE, PAGE_CACHE } from '../../scripts/cache-headers.mjs'

describe('directiveGaps', () => {
  it('не считает расхождением набор, совпадающий целиком', () => {
    expect(directiveGaps(MEDIA_CACHE, MEDIA_CACHE)).toEqual([])
  })

  it('замечает подменённый срок, а не только пропавшую директиву', () => {
    const gaps = directiveGaps(PAGE_CACHE, 'public, max-age=0, s-maxage=0, stale-while-revalidate=86400, stale-if-error=604800')

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain('s-maxage')
    expect(gaps[0]).toContain('60')
  })

  it('замечает пропавшую директиву', () => {
    const gaps = directiveGaps(MEDIA_CACHE, 'public, max-age=3600, s-maxage=604800')

    expect(gaps.map(gap => gap)).toContain('cache-control: stale-while-revalidate — ожидается 604800, а в ответе (директивы нет)')
  })

  it('замечает лишнюю директиву: no-store на картинке — это уже другой набор', () => {
    const gaps = directiveGaps(MEDIA_CACHE, `${MEDIA_CACHE}, no-store`)

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain('лишняя директива no-store')
  })

  it('называет заголовок, в котором нашлось расхождение', () => {
    const gaps = directiveGaps(PAGE_CACHE, 'public, max-age=0, s-maxage=0', { headerName: 'страница · cdn-cache-control' })

    expect(gaps[0]).toContain('страница · cdn-cache-control')
  })
})

describe('regionGaps', () => {
  const declared = ['fra1']

  it('молчит, когда конфиг, дашборд и живой ответ совпадают', () => {
    expect(regionGaps({ declared, projectSetting: 'fra1', live: 'fra1' })).toEqual([])
  })

  it('ловит расхождение с дашбордом — ту самую поломку, которая не видна в поведении', () => {
    const gaps = regionGaps({ declared, projectSetting: 'iad1', live: 'fra1' })

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain('Settings → Functions')
    expect(gaps[0]).toContain('iad1')
  })

  it('ловит расхождение с живым исполнением', () => {
    const gaps = regionGaps({ declared, projectSetting: 'fra1', live: 'iad1' })

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain('живое исполнение')
  })

  it('считает расхождением пустой конфиг: без него функции уйдут в умолчание платформы', () => {
    const gaps = regionGaps({ declared: [], live: 'iad1' })

    expect(gaps.some(gap => gap.includes('`regions` не задан'))).toBe(true)
  })

  it('считает расхождением несколько зон: на бесплатном плане доступна одна', () => {
    const gaps = regionGaps({ declared: ['fra1', 'iad1'] })

    expect(gaps.some(gap => gap.includes('зон 2'))).toBe(true)
  })

  it('ничего не говорит о сторонах, которые не проверялись', () => {
    expect(regionGaps({ declared })).toEqual([])
  })
})

describe('retentionGaps', () => {
  /* Копия политики, а не её повтор: тест должен падать вместе с правкой
     DEFAULT_RETENTION, иначе он перестанет быть проверкой. */
  const byPolicy = { ...DEFAULT_RETENTION }

  it('молчит, когда сроки совпадают с политикой', () => {
    expect(retentionGaps(byPolicy)).toEqual([])
  })

  it('принимает срок в днях: 30 от API и 1m из политики — одно и то же', () => {
    expect(retentionGaps({ ...byPolicy, production: '30' }, { ...DEFAULT_RETENTION, production: '1m' })).toEqual([])
  })

  it('называет категорию, которая держит место', () => {
    const gaps = retentionGaps({ ...byPolicy, production: '30' })

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain('прод')
    expect(gaps[0]).toContain('30')
    expect(gaps[0]).toContain(DEFAULT_RETENTION.production)
  })

  it('считает расхождением незаданный срок', () => {
    const gaps = retentionGaps({ ...byPolicy, errored: '(не задан)' })

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain('упавшие')
  })
})

describe('purgeGaps', () => {
  const wired = {
    script: 'node scripts/purge-image-cache.mjs',
    postdeploy: 'await run("node", ["scripts/purge-image-cache.mjs", "--changed"])',
    workflow: 'VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}',
    scriptFile: true,
  }

  it('молчит, когда все звенья цепочки на месте', () => {
    expect(purgeGaps(wired)).toEqual([])
  })

  it('ловит пропавшую команду', () => {
    expect(purgeGaps({ ...wired, script: 'node scripts/other.mjs' })).toHaveLength(1)
  })

  it('ловит потерянный вызов после деплоя: пурж просто не выполняется', () => {
    const gaps = purgeGaps({ ...wired, postdeploy: 'await run("node", ["scripts/indexnow.mjs"])' })

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain('postdeploy')
  })

  it('ловит шаг CI без токена', () => {
    const gaps = purgeGaps({ ...wired, workflow: 'run: node scripts/postdeploy.mjs' })

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain('VERCEL_TOKEN')
  })

  it('не принимает упоминание токена за выдачу: в шаге остался комментарий, а переменной нет', () => {
    const gaps = purgeGaps({
      ...wired,
      workflow: '# VERCEL_TOKEN нужен только пуржу вариантов картинок\nrun: node scripts/postdeploy.mjs',
    })

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain('VERCEL_TOKEN')
  })

  it('принимает переменную, объявленную в шаге', () => {
    expect(purgeGaps({ ...wired, workflow: 'env:\n  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}' })).toEqual([])
  })

  it('ловит ссылку на несуществующий файл', () => {
    const gaps = purgeGaps({ ...wired, scriptFile: false })

    expect(gaps.some(gap => gap.includes('отсутствует'))).toBe(true)
  })
})

describe('servedRegion', () => {
  const withHeader = (value: string) => new Response('', { headers: value ? { 'x-vercel-id': value } : {} })

  it('берёт зону функции из второй части заголовка', () => {
    expect(servedRegion(withHeader('lhr1::fra1::abc-123'))).toBe('fra1')
  })

  it('молчит про статику и вариант картинки: там зона не участвует', () => {
    expect(servedRegion(withHeader('lhr1::abc-123'))).toBe('')
  })

  it('не падает без заголовка', () => {
    expect(servedRegion(withHeader(''))).toBe('')
  })
})
