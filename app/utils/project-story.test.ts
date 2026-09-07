import type { ProjectsCollectionItem } from '@nuxt/content'
import { describe, expect, it } from 'vitest'
import { splitProjectStory } from './project-story'

/* Фейковый проект: splitProjectStory читает только body.value (MDC-дерево),
   остальные поля типа не важны. */
function project(nodes: unknown[]): ProjectsCollectionItem {
  return { title: 'Case', body: { value: nodes } } as unknown as ProjectsCollectionItem
}

const paragraph = (text: string) => ['p', {}, text]

describe('splitProjectStory', () => {
  it('пустое тело — без затравки и без остатка', () => {
    const source = project([])
    const story = splitProjectStory(source)

    expect(story.lead).toBe('')
    expect(story.hasRest).toBe(false)
    expect(story.rest).toBe(source)
  })

  it('первый абзац становится затравкой, остальные — остатком', () => {
    const story = splitProjectStory(project([paragraph('Ввод'), paragraph('Дальше')]))

    expect(story.lead).toBe('Ввод')
    expect(story.hasRest).toBe(true)
    expect(story.rest.body?.value).toEqual([paragraph('Дальше')])
  })

  it('заголовок секции затравки убирается вместе с ней', () => {
    const nodes = [['h2', {}, 'Задача'], paragraph('Ввод'), paragraph('Продолжение')]
    const story = splitProjectStory(project(nodes))

    expect(story.lead).toBe('Ввод')
    expect(story.rest.body?.value).toEqual([paragraph('Продолжение')])
  })

  it('одиночный абзац без продолжения не оставляет остатка', () => {
    const nodes = [['h2', {}, 'Задача'], paragraph('Ввод')]
    const story = splitProjectStory(project(nodes))

    expect(story.hasRest).toBe(false)
    expect(story.rest.body?.value).toEqual([])
  })

  it('заголовок после затравки не удаляется', () => {
    const nodes = [paragraph('Ввод'), ['h2', {}, 'Детали'], paragraph('Ещё')]
    const story = splitProjectStory(project(nodes))

    expect(story.rest.body?.value).toEqual([['h2', {}, 'Детали'], paragraph('Ещё')])
  })

  it('текст затравки собирается по вложенной разметке и обрезается', () => {
    const nodes = [
      ['p', {}, '  Первая часть ', ['strong', {}, 'текста'], ' — конец.  '],
      paragraph('Остаток'),
    ]
    const story = splitProjectStory(project(nodes))

    expect(story.lead).toBe('Первая часть текста — конец.')
  })

  it('тело без абзацев: затравки нет, остаток сохраняется', () => {
    const nodes = [['h1', {}, 'Только заголовок']]
    const source = project(nodes)
    const story = splitProjectStory(source)

    expect(story.lead).toBe('')
    expect(story.hasRest).toBe(true)
    expect(story.rest).toBe(source)
  })
})
