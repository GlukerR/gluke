import type * as THREE from 'three'

/*
 * Цифры технического монитора гаража (раздел «Техника»): вершины машины и
 * оценка видеопамяти всей сцены. Считаются по видимому — после каждого
 * переключения обвеса или уровня, — поэтому совпадают с тем, что на экране.
 *
 * Вершины — только машины (колёса вьювер подставил сам, машина сдана без них,
 * §56). Видеопамять — наоборот, по всей сцене вместе с гаражом: это цена кадра
 * целиком, и в панели она подписана отдельно.
 */

/** Объект виден в кадре: он и вся цепочка родителей. */
export function isVisibleInScene(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false
  }
  return true
}

/** Вершины видимых мешей поддерева. */
export function countVisibleVertices(root: THREE.Object3D): number {
  let vertices = 0
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !isVisibleInScene(mesh)) return
    vertices += mesh.geometry?.attributes?.position?.count ?? 0
  })
  return vertices
}

/**
 * Видеопамять сцены, МБ — оценка сверху по тому, что реально в ней лежит:
 * буферы видимой геометрии и карты материалов с мип-уровнями. Точного счётчика
 * байтов WebGL не отдаёт. `extraTextures` — карты, которых нет в материалах
 * напрямую (тайлы печатей гаража, окружение сцены).
 */
export function estimateVideoMemoryMb(scene: THREE.Object3D, extraTextures: Iterable<unknown> = []): number {
  const geometries = new Set<THREE.BufferGeometry>()
  const textures = new Set<THREE.Texture>()
  const addTexture = (value: unknown) => {
    if (value && (value as THREE.Texture).isTexture) textures.add(value as THREE.Texture)
  }

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !isVisibleInScene(mesh)) return
    geometries.add(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      for (const value of Object.values(material)) addTexture(value)
      /* Карты шейдера машины живут в юниформах, а не в полях материала. */
      const uniforms = material.userData.carUniforms as Record<string, { value: unknown }> | undefined
      if (uniforms) for (const uniform of Object.values(uniforms)) addTexture(uniform.value)
    }
  })
  for (const texture of extraTextures) addTexture(texture)

  let bytes = 0
  for (const geometry of geometries) {
    for (const attribute of Object.values(geometry.attributes)) {
      bytes += (attribute as THREE.BufferAttribute).array?.byteLength ?? 0
    }
    bytes += geometry.index?.array.byteLength ?? 0
  }
  for (const texture of textures) {
    const image = texture.image as { width?: number, height?: number } | undefined
    const pixels = (image?.width ?? 0) * (image?.height ?? 0)
    bytes += pixels * 4 * (texture.generateMipmaps ? 4 / 3 : 1)
  }
  return bytes / (1024 * 1024)
}
