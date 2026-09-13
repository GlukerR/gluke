/* Разовый отчёт по GLB: чанки, расширения, ноды/меши, материалы, текстуры,
 * габариты. Нужен, чтобы решать по фактам: что это за модель, чем сжата,
 * сколько весят карты и можно ли что-то поджать.
 *
 * Запуск: node scripts/glb-report.mjs <file.glb>
 */
import fs from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('usage: node glb-report.mjs <file.glb>')
  process.exit(1)
}

const buf = fs.readFileSync(file)
const readChunks = (buffer) => {
  const chunks = []
  let offset = 12
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) })
    offset += 8 + length
  }
  return chunks
}

const chunks = readChunks(buf)
const json = JSON.parse(chunks.find(c => c.type.startsWith('JSON')).data.toString('utf8'))
const bin = chunks.find(c => c.type.startsWith('BIN'))

const imageBytes = (json.images ?? []).reduce((sum, image) => {
  const view = json.bufferViews?.[image.bufferView]
  return sum + (view?.byteLength ?? 0)
}, 0)
const geometryBytes = (json.bufferViews ?? []).reduce((sum, view, index) => {
  const used = (json.images ?? []).some(image => image.bufferView === index)
  return used ? sum : sum + view.byteLength
}, 0)

console.log('=== файл ===')
console.log(file, (buf.length / 1024).toFixed(0) + ' КБ')
console.log('BIN:', bin ? (bin.data.length / 1024).toFixed(0) + ' КБ' : '-')
console.log('карты:', (imageBytes / 1024).toFixed(0) + ' КБ', '| геометрия+прочее:', (geometryBytes / 1024).toFixed(0) + ' КБ')
console.log('просит (extensionsRequired):', (json.extensionsRequired ?? []).join(', ') || '—')
console.log('умеет (extensionsUsed):', (json.extensionsUsed ?? []).join(', ') || '—')

console.log('\n=== сцена ===')
for (const [i, scene] of (json.scenes ?? []).entries()) {
  console.log(`scene ${i} "${scene.name ?? ''}" roots: [${(scene.nodes ?? []).join(', ')}]`)
}

/* Дерево нод с габаритами: считаю по min/max аккессоров POSITION, без
   трансформаций родителей — для обзорной картины этого хватает. */
const accessorOf = (mesh, i) => json.accessors[mesh.primitives[i].attributes.POSITION]
const meshBox = (mesh) => {
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  for (let i = 0; i < mesh.primitives.length; i++) {
    const accessor = accessorOf(mesh, i)
    if (!accessor?.min) continue
    for (let a = 0; a < 3; a++) {
      box.min[a] = Math.min(box.min[a], accessor.min[a])
      box.max[a] = Math.max(box.max[a], accessor.max[a])
    }
  }
  return box
}
const round = n => (Number.isFinite(n) ? +n.toFixed(2) : null)

console.log('\n=== материалы ===')
for (const [i, material] of (json.materials ?? []).entries()) {
  const pbr = material.pbrMetallicRoughness ?? {}
  const maps = [
    pbr.baseColorTexture ? `base=${pbr.baseColorTexture.index}` : '',
    pbr.metallicRoughnessTexture ? `mr=${pbr.metallicRoughnessTexture.index}` : '',
    material.normalTexture ? `norm=${material.normalTexture.index}` : '',
    material.emissiveTexture ? `emis=${material.emissiveTexture.index}` : '',
    material.occlusionTexture ? `ao=${material.occlusionTexture.index}` : '',
  ].filter(Boolean).join(' ')
  console.log(`${i}\t${material.name ?? '(unnamed)'}\tbase: ${pbr.baseColorFactor?.map(n => +n.toFixed(2)).join(',') ?? '-'}\tmetal: ${pbr.metallicFactor ?? '-'}\trough: ${pbr.roughnessFactor ?? '-'}\tdoubleSided: ${material.doubleSided ?? false}\temissive: ${material.emissiveFactor?.join(',') ?? '-'}\tкарты: ${maps || '—'}\text: ${JSON.stringify(material.extensions ?? {})}`)
}

console.log('\n=== текстуры ===')
for (const [i, texture] of (json.textures ?? []).entries()) {
  /* У webp-текстур источник лежит в расширении, а не в `source`. */
  const source = texture.source ?? texture.extensions?.EXT_texture_webp?.source
  const image = json.images[source]
  const view = image.bufferView !== undefined ? json.bufferViews[image.bufferView] : null
  console.log(`${i}\t${image.name ?? '(unnamed)'}\t${image.mimeType ?? '?'}\t${view ? (view.byteLength / 1024).toFixed(0) + ' КБ' : image.uri ?? '-'}\turi: ${image.uri ?? '(в буфере)'}`)
}

console.log('\n=== ноды/меши ===')
let tris = 0
const walk = (index, depth) => {
  const node = json.nodes[index]
  const pad = '  '.repeat(depth)
  let extra = ''
  if (node.mesh !== undefined) {
    const mesh = json.meshes[node.mesh]
    const box = meshBox(mesh)
    const prims = mesh.primitives.map((primitive) => {
      const count = primitive.indices !== undefined ? json.accessors[primitive.indices].count / 3 : 0
      tris += count
      return `${json.materials[primitive.material]?.name ?? '-'}:${count}тр`
    })
    extra = ` | mesh "${mesh.name ?? ''}" [${prims.join(', ')}] box ${box.min.map(round)} … ${box.max.map(round)}`
  }
  console.log(`${pad}${index}\t${node.name ?? '(unnamed)'}\tТ: ${node.translation?.map(round) ?? '-'}\tМ: ${node.scale?.map(round) ?? '-'}${extra}`)
  for (const child of node.children ?? []) walk(child, depth + 1)
}
for (const root of json.scenes?.[json.scene ?? 0]?.nodes ?? []) walk(root, 0)
console.log('\nвсего треугольников:', tris)
