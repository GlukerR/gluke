import { describe, expect, it } from 'vitest'
import { collectLinks, createLinkStore } from './constellation.js'

interface Star { x: number, y: number }

/* Детерминированный генератор: тест не должен зависеть от удачи. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function field(n: number, w: number, h: number, seed: number): Star[] {
  const rand = rng(seed)
  /* Часть звёзд — за краем, как после облёта в _step. */
  return Array.from({ length: n }, () => ({ x: rand() * (w + 12) - 6, y: rand() * (h + 12) - 6 }))
}

function wrap(d: number, size: number) {
  const m = d % size
  return m > size / 2 ? m - size : m < -size / 2 ? m + size : m
}

/* Эталон — прежний перебор всех пар с тем же порогом яркости. */
function bruteForce(pts: Star[], w: number, h: number, linkR: number) {
  const out = new Set<string>()
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(wrap(pts[j]!.x - pts[i]!.x, w), wrap(pts[j]!.y - pts[i]!.y, h))
      if (d > linkR) continue
      const t = Math.min(1, Math.max(0, (d / linkR - 0.65) / 0.35))
      if (1 - t * t * (3 - 2 * t) < 0.02) continue
      out.add(`${i}-${j}`)
    }
  }
  return out
}

describe('collectLinks', () => {
  it.each([
    { n: 2000, w: 1600, h: 900, linkR: 52 },
    { n: 550, w: 1200, h: 675, linkR: 70 },
    { n: 120, w: 400, h: 300, linkR: 90 },
    /* Ячеек меньше трёх по стороне — честный перебор. */
    { n: 30, w: 200, h: 150, linkR: 80 },
  ])('находит те же пары, что и перебор: $n звёзд, $w×$h', ({ n, w, h, linkR }) => {
    const pts = field(n, w, h, n + w)
    const store = collectLinks(pts, w, h, linkR, 1, createLinkStore())
    const got = new Set<string>()
    for (let k = 0; k < store.count; k++) {
      const a = store.a[k]!
      const b = store.b[k]!
      got.add(`${Math.min(a, b)}-${Math.max(a, b)}`)
    }
    /* Ни одной пары дважды. */
    expect(got.size).toBe(store.count)
    expect(got).toEqual(bruteForce(pts, w, h, linkR))
  })

  it('связь через шов помечена краем, через который идёт', () => {
    const pts = [{ x: 3, y: 50 }, { x: 395, y: 52 }]
    const store = collectLinks(pts, 400, 300, 40, 1, createLinkStore())
    expect(store.count).toBe(1)
    expect(Math.abs(store.kx[0]!)).toBe(1)
    expect(store.ky[0]).toBe(0)
  })

  it('без видимой яркости нитей не считает ничего', () => {
    const pts = field(500, 800, 600, 7)
    expect(collectLinks(pts, 800, 600, 60, 0.01, createLinkStore()).count).toBe(0)
  })

  it('хранилище переиспользуется между кадрами', () => {
    const store = createLinkStore()
    collectLinks(field(2000, 900, 600, 3), 900, 600, 60, 1, store)
    expect(store.count).toBeGreaterThan(256)
    const grown = store.a
    collectLinks(field(2000, 900, 600, 3), 900, 600, 60, 1, store)
    expect(store.a).toBe(grown)
  })
})
