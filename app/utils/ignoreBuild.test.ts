/*
 * Пропуск сборки — правило с односторонней ошибкой. Лишняя сборка стоит
 * времени и места, но сайт цел; пропущенная сборка означает, что изменения не
 * уехали вовсе, и заметить это можно только на проде. Поэтому проверяется
 * главное свойство: пропуск возможен, только когда **все** изменённые файлы
 * лежат в явном списке служебных путей, а любой незнакомый путь (например,
 * новая папка исходников) сборку включает.
 *
 * Сам модуль — `scripts/ignore-build.mjs` (он зовёт git, то есть node-код).
 * Здесь проверяется решение по списку путей.
 */
import { describe, expect, it } from 'vitest'
import { decideBuild, isIgnorable, parseArgs } from '../../scripts/ignore-build.mjs'

describe('decideBuild', () => {
  it('пропускает сборку, когда менялись только доки и служебные файлы', () => {
    const decision = decideBuild(['docs/run.md', 'docs/changes-log.md', '.github/workflows/ci.yml', 'README.md'])

    expect(decision.skip).toBe(true)
    expect(decision.blocking).toEqual([])
  })

  it('собирает, если тронут любой исходник', () => {
    const decision = decideBuild(['docs/run.md', 'app/pages/index.vue'])

    expect(decision.skip).toBe(false)
    expect(decision.blocking).toEqual(['app/pages/index.vue'])
  })

  it('собирает на незнакомом пути: новая папка исходников не должна молча пропустить релиз', () => {
    expect(decideBuild(['assets/logo.svg']).skip).toBe(false)
  })

  it('собирает, когда список пуст: сравнивать не с чем', () => {
    expect(decideBuild([]).skip).toBe(false)
  })

  it('считает служебным и сам каталог, и файлы внутри него', () => {
    expect(isIgnorable('docs')).toBe(false)
    expect(isIgnorable('docs/')).toBe(true)
    expect(isIgnorable('docs/changes-log.md')).toBe(true)
    expect(isIgnorable('./docs/run.md')).toBe(true)
  })

  it('не пропускает сборку из-за картинок и контента', () => {
    expect(decideBuild(['public/media/projects/rp-grand/rp-grand-cover.jpg']).skip).toBe(false)
    expect(decideBuild(['content/projects/ru/rp-grand.md']).skip).toBe(false)
  })
})

describe('parseArgs', () => {
  it('без аргументов опирается на коммит предыдущего деплоя', () => {
    const options = parseArgs([])

    expect(options.paths).toBeNull()
    expect(typeof options.since).toBe('string')
  })

  it('принимает сравнение и показ решения по списку путей', () => {
    expect(parseArgs(['--since', 'HEAD~1']).since).toBe('HEAD~1')
    expect(parseArgs(['--paths', 'docs/a.md', 'app/b.vue']).paths).toEqual(['docs/a.md', 'app/b.vue'])
  })

  it('отказывается от незнакомого аргумента', () => {
    expect(() => parseArgs(['--fast'])).toThrow(/неизвестный аргумент/)
  })
})
