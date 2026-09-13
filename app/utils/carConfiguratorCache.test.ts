import { describe, expect, it } from 'vitest'
import { carPaintHandles, type CachedCarConfigurator } from './carConfiguratorCache'
import type { CarMaterialHandle } from './carMaterials'

/* Хендл материалов в тесте — только опознавательная метка: важна не его
   начинка, а в каком наборе уровней он оказался. */
function handle(id: string): CarMaterialHandle {
  return { id } as unknown as CarMaterialHandle
}

function viewer(materials: CarMaterialHandle, levels: CarMaterialHandle[]) {
  /* Уровень в тесте — только его материалы: корень и ноды в окраске не участвуют,
     но тип карты уровней их требует. */
  const lodModels = new Map(levels.map((level, index) => [
    String(index),
    { materials: level } as unknown as CachedCarConfigurator['lodModels'] extends Map<string, infer M> ? M : never,
  ]))
  return { materials, lodModels }
}

describe('carPaintHandles', () => {
  it('берёт все собранные уровни, а не только видимый', () => {
    /* Окраска накладывается разом на все уровни: видимый LOD1 — это один хендл,
       а колёса в сцене держат материалы LOD0, и без второго в наборе они
       оставались бы в прежней краске. */
    const lod0 = handle('lod0')
    const lod1 = handle('lod1')
    expect(carPaintHandles(viewer(lod1, [lod0, lod1]))).toEqual([lod1, lod0])
  })

  it('не повторяет хендл видимого уровня', () => {
    /* Видимый уровень лежит и в `materials`, и в `lodModels` — в юниформы
       он должен попадать один раз. */
    const only = handle('lod0')
    expect(carPaintHandles(viewer(only, [only]))).toEqual([only])
  })

  it('без собранных уровней хватает видимого', () => {
    const active = handle('lod0')
    expect(carPaintHandles({ materials: active, lodModels: new Map() })).toEqual([active])
  })
})
