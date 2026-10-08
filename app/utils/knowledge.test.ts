import { describe, expect, it } from 'vitest'
import { bodyText, groupByLetter, groupBySection, readingMinutes } from './knowledge'

describe('knowledge', () => {
  it('собирает текст по всему дереву, включая вложенную разметку', () => {
    const body = [
      ['h2', {}, 'Заголовок'],
      ['p', {}, 'Абзац со ', ['a', { href: '/x' }, 'ссылкой'], '.'],
    ]

    expect(bodyText(body).split(/\s+/).filter(Boolean)).toEqual(['Заголовок', 'Абзац', 'со', 'ссылкой', '.'])
  })

  it('время чтения — минимум минута, схемы добавляют по полминуты', () => {
    expect(readingMinutes([['p', {}, 'коротко']])).toBe(1)

    const words = Array.from({ length: 900 }, () => 'слово').join(' ')
    expect(readingMinutes([['p', {}, words]])).toBe(5)

    const figures = Array.from({ length: 4 }, () => ['kb-figure', { art: 'x' }, ['p', {}, 'подпись']])
    expect(readingMinutes([['p', {}, words], ...figures])).toBe(7)
  })

  it('группирует по разделам в их порядке, сортирует по position и пропускает пустые', () => {
    const groups = groupBySection([
      { slug: 'b', section: 'formats' as const, position: 2 },
      { slug: 'a', section: 'formats' as const, position: 1 },
      { slug: 'c', section: 'preparation' as const, position: 1 },
    ])

    expect(groups.map(group => [group.section, group.articles.map(item => item.slug)])).toEqual([
      ['preparation', ['c']],
      ['formats', ['a', 'b']],
    ])
  })
  it('глоссарий: алфавит языка, группы по первой букве, Ё рядом с Е, не буквы — в «#»', () => {
    const terms = ['Рендер', 'LOD', 'ёмкость', 'Взрыв-схема', 'AR', 'Еж', 'Разрез'].map(term => ({ term }))
    const groups = groupByLetter(terms, 'ru').map(group => [group.letter, group.terms.map(item => item.term)])

    expect(groups).toEqual([
      ['В', ['Взрыв-схема']],
      ['Е', ['Еж']],
      ['Ё', ['ёмкость']],
      ['Р', ['Разрез', 'Рендер']],
      ['A', ['AR']],
      ['L', ['LOD']],
    ])

    expect(groupByLetter([{ term: 'Render' }, { term: '3D viewer' }, { term: 'AR' }], 'en').map(group => group.letter))
      .toEqual(['#', 'A', 'R'])
  })
})
