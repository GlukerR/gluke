import { describe, expect, it } from 'vitest'
import type { DemoWidgetInstance } from './demoWidgetCache'
import { demoWidgetKey, getDemoWidget, setDemoWidget } from './demoWidgetCache'

/* Фейковый виджет: destroy() пишется в массив `destroyed`, чтобы проверить,
   что вытесненный инстанс освобождается, а перецепляемые — нет. */
function fakeWidget(): DemoWidgetInstance & { destroyed: boolean } {
  const widget = {
    destroyed: false,
    detach() { return this },
    reattach() { return this },
    destroy() {
      this.destroyed = true
    },
  }
  return widget
}

describe('demoWidgetCache', () => {
  it('ключ стабилен по типу виджета и варианту размещения', () => {
    expect(demoWidgetKey('pyramid', 'hero')).toBe('pyramid:hero')
    expect(demoWidgetKey('pyramid', 'tunable')).toBe('pyramid:tunable')
    expect(demoWidgetKey('constellation', 'bleed')).toBe('constellation:bleed')
  })

  it('отдаёт сохранённый инстанс и не трогает его destroy()', () => {
    const widget = fakeWidget()

    setDemoWidget('pyramid:hero', widget)

    expect(getDemoWidget<typeof widget>('pyramid:hero')).toBe(widget)
    expect(widget.destroyed).toBe(false)
  })

  it('вытесняет самый давний инстанс при превышении лимита и освобождает его', () => {
    const first = fakeWidget()
    const second = fakeWidget()
    const third = fakeWidget()
    const fourth = fakeWidget()
    const fifth = fakeWidget()

    setDemoWidget('a', first)
    setDemoWidget('b', second)
    setDemoWidget('c', third)
    setDemoWidget('d', fourth)
    setDemoWidget('e', fifth)

    expect(getDemoWidget('a')).toBeUndefined()
    expect(first.destroyed).toBe(true)
    /* Пережившие лимит остаются целыми. */
    expect(second.destroyed).toBe(false)
    expect(getDemoWidget('e')).toBe(fifth)
  })

  it('get обновляет позицию в LRU: вытесняется давно не использованный, а не самый старый по добавлению', () => {
    const first = fakeWidget()
    const second = fakeWidget()
    const third = fakeWidget()
    const fourth = fakeWidget()
    const fifth = fakeWidget()

    setDemoWidget('a', first)
    setDemoWidget('b', second)
    setDemoWidget('c', third)
    /* Обращение к `a` делает её самой свежей — теперь старейший это `b`. */
    getDemoWidget('a')
    setDemoWidget('d', fourth)
    setDemoWidget('e', fifth)

    expect(getDemoWidget('b')).toBeUndefined()
    expect(second.destroyed).toBe(true)
    expect(getDemoWidget('a')).toBe(first)
  })

  it('перезапись существующего ключа не увеличивает размер кэша', () => {
    const first = fakeWidget()
    const second = fakeWidget()
    const replacement = fakeWidget()

    setDemoWidget('a', first)
    setDemoWidget('b', second)
    setDemoWidget('a', replacement)

    /* Порядок по свежести: [b, a] (a перезаписан последним). При лимите 4
       пятая запись вытесняет старейшего — `b`. */
    setDemoWidget('c', fakeWidget())
    setDemoWidget('d', fakeWidget())
    setDemoWidget('e', fakeWidget())

    expect(getDemoWidget('b')).toBeUndefined()
    expect(second.destroyed).toBe(true)
    expect(getDemoWidget('a')).toBe(replacement)
    expect(first.destroyed).toBe(false)
  })

  it('get по отсутствующему ключу возвращает undefined', () => {
    expect(getDemoWidget('pyramid:hero')).toBeUndefined()
  })
})
