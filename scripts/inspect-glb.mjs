/* Читает GLB, печатает JSON-чанк (структуру нод) — для инспекции перед
 * правкой видимости вариантов. Разовый диагностический скрипт.
 */
import { readGlbJson } from './glb.mjs'

const file = process.argv[2]
if (!file) {
  console.error('usage: node inspect-glb.mjs <file.glb>')
  process.exit(1)
}

const gltf = readGlbJson(file)
console.log('=== nodes (name → mesh index) ===')
for (const [i, node] of (gltf.nodes ?? []).entries()) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0
  console.log(`${i}\t${node.name ?? '(unnamed)'}\tmesh: ${node.mesh ?? '-'}\tchildren: ${hasChildren ? node.children.join(',') : '-'}`)
}
