import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { countVisibleVertices, estimateVideoMemoryMb, isVisibleInScene } from './garageTechStats'

const MB = 1024 * 1024

/* Меш-плоскость: 4 вершины, позиции float32 (48 байт) + индексы. */
function plane(material: THREE.Material = new THREE.MeshBasicMaterial()): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
}

function geometryBytes(geometry: THREE.BufferGeometry): number {
  let bytes = geometry.index?.array.byteLength ?? 0
  for (const attribute of Object.values(geometry.attributes)) bytes += (attribute as THREE.BufferAttribute).array.byteLength
  return bytes
}

describe('isVisibleInScene', () => {
  it('скрытый родитель прячет потомка', () => {
    const parent = new THREE.Group()
    const child = plane()
    parent.add(child)
    expect(isVisibleInScene(child)).toBe(true)
    parent.visible = false
    expect(isVisibleInScene(child)).toBe(false)
  })
})

describe('countVisibleVertices', () => {
  it('считает только видимые меши, включая вложенные', () => {
    const root = new THREE.Group()
    const hiddenKit = new THREE.Group()
    hiddenKit.visible = false
    hiddenKit.add(plane())
    root.add(plane(), plane(), hiddenKit)
    expect(countVisibleVertices(root)).toBe(8)
  })
})

describe('estimateVideoMemoryMb', () => {
  it('буферы видимой геометрии, общая геометрия — один раз', () => {
    const scene = new THREE.Scene()
    const shared = plane()
    scene.add(shared, new THREE.Mesh(shared.geometry, shared.material))
    const hidden = plane()
    hidden.visible = false
    scene.add(hidden)
    expect(estimateVideoMemoryMb(scene) * MB).toBeCloseTo(geometryBytes(shared.geometry), 3)
  })

  it('карты: 4 байта на пиксель, мип-уровни — плюс треть; юниформы и внешние карты тоже', () => {
    const map = new THREE.DataTexture(new Uint8Array(64 * 64 * 4), 64, 64)
    map.generateMipmaps = true
    const uniformMap = new THREE.DataTexture(new Uint8Array(32 * 32 * 4), 32, 32)
    uniformMap.generateMipmaps = false
    const tile = new THREE.DataTexture(new Uint8Array(16 * 16 * 4), 16, 16)
    tile.generateMipmaps = false

    const material = new THREE.MeshBasicMaterial({ map })
    material.userData.carUniforms = { uMask: { value: uniformMap }, uScale: { value: 2 } }
    const mesh = plane(material)
    const scene = new THREE.Scene()
    scene.add(mesh)

    const expected = geometryBytes(mesh.geometry)
      + 64 * 64 * 4 * (4 / 3)
      + 32 * 32 * 4
      + 16 * 16 * 4
    /* Одна и та же карта снаружи и в материале не считается дважды. */
    expect(estimateVideoMemoryMb(scene, [tile, map, null]) * MB).toBeCloseTo(expected, 3)
  })
})
