import { describe, expect, it } from 'vitest'
import type { GalleryRow, ProjectMedia } from './gallery-layout'
import { layoutGallery } from './gallery-layout'

interface MediaOptions {
  width?: number
  height?: number
  kind?: 'image' | 'video'
  wide?: boolean
  quad?: boolean
  triple?: boolean
  solo?: boolean
}

function m(src: string, options: MediaOptions = {}): ProjectMedia {
  return {
    src,
    kind: options.kind ?? 'image',
    width: options.width ?? 1000,
    height: options.height ?? 1000,
    wide: options.wide,
    quad: options.quad,
    triple: options.triple,
    solo: options.solo,
  } as unknown as ProjectMedia
}

const square = (src: string) => m(src)
const video = (src: string, ratio: number, options: MediaOptions = {}) => m(src, { kind: 'video', width: Math.round(ratio * 1000), height: 1000, ...options })

/* Индексный доступ без noUncheckedIndexedAccess-шума: тест сам проверяет,
   что строка на месте. */
function rowAt(rows: GalleryRow[], index: number): GalleryRow {
  const row = rows[index]
  if (!row) {
    throw new Error(`Ожидалась строка ${index}, получено строк: ${rows.length}`)
  }
  return row
}

function variants(rows: GalleryRow[]): string[] {
  return rows.map(row => row.variant)
}

function entries(rows: GalleryRow[]): string[][] {
  return rows.map(row => row.entries.map(entry => entry.item.src))
}

describe('layoutGallery (обычный режим)', () => {
  it('пустая галерея — пустой список строк', () => {
    expect(layoutGallery([], false)).toEqual([])
  })

  it('панорамный материал занимает всю ширину', () => {
    const rows = layoutGallery([m('wide', { width: 2000, height: 1000 })], false)

    expect(variants(rows)).toEqual(['wide'])
    expect(entries(rows)).toEqual([['wide']])
  })

  it('первый и последний материалы образуют рамку: квадраты по краям растянуты, середина — пара', () => {
    const rows = layoutGallery([square('a'), square('b'), square('c'), square('d')], false)

    expect(variants(rows)).toEqual(['wide', 'paired', 'wide'])
    expect(entries(rows)).toEqual([['a'], ['b', 'c'], ['d']])
  })

  it('одиночный обычный материал в середине выводится solo-строкой', () => {
    const rows = layoutGallery([square('a'), square('b'), square('c')], false)

    expect(variants(rows)).toEqual(['wide', 'solo', 'wide'])
  })

  it('явный флаг solo выделяет материал в отдельную строку', () => {
    const rows = layoutGallery([square('a'), square('b'), m('c', { solo: true }), square('d')], false)

    expect(entries(rows)).toEqual([['a'], ['b'], ['c'], ['d']])
    expect(rowAt(rows, 2).variant).toBe('solo')
  })

  it('wide: false отменяет принудительное растяжение крайнего материала', () => {
    const rows = layoutGallery([m('a', { wide: false }), square('b')], false)

    expect(variants(rows)).toEqual(['solo', 'wide'])
  })

  it('горизонтальное видео (ratio >= 1.5) растягивается на всю ширину без явного флага', () => {
    const rows = layoutGallery([square('a'), video('b', 1.6), square('c')], false)

    expect(variants(rows)).toEqual(['wide', 'wide', 'wide'])
  })

  it('видео с wide: false не растягивается и встаёт в пару с соседом', () => {
    const rows = layoutGallery([square('a'), video('b', 1.6, { wide: false }), square('c'), square('d')], false)

    expect(variants(rows)).toEqual(['wide', 'paired', 'wide'])
    expect(entries(rows)).toEqual([['a'], ['b', 'c'], ['d']])
  })
})

describe('layoutGallery (quad/triple)', () => {
  it('пять quad-материалов: ряд из четырёх и остаток из одного', () => {
    const rows = layoutGallery([
      m('q1', { quad: true }), m('q2', { quad: true }), m('q3', { quad: true }),
      m('q4', { quad: true }), m('q5', { quad: true }),
    ], false)

    expect(variants(rows)).toEqual(['quad', 'quad'])
    expect(entries(rows)).toEqual([['q1', 'q2', 'q3', 'q4'], ['q5']])
  })

  it('quad-группа разбивается другим типом материала', () => {
    const rows = layoutGallery([
      m('q1', { quad: true }),
      m('q2', { quad: true }),
      square('mid'),
      m('q3', { quad: true }),
      m('q4', { quad: true }),
    ], false)

    expect(entries(rows)).toEqual([['q1', 'q2'], ['mid'], ['q3', 'q4']])
  })

  it('triple-материалы собираются по три', () => {
    const rows = layoutGallery([
      m('t1', { triple: true }), m('t2', { triple: true }), m('t3', { triple: true }), m('t4', { triple: true }),
    ], false)

    expect(variants(rows)).toEqual(['triple', 'triple'])
    expect(entries(rows)).toEqual([['t1', 't2', 't3'], ['t4']])
  })
})

describe('layoutGallery (сеточный режим)', () => {
  it('крайние материалы не растягиваются: квадраты встают парами', () => {
    const rows = layoutGallery([square('a'), square('b'), square('c'), square('d')], true)

    expect(entries(rows)).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('горизонтальное видео без wide не растягивается — пара, а не полная ширина', () => {
    const rows = layoutGallery([video('a', 1.8), video('b', 1.8)], true)

    expect(variants(rows)).toEqual(['paired'])
  })

  it('в сетке ширина только по явному флагу wide', () => {
    const rows = layoutGallery([video('a', 1.8), video('b', 1.8), video('c', 1.8, { wide: true })], true)

    expect(variants(rows)).toEqual(['paired', 'wide'])
    expect(entries(rows)).toEqual([['a', 'b'], ['c']])
  })
})

describe('layoutGallery (solo-строки и compact)', () => {
  it('квадратный solo-материал помечается compact и получает узкие sizes', () => {
    const rows = layoutGallery([square('a'), m('b', { solo: true }), square('c')], false)

    const solo = rowAt(rows, 1)
    expect(solo.variant).toBe('solo')
    expect(solo.compact).toBe(true)
    expect(solo.entries[0]?.sizes).toContain('720')
  })

  it('горизонтальный solo-материал не compact', () => {
    const rows = layoutGallery([m('a', { width: 2000, height: 1000, solo: true })], false)

    const solo = rowAt(rows, 0)
    expect(solo.compact).toBe(false)
    expect(solo.entries[0]?.sizes).toContain('900')
  })

  it('исходный порядок и объекты материалов не меняются', () => {
    const media = [square('a'), square('b'), square('c'), square('d')]
    const rows = layoutGallery(media, false)

    expect(media.map(item => item.src)).toEqual(['a', 'b', 'c', 'd'])
    expect(rowAt(rows, 1).entries[0]?.item).toBe(media[1])
  })
})
