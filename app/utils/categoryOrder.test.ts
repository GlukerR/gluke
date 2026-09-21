/*
 * Порядок подборки профиля — правило, которое легко сломать незаметно: сеткой
 * профиля управляют и `position` (нумерация архива), и порядок `categories`
 * (профиль против кросс-листинга).
 *
 * Сам модуль чист от файловой системы, поэтому здесь проверяется только
 * правило. Соответствие правила реальному контенту (порядок подборки
 * «Интерактив и WebGL» и состав её кейсов) проверяет `pnpm validate:content`:
 * в `app/` нет node-типов, читать файлы проекта отсюда нечем. См.
 * `docs/dev-guide.md` §5.
 */
import { describe, expect, it } from 'vitest'
import { compareWithinCategory, orderCategoryProjects } from './categoryOrder'
import type { CategoryOrderedProject } from './categoryOrder'

interface Case extends CategoryOrderedProject {
  slug: string
}

const project = (slug: string, fields: Partial<CategoryOrderedProject> = {}): Case => ({
  slug,
  categories: ['webgl'],
  position: 1,
  ...fields,
})

describe('orderCategoryProjects', () => {
  it('оставляет только кейсы профиля', () => {
    const projects = [
      project('in', { categories: ['webgl'] }),
      project('out', { categories: ['furniture'] }),
    ]

    expect(orderCategoryProjects(projects, 'webgl').map(p => p.slug)).toEqual(['in'])
  })

  it('явный порядок кейса сильнее номера в архиве', () => {
    const projects = [
      project('late-position', { position: 40, categoryOrder: { webgl: 1 } }),
      project('early-position', { position: 2 }),
    ]

    expect(orderCategoryProjects(projects, 'webgl').map(p => p.slug))
      .toEqual(['late-position', 'early-position'])
  })

  it('явный порядок идёт по возрастанию и не зависит от порядка входа', () => {
    const projects = [
      project('third', { categoryOrder: { webgl: 3 } }),
      project('first', { categoryOrder: { webgl: 1 } }),
      project('second', { categoryOrder: { webgl: 2 } }),
    ]

    expect(orderCategoryProjects(projects, 'webgl').map(p => p.slug))
      .toEqual(['first', 'second', 'third'])
  })

  it('кейс без явного порядка не поднимается выше любого с ним', () => {
    const projects = [
      project('without', { position: 1 }),
      project('with-order', { position: 99, categoryOrder: { webgl: 9 } }),
    ]

    expect(orderCategoryProjects(projects, 'webgl').map(p => p.slug))
      .toEqual(['with-order', 'without'])
    /* Симметричность сравнения: сортировка не должна зависеть от того, каким
       из двух кейсов её позвали. */
    expect(compareWithinCategory(projects[0]!, projects[1]!, 'webgl')).toBeGreaterThan(0)
    expect(compareWithinCategory(projects[1]!, projects[0]!, 'webgl')).toBeLessThan(0)
  })

  it('без явного порядка работает прежнее правило: профиль, потом архив', () => {
    const projects = [
      project('cross-listed-early', { categories: ['orgtech', 'webgl'], position: 1 }),
      project('primary-late', { categories: ['webgl'], position: 30 }),
      project('primary-early', { categories: ['webgl'], position: 2 }),
    ]

    expect(orderCategoryProjects(projects, 'webgl').map(p => p.slug))
      .toEqual(['primary-early', 'primary-late', 'cross-listed-early'])
  })

  it('порядок профиля не зависит от других профилей кейса', () => {
    const projects = [
      project('a', { categories: ['furniture', 'webgl'], position: 5, categoryOrder: { webgl: 2 } }),
      project('b', { categories: ['webgl'], position: 1, categoryOrder: { webgl: 1 } }),
    ]

    expect(orderCategoryProjects(projects, 'webgl').map(p => p.slug)).toEqual(['b', 'a'])
    /* Тот же набор в другом профиле живёт по своим номерам. */
    expect(orderCategoryProjects(projects, 'furniture').map(p => p.slug)).toEqual(['a'])
  })
})

describe('подборка профиля на девяти кейсах', () => {
  it('полностью заданный порядок не зависит ни от архива, ни от порядка входа', () => {
    const order = { 'getic': 1, 'softlogic': 2, 'rp-grand': 3, 'energy-fill': 4, 'pyramid': 5 }
    const slugs = Object.keys(order)
    const projects = slugs.map((slug, index) => project(slug, {
      /* Номер архива намеренно обратный явному порядку: подборка не должна
         зависеть от того, как давно кейс попал на сайт. */
      position: 100 - index,
      categories: slug === 'getic' || slug === 'softlogic' ? ['orgtech', 'webgl'] : ['webgl'],
      categoryOrder: { webgl: order[slug as keyof typeof order] },
    }))

    expect(orderCategoryProjects(projects, 'webgl').map(p => p.slug)).toEqual(slugs)
    expect(orderCategoryProjects([...projects].reverse(), 'webgl').map(p => p.slug)).toEqual(slugs)
  })
})
