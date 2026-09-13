/* Читает GLB, печатает JSON-чанк (структуру нод) — для инспекции перед
 * правкой видимости вариантов. Разовый диагностический скрипт.
 */
import fs from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('usage: node inspect-glb.mjs <file.glb>')
  process.exit(1)
}

const buf = fs.readFileSync(file)
if (buf.toString('ascii', 0, 4) !== 'glTF') {
  console.error('not a GLB file')
  process.exit(1)
}

/* GLB: 12-байтный заголовок + чанки [length(4) type(4) data]. */
let offset = 12
const chunks = []
while (offset < buf.length) {
  const length = buf.readUInt32LE(offset)
  const type = buf.toString('ascii', offset + 4, offset + 8)
  chunks.push({ type, length, data: buf.subarray(offset + 8, offset + 8 + length) })
  offset += 8 + length
}

const jsonChunk = chunks.find(c => c.type === 'JSON')
if (!jsonChunk) {
  console.error('no JSON chunk')
  process.exit(1)
}

const gltf = JSON.parse(jsonChunk.data.toString('utf8'))
console.log('=== nodes (name → mesh index) ===')
for (const [i, node] of (gltf.nodes ?? []).entries()) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0
  console.log(`${i}\t${node.name ?? '(unnamed)'}\tmesh: ${node.mesh ?? '-'}\tchildren: ${hasChildren ? node.children.join(',') : '-'}`)
}
