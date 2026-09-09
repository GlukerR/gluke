/* Эти хелперы существуют ради одной гарантии: фильтр по локали нельзя
 * забыть. Обе языковые версии кейса лежат в одном индексе коллекции, и
 * запрос без `locale` вернул бы вперемешку русские и английские документы —
 * на странице это выглядело бы как случайно подменившийся язык.
 *
 * Проверяем не «функция что-то вызвала», а состав фильтров: именно он
 * теряется при правках, и именно он тихо ломает выдачу.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { queryLocalizedProject, queryLocalizedProjects, queryLocalizedSite } from './localized-queries'

interface RecordedFilter {
  field: string
  operator: string
  value: unknown
}

interface RecordedQuery {
  collection: string
  filters: RecordedFilter[]
}

const queries: RecordedQuery[] = []

/* Заглушка построителя запросов Nuxt Content: тот же чейнинг `.where()`,
   но вместо обращения к базе — запись того, что запросили. */
function fakeQueryCollection(collection: string) {
  const record: RecordedQuery = { collection, filters: [] }
  queries.push(record)

  const builder = {
    where(field: string, operator: string, value: unknown) {
      record.filters.push({ field, operator, value })
      return builder
    },
  }

  return builder
}

beforeEach(() => {
  queries.length = 0
  ;(globalThis as Record<string, unknown>).queryCollection = fakeQueryCollection
})

afterEach(() => {
  delete (globalThis as Record<string, unknown>).queryCollection
})

function lastQuery(): RecordedQuery {
  const query = queries.at(-1)
  expect(query, 'запрос не был построен').toBeDefined()
  return query!
}

describe('localized-queries', () => {
  it('запрос к site фильтрует по локали', () => {
    queryLocalizedSite('ru')

    expect(lastQuery()).toEqual({
      collection: 'site',
      filters: [{ field: 'locale', operator: '=', value: 'ru' }],
    })
  })

  /* Черновик, попавший в выдачу, — публикация до срока, поэтому status
     проверяется вместе с локалью, а не отдельной заботой вызывающего. */
  it('список кейсов фильтрует и по локали, и по статусу публикации', () => {
    queryLocalizedProjects('en')

    expect(lastQuery()).toEqual({
      collection: 'projects',
      filters: [
        { field: 'locale', operator: '=', value: 'en' },
        { field: 'status', operator: '=', value: 'published' },
      ],
    })
  })

  /* Один кейс — тот же список плюс slug: если бы он строился отдельно,
     фильтры могли бы разойтись со списком. */
  it('одиночный кейс наследует оба фильтра списка и добавляет slug', () => {
    queryLocalizedProject('ru', 'pyramid')

    expect(lastQuery()).toEqual({
      collection: 'projects',
      filters: [
        { field: 'locale', operator: '=', value: 'ru' },
        { field: 'status', operator: '=', value: 'published' },
        { field: 'slug', operator: '=', value: 'pyramid' },
      ],
    })
  })

  it('локаль не подставляется по умолчанию, а берётся из аргумента', () => {
    queryLocalizedProjects('ru')
    queryLocalizedProjects('en')

    const locales = queries.map(query =>
      query.filters.find(filter => filter.field === 'locale')?.value,
    )

    expect(locales).toEqual(['ru', 'en'])
  })
})
