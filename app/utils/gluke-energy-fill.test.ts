import { describe, expect, it } from 'vitest'
import GlukeEnergyFill from './gluke-energy-fill.js'

interface BakeResult {
  px: Uint8Array
  grid: number
  centre: [number, number] | null
  entry: [number, number]
  dir: [number, number]
}

interface Baker {
  core: () => { bake: (job: object) => BakeResult, fields: (job: object) => BakeResult | null }
  source: () => string
}

const baker = (GlukeEnergyFill as unknown as { _baker: Baker })._baker

/* Знак — кольцо: у него есть контрформа, и волна прихода обходит её. */
function ring(size: number) {
  const cov = new Float32Array(size * size)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - c, y - c) / size
      cov[y * size + x] = r > 0.18 && r < 0.32 ? 1 : 0
    }
  }
  return cov
}

function job(angle = -30) {
  return { type: 'bake', grid: 128, fieldGrid: 32, sdScale: 128 * 0.05, angle, cov: ring(128), soft: ring(32) }
}

/* Воркер собирается из текста функций. Исполняем тот же текст в чистой
   области видимости: любая ссылка на замыкание модуля упадёт здесь так же,
   как упала бы в воркере. */
function runWorkerSource(message: object) {
  const posted: unknown[] = []
  const factory = new Function('postMessage', `var onmessage;${baker.source()};return onmessage`)
  const onmessage = factory((data: unknown) => posted.push(data)) as (e: { data: object }) => void
  return { send: (data: object) => onmessage({ data }), posted, message }
}

describe('подготовка карт energy-fill', () => {
  it('ядро печёт текстуру размером знакового поля', () => {
    const r = baker.core().bake(job())
    expect(r.grid).toBe(128)
    expect(r.px.length).toBe(128 * 128 * 4)
    expect(r.centre![0]).toBeCloseTo(0.5, 1)
    expect(r.centre![1]).toBeCloseTo(0.5, 1)
    /* Внутри кольца знаковое поле выше середины, в центре — ниже. */
    const inRing = (64 * 128 + 64 + 32) * 4
    const hole = (64 * 128 + 64) * 4
    expect(r.px[inRing]!).toBeGreaterThan(127)
    expect(r.px[hole]!).toBeLessThan(127)
  })

  it('поля под новый угол требуют испечённого знака', () => {
    const core = baker.core()
    expect(core.fields({ angle: 0 })).toBeNull()
    core.bake(job(-30))
    const turned = core.fields({ angle: 150 })!
    expect(turned.px.length).toBe(128 * 128 * 4)
    expect(turned.entry).not.toEqual(core.bake(job(-30)).entry)
  })

  it('текст воркера самодостаточен и считает то же, что ядро на месте', () => {
    const worker = runWorkerSource(job())
    worker.send(job())
    worker.send({ type: 'fields', angle: 150 })
    expect(worker.posted).toHaveLength(2)

    const local = baker.core()
    const baked = local.bake(job())
    const turned = local.fields({ angle: 150 })!
    expect((worker.posted[0] as BakeResult).px).toEqual(baked.px)
    expect((worker.posted[1] as BakeResult).px).toEqual(turned.px)
  })

  it('воркер без испечённого знака отвечает пустым ответом', () => {
    const worker = runWorkerSource({})
    worker.send({ type: 'fields', angle: 0 })
    expect(worker.posted).toEqual([{ empty: true }])
  })
})
