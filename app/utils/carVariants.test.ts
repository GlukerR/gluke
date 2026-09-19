import { describe, expect, it } from 'vitest'
import {
  applyVariantSelection,
  buildLodLoadOrder,
  buildNodeMeta,
  buildVariantGroups,
  countRenderStats,
  defaultSelection,
  nodeKey,
  nodeNamesByRole,
  NO_VARIANT,
  type CarLodEntry,
  type CarManifest,
} from './carVariants'

/* Манифест-фикстура: в реальном файле те же поля приходят из экспортёра
   Blender, здесь важны только роли и варианты нод. */
function manifestOf(nodes: Record<string, [role: string, variant: string]>): CarManifest {
  const map: CarManifest['lods']['0']['nodes'] = {}
  for (const [name, [role, variant]] of Object.entries(nodes)) {
    map[name] = { role, variant, tris: 1, pivot: [0, 0, 0], dims: [1, 1, 1] }
  }
  return {
    slug: 'test-car',
    lods: { 0: { file: 'test-car.glb', bytes: 1, tris: 1, nodes: map } },
  }
}

/* Фейковые ноды: важны только видимость, иерархия и треугольники геометрии. */
interface FakeNode {
  isMesh: boolean
  visible: boolean
  parent: FakeNode | null
  material: unknown
  geometry?: { index?: { count: number }, attributes?: { position?: { count: number } } }
  children: FakeNode[]
  traverse: (callback: (object: FakeNode) => void) => void
}

function mesh(triangles: number, visible = true): FakeNode {
  const node: FakeNode = {
    isMesh: true,
    visible,
    parent: null,
    material: {},
    geometry: { index: { count: triangles * 3 } },
    children: [],
    traverse(callback) {
      callback(this)
      for (const child of this.children) child.traverse(callback)
    },
  }
  return node
}

function groupOf(children: FakeNode[]): FakeNode {
  const node: FakeNode = {
    isMesh: false,
    visible: true,
    parent: null,
    material: null,
    children,
    traverse(callback) {
      callback(this)
      for (const child of this.children) child.traverse(callback)
    },
  }
  for (const child of children) child.parent = node
  return node
}

const KIT = manifestOf({
  body: ['body', ''],
  door_l_front: ['door', 'l_front'],
  glass_door_l: ['glass', 'door_l'],
  bumper_front_a: ['bumper_front', 'a'],
  bumper_front_b: ['bumper_front', 'b'],
  bumper_front_c: ['bumper_front', 'c'],
  bumper_rear_a: ['bumper_rear', 'a'],
  bumper_rear_b: ['bumper_rear', 'b'],
  skirt_a: ['skirt', 'a'],
  skirt_b: ['skirt', 'b'],
  skirt_c: ['skirt', 'c'],
})

describe('buildVariantGroups', () => {
  it('собирает группы только из переключаемых ролей', () => {
    const groups = buildVariantGroups(KIT)
    expect(groups.map(group => group.id)).toEqual(['bumper_front', 'bumper_rear', 'skirt'])
    expect(groups[0]?.options).toEqual(['a', 'b', 'c'])
    /* Кузов, двери и стёкла — не варианты, в панель не попадают. */
    expect(groups.some(group => group.id === 'body')).toBe(false)
  })

  it('не показывает группу с единственным вариантом', () => {
    const manifest = manifestOf({
      bumper_front_a: ['bumper_front', 'a'],
      bumper_rear_a: ['bumper_rear', 'a'],
      bumper_rear_b: ['bumper_rear', 'b'],
    })
    expect(buildVariantGroups(manifest).map(group => group.id)).toEqual(['bumper_rear'])
  })

  it('у съёмной детали добавляет пункт «нет» первым', () => {
    const manifest = manifestOf({
      spoiler_a: ['spoiler', 'a'],
      spoiler_b: ['spoiler', 'b'],
    })
    const groups = buildVariantGroups(manifest)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.options).toEqual([NO_VARIANT, 'a', 'b'])
  })

  it('без манифеста панель пустая', () => {
    expect(buildVariantGroups(null)).toEqual([])
  })
})

describe('defaultSelection', () => {
  it('ставит «сток» и снимает съёмные детали', () => {
    const groups = buildVariantGroups(manifestOf({
      skirt_a: ['skirt', 'a'],
      skirt_b: ['skirt', 'b'],
      spoiler_a: ['spoiler', 'a'],
      spoiler_b: ['spoiler', 'b'],
    }))
    expect(defaultSelection(groups)).toEqual({ skirt: 'a', spoiler: NO_VARIANT })
  })

  it('берёт первый вариант, если «стока» в файле нет', () => {
    const groups = buildVariantGroups(manifestOf({
      skirt_b: ['skirt', 'b'],
      skirt_c: ['skirt', 'c'],
    }))
    expect(defaultSelection(groups)).toEqual({ skirt: 'b' })
  })
})

describe('applyVariantSelection', () => {
  it('оставляет видимой только выбранную деталь', () => {
    const nodes = {
      bumper_front_a: mesh(10),
      bumper_front_b: mesh(20),
      bumper_front_c: mesh(30),
      body: mesh(100),
    }
    const nodeByName = new Map<string, FakeNode>(Object.entries(nodes))
    const groups = buildVariantGroups(KIT)
    const selection = { bumper_front: 'b', bumper_rear: 'a', skirt: 'a' }

    applyVariantSelection(
      nodeByName as never,
      buildNodeMeta(KIT),
      groups,
      selection,
    )

    expect(nodes.bumper_front_b.visible).toBe(true)
    expect(nodes.bumper_front_a.visible).toBe(false)
    expect(nodes.bumper_front_c.visible).toBe(false)
    /* Ноды вне групп конфигуратор не трогает. */
    expect(nodes.body.visible).toBe(true)
  })

  it('имена нод манифеста совпадают с именами загрузчика', () => {
    /* Blender пишет дубликаты с точкой (`Wheel.001`), а three вырезает точку
       из имени ноды. Без нормализации такое имя не нашлось бы в модели —
       вариант молча не переключился бы. */
    const manifest = manifestOf({
      'bumper_front_a': ['bumper_front', 'a'],
      'Wheel.001': ['wheel', ''],
      'Side Skirt:1': ['skirt', 'a'],
    })
    const meta = buildNodeMeta(manifest)
    expect([...meta.keys()]).toEqual(['bumper_front_a', 'Wheel001', 'Side_Skirt1'])
    expect(nodeKey('Wheel.001')).toBe('Wheel001')
    expect(nodeKey('Side Skirt:1')).toBe('Side_Skirt1')
    expect(nodeKey('bumper_front_a')).toBe('bumper_front_a')
  })

  it('вариант «нет» гасит все ноды роли', () => {
    const nodes = {
      spoiler_a: mesh(10),
      spoiler_b: mesh(20),
    }
    const manifest = manifestOf({
      spoiler_a: ['spoiler', 'a'],
      spoiler_b: ['spoiler', 'b'],
    })
    applyVariantSelection(
      new Map(Object.entries(nodes)) as never,
      buildNodeMeta(manifest),
      buildVariantGroups(manifest),
      { spoiler: NO_VARIANT },
    )
    expect(nodes.spoiler_a.visible).toBe(false)
    expect(nodes.spoiler_b.visible).toBe(false)
  })
})

describe('nodeNamesByRole', () => {
  it('отдаёт имена нод по роли без варианта', () => {
    const meta = buildNodeMeta(manifestOf({
      'Wheel': ['wheel', ''],
      'Wheel.001': ['wheel', ''],
      'body': ['body', ''],
    }))
    expect(nodeNamesByRole(meta, 'wheel')).toEqual(['Wheel', 'Wheel001'])
    expect(nodeNamesByRole(meta, 'spoiler')).toEqual([])
  })
})

/* Уровни как в манифесте rp-grand: подробный тяжёлый, дальние — почти пустые. */
function lodLevels(): CarLodEntry[] {
  return [
    { id: '0', file: 'test-lod0.glb', tris: 32370 },
    { id: '1', file: 'test-lod1.glb', tris: 4864 },
    { id: '2', file: 'test-lod2.glb', tris: 230 },
  ]
}

describe('buildLodLoadOrder', () => {
  it('ведёт от самого лёгкого уровня к самому подробному', () => {
    expect(buildLodLoadOrder(lodLevels(), '0').map(entry => entry.id)).toEqual(['2', '1', '0'])
  })

  it('не грузит уровни тяжелее выбранного', () => {
    expect(buildLodLoadOrder(lodLevels(), '1').map(entry => entry.id)).toEqual(['2', '1'])
  })

  it('для самого лёгкого уровня цепочка из одного шага', () => {
    expect(buildLodLoadOrder(lodLevels(), '2').map(entry => entry.id)).toEqual(['2'])
  })

  it('сортирует по трисам манифеста, а не по номеру уровня', () => {
    const levels: CarLodEntry[] = [
      { id: '0', file: 'a.glb', tris: 100 },
      { id: '1', file: 'b.glb', tris: 900 },
      { id: '2', file: 'c.glb', tris: 400 },
    ]
    expect(buildLodLoadOrder(levels, '1').map(entry => entry.id)).toEqual(['0', '2', '1'])
  })

  it('незнакомый уровень отдаёт всю цепочку', () => {
    expect(buildLodLoadOrder(lodLevels(), '9').map(entry => entry.id)).toEqual(['2', '1', '0'])
  })

  it('без трисов не теряет ни одного уровня', () => {
    const levels: CarLodEntry[] = [
      { id: '0', file: 'a.glb', tris: 0 },
      { id: '1', file: 'b.glb', tris: 0 },
      { id: '2', file: 'c.glb', tris: 0 },
    ]
    expect(buildLodLoadOrder(levels, '0').map(entry => entry.id)).toEqual(['2', '1', '0'])
  })
})

describe('countRenderStats', () => {
  it('считает трисы и draw calls только по видимым мешам', () => {
    const root = groupOf([mesh(100), mesh(50, false), mesh(25)])
    expect(countRenderStats(root as never)).toEqual({ triangles: 125, drawCalls: 2 })
  })

  it('не считает детей спрятанной группы', () => {
    const kitB = groupOf([mesh(20), mesh(30)])
    kitB.visible = false
    const root = groupOf([mesh(100), kitB])
    expect(countRenderStats(root as never)).toEqual({ triangles: 100, drawCalls: 1 })
  })

  it('считает неиндексированную геометрию по позициям', () => {
    const node = mesh(0)
    node.geometry = { attributes: { position: { count: 36 } } }
    const root = groupOf([node])
    expect(countRenderStats(root as never).triangles).toBe(12)
  })
})
