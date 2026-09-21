#!/usr/bin/env node
/*
 * Посадка машины — в её манифест: кузов подробного уровня (`seatBody`) и
 * постоянная (`seatClearance`).
 *
 * Основа посадки — кузов, а не колёса (`app/utils/carSeating.ts`). Низ кузова
 * выше низа уровня ровно на высоту колеса, и это постоянная самой машины: у
 * упрощённых уровней колёс нет вовсе, и по своему габариту они встали бы
 * кузовом на пол. По кузову подробного уровня и постоянной конфигуратор знает
 * посадку ещё до первого GLB и ставит ею все уровни машины — лёгкий встаёт
 * туда же, где потом встанет подробный.
 *
 *   node scripts/car-seat-bounds.mjs [папка=public/media/projects/rp-grand]
 *
 * Габарит — из min/max атрибута POSITION (их пишет и draco-экспорт) с
 * трансформами нод, в координатах файла; разворот машины в зале конфигуратор
 * накладывает сам. Прогонять после каждой выкладки моделей на сайт.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'

const dir = process.argv[2] ?? 'public/media/projects/rp-grand'

function readGlbJson(file) {
  const bytes = readFileSync(file)
  let offset = 12
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    if (type === 0x4E4F534A) return JSON.parse(bytes.subarray(offset + 8, offset + 8 + length).toString('utf8'))
    offset += 8 + length
  }
  throw new Error(`${file}: нет JSON-чанка`)
}

/* Габарит кузова (узлы не-колёса) и габарит уровня целиком. */
function glbBounds(json) {
  const body = new THREE.Box3()
  const all = new THREE.Box3()
  const walk = (index, parent) => {
    const node = json.nodes[index]
    const local = new THREE.Matrix4()
    if (node.matrix) local.fromArray(node.matrix)
    else {
      local.compose(
        new THREE.Vector3(...(node.translation ?? [0, 0, 0])),
        new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
        new THREE.Vector3(...(node.scale ?? [1, 1, 1])),
      )
    }
    const world = parent.clone().multiply(local)
    if (node.mesh !== undefined) {
      for (const primitive of json.meshes[node.mesh].primitives) {
        const accessor = json.accessors[primitive.attributes.POSITION]
        const part = new THREE.Box3(new THREE.Vector3(...accessor.min), new THREE.Vector3(...accessor.max))
        part.applyMatrix4(world)
        all.union(part)
        if (!/^Wheel/.test(node.name ?? '')) body.union(part)
      }
    }
    for (const child of node.children ?? []) walk(child, world)
  }
  for (const root of json.scenes[json.scene ?? 0].nodes) walk(root, new THREE.Matrix4())
  return { body, all }
}

const round = value => Math.round(value * 10000) / 10000

for (const name of readdirSync(dir).filter(file => file.endsWith('.json'))) {
  const file = path.join(dir, name)
  const text = readFileSync(file, 'utf8')
  const manifest = JSON.parse(text)
  if (!manifest.lods) continue
  /* Подробный уровень — первый по номеру, как в `buildLods`. */
  const [, detailed] = Object.entries(manifest.lods).sort(([a], [b]) => Number(a) - Number(b))[0]
  const { body, all } = glbBounds(readGlbJson(path.join(dir, detailed.file)))

  /* Прежнее поле габарита уровня убираем: посадку задаёт кузов. */
  delete manifest.seatBounds
  manifest.seatBody = { min: body.min.toArray().map(round), max: body.max.toArray().map(round) }
  manifest.seatClearance = round(body.min.y - all.min.y)
  writeFileSync(file, `${JSON.stringify(manifest, null, 1)}\n`)
  console.log(`${name}: ${detailed.file} — низ кузова выше низа уровня на ${manifest.seatClearance} м (низ уровня ${round(all.min.y)})`)
}
