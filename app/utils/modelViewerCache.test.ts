import { describe, expect, it } from 'vitest'
import type { CachedViewer } from './modelViewerCache'
import { ViewerCache } from './modelViewerCache'

/* Фейковый вьювер, повторяющий форму CachedViewer: disposeViewer вызывает
   dispose() по всем ресурсам, каждый вызов пишется в массив `disposed`.
   Реальные THREE-объекты в тестах не нужны — важны порядок и факт освобождения. */
interface FakeViewer {
  disposed: string[]
}

function fakeViewer(): CachedViewer & FakeViewer {
  const disposed: string[] = []

  const material = {
    dispose: () => {
      disposed.push('material')
    },
  }
  const mesh = {
    isMesh: true,
    geometry: { dispose: () => { disposed.push('geometry') } },
    material,
  }

  return {
    controls: { dispose: () => { disposed.push('controls') } },
    scene: {
      traverse: (visit: (object: unknown) => void) => { visit(mesh) },
      environment: { dispose: () => { disposed.push('environment') } },
    },
    renderer: {
      dispose: () => { disposed.push('renderer') },
      forceContextLoss: () => { disposed.push('force-context-loss') },
      domElement: { remove: () => { disposed.push('remove') } },
    },
    disposed,
  } as unknown as CachedViewer & FakeViewer
}

describe('ViewerCache', () => {
  it('вытесняет самый давний вьювер при превышении лимита и освобождает его ресурсы', () => {
    const cache = new ViewerCache()
    const first = fakeViewer()
    const second = fakeViewer()
    const third = fakeViewer()

    cache.set('a', first)
    cache.set('b', second)
    cache.set('c', third)

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(second)
    expect(cache.get('c')).toBe(third)

    /* disposeViewer прошёл по всем ресурсам вытесненного вьювера. */
    expect(first.disposed).toEqual([
      'controls',
      'geometry',
      'material',
      'environment',
      'renderer',
      'force-context-loss',
      'remove',
    ])
    expect(second.disposed).toEqual([])
    expect(third.disposed).toEqual([])
  })

  it('get обновляет позицию в LRU: при лимите вытесняется давно не использованный, а не самый старый по добавлению', () => {
    const cache = new ViewerCache()
    const first = fakeViewer()
    const second = fakeViewer()
    const third = fakeViewer()

    cache.set('a', first)
    cache.set('b', second)
    /* Обращение к `a` делает её самой свежей — теперь старейший это `b`. */
    cache.get('a')
    cache.set('c', third)

    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(first)
    expect(cache.get('c')).toBe(third)
    expect(second.disposed.length).toBeGreaterThan(0)
  })

  it('перезапись существующего ключа не увеличивает размер кэша', () => {
    const cache = new ViewerCache()
    const first = fakeViewer()
    const second = fakeViewer()
    const replacement = fakeViewer()

    cache.set('a', first)
    cache.set('b', second)
    cache.set('a', replacement)

    /* Третья запись вытесняет старейшего по LRU. Внимание: обращаться к get()
       до set('c') нельзя — сам get меняет LRU-порядок. До записи `c` порядок
       был [b, a] (a перезаписан последним), поэтому старейший — `b`. */
    cache.set('c', fakeViewer())

    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(replacement)
    expect(cache.get('c')).toBeDefined()
    expect(second.disposed.length).toBeGreaterThan(0)
  })

  it('get по отсутствующему ключу возвращает undefined', () => {
    const cache = new ViewerCache()

    expect(cache.get('missing')).toBeUndefined()
  })
})
