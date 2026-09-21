/**
 * Проверка паритета уровней детализации у машин с конфигуратором
 * (`app/components/projects/ProjectCarConfigurator.vue`).
 *
 * Зачем это нужно. Упрощённые LOD приходят из того же экспортёра, но
 * собираются другой цепочкой шагов, и расхождения всплывают тихо: уровень без
 * UV-набора роняет маску зон, уровень без нод обвеса оставляет панель
 * комплектации пустой, колёса подробного уровня пропадают. Глазами такое
 * находится случайно, поэтому расхождения считает проверка:
 *
 *   1. ноды манифеста — по факту в GLB (манифест либо правдив, либо бесполезен);
 *   2. роли, колёса и UV-наборы — сравнением с подробным уровнем;
 *   3. байты и трисы — по факту файла (манифест — копия выгрузки).
 *
 * Упрощение уровня допустимо, но объявляется в манифесте полем `parity`
 * (id уровня → причина): тогда оно известно и не считается ошибкой. Любое
 * расхождение без записи в `parity` — ошибка и ненулевой код возврата.
 *
 * Геометрия внутри draco проверке не мешает: имена нод, материалы и объявленные
 * `TEXCOORD_*` лежат в JSON-чанке GLB, декодер не нужен.
 *
 * Использование: pnpm check:lods   (входит в pnpm check)
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseGlb } from './glb.mjs'

const root = process.cwd()

/**
 * Имя ноды в том виде, в каком его отдаёт загрузчик three: пробелы становятся
 * подчёркиваниями, `[ ] . : /` вырезаются (`Wheel.001` → `Wheel001`).
 * Дублирует `nodeKey` из `app/utils/carVariants.ts` — тест приложения и этот
 * скрипт живут в разных средах (типы Nuxt против обычного node).
 */
function nodeKey(name) {
  return name.replace(/\s/g, '_').replace(/[[\].:/]/g, '')
}

/** Факты по нодам модели: UV-наборы и трисы. */
function glbFacts(json) {
  const nodes = new Map()
  const uvSets = new Set()
  let triangles = 0

  for (const node of json.nodes ?? []) {
    if (!node.name || node.mesh === undefined) continue
    const mesh = json.meshes?.[node.mesh]
    if (!mesh) continue

    const nodeUv = new Set()
    let nodeTris = 0
    for (const primitive of mesh.primitives) {
      for (const attribute of Object.keys(primitive.attributes ?? {})) {
        if (attribute.startsWith('TEXCOORD_')) {
          nodeUv.add(attribute)
          uvSets.add(attribute)
        }
      }
      const source = primitive.indices ?? primitive.attributes?.POSITION
      const count = source === undefined ? 0 : (json.accessors?.[source]?.count ?? 0)
      nodeTris += Math.floor(count / 3)
    }

    const key = nodeKey(node.name)
    const previous = nodes.get(key)
    nodes.set(key, {
      uvSets: [...new Set([...(previous?.uvSets ?? []), ...nodeUv])].sort(),
      triangles: (previous?.triangles ?? 0) + nodeTris,
    })
    triangles += nodeTris
  }

  return { nodes, uvSets: [...uvSets].sort(), triangles }
}

/** Сверяет уровни одного манифеста. Возвращает уровни и расхождения. */
async function checkManifest(manifestPath) {
  const dir = path.dirname(manifestPath)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const ids = Object.keys(manifest.lods ?? {}).sort((a, b) => Number(a) - Number(b))
  const levels = []
  const issues = []

  for (const id of ids) {
    const entry = manifest.lods[id]
    if (!entry?.file) continue
    const file = path.join(dir, entry.file)
    const bytes = await readFile(file)
    const facts = glbFacts(parseGlb(bytes).json)

    const roles = {}
    const missing = []
    let wheels = 0
    for (const [name, node] of Object.entries(entry.nodes ?? {})) {
      const key = nodeKey(name)
      const found = facts.nodes.has(key)
      if (!found) missing.push(name)
      ;(roles[node.role] ??= []).push(found ? key : `${key} (нет в модели)`)
      if (node.role === 'wheel' && found) wheels++
    }

    if (missing.length > 0) {
      issues.push({ level: id, kind: 'nodes', detail: `в модели нет нод манифеста: ${missing.join(', ')}` })
    }

    /* Маска зон читается из базовой текстуры, а её three берёт по uv0: уровень
       без TEXCOORD_0 теряет зоны — это не упрощение, а поломка. */
    const bodyName = Object.entries(entry.nodes ?? {}).find(([, node]) => node.role === 'body')?.[0]
    if (bodyName && !facts.nodes.get(nodeKey(bodyName))?.uvSets.includes('TEXCOORD_0')) {
      issues.push({
        level: id,
        kind: 'uv',
        detail: `нода ${bodyName} без TEXCOORD_0: маска зон читается по uv0`,
      })
    }

    if (facts.triangles !== entry.tris || bytes.byteLength !== entry.bytes) {
      issues.push({
        level: id,
        kind: 'meta',
        detail: `манифест: ${entry.bytes} байт / ${entry.tris} трисов, модель: ${bytes.byteLength} байт / ${facts.triangles} трисов`,
      })
    }

    levels.push({
      id,
      file: entry.file,
      roles,
      uvSets: facts.uvSets,
      wheels,
      triangles: facts.triangles,
    })
  }

  /* Эталон — подробный уровень: с ним сравниваются остальные. */
  const reference = levels[0]
  if (reference) {
    const referenceRoles = Object.keys(reference.roles).sort()
    for (const level of levels.slice(1)) {
      const levelRoles = Object.keys(level.roles).sort()
      const lost = referenceRoles.filter(role => !levelRoles.includes(role))
      const extra = levelRoles.filter(role => !referenceRoles.includes(role))
      if (lost.length > 0 || extra.length > 0) {
        issues.push({
          level: level.id,
          kind: 'roles',
          detail: [
            lost.length ? `нет ролей LOD${reference.id}: ${lost.join(', ')}` : '',
            extra.length ? `роли, которых нет в LOD${reference.id}: ${extra.join(', ')}` : '',
          ].filter(Boolean).join('; '),
        })
      }

      if (level.wheels === 0 && reference.wheels > 0) {
        issues.push({
          level: level.id,
          kind: 'wheels',
          detail: `колёс нет (в LOD${reference.id} их ${reference.wheels}) — вьювер подставляет колёса подробного уровня`,
        })
      }

      const lostUv = reference.uvSets.filter(set => !level.uvSets.includes(set))
      const extraUv = level.uvSets.filter(set => !reference.uvSets.includes(set))
      if (lostUv.length > 0 || extraUv.length > 0) {
        issues.push({
          level: level.id,
          kind: 'uv',
          detail: [
            lostUv.length ? `нет UV-наборов LOD${reference.id}: ${lostUv.join(', ')}` : '',
            extraUv.length ? `лишние UV-наборы: ${extraUv.join(', ')}` : '',
          ].filter(Boolean).join('; '),
        })
      }
    }
  }

  return { manifest, levels, issues, declared: manifest.parity ?? {} }
}

/** Пути манифестов из контента кейсов: `/media/...` → файл в `public/`.
 *  Ловит и основной `configurator.manifest`, и элементы списка машин
 *  (`- manifest: …` в `configurator.vehicles`). */
async function manifestPaths() {
  const contentDir = path.join(root, 'content', 'projects')
  const found = new Set()
  for (const locale of await readdir(contentDir)) {
    const dir = path.join(contentDir, locale)
    if (!(await stat(dir)).isDirectory()) continue
    for (const file of await readdir(dir)) {
      if (!file.endsWith('.md')) continue
      const markdown = await readFile(path.join(dir, file), 'utf8')
      for (const match of markdown.matchAll(/^\s*(?:-\s+)?manifest:\s*(\/media\/\S+)\s*$/gm)) {
        found.add(path.join(root, 'public', match[1]))
      }
    }
  }
  return [...found].sort()
}

const paths = await manifestPaths()
if (paths.length === 0) {
  console.log('[check:lods] кейсов с конфигуратором нет — проверять нечего')
  process.exit(0)
}

let failed = 0
let levelsChecked = 0

for (const manifestPath of paths) {
  const rel = path.relative(root, manifestPath).replaceAll('\\', '/')
  let result
  try {
    result = await checkManifest(manifestPath)
  }
  catch (error) {
    console.error(`✗ ${rel}: ${error.message}`)
    failed++
    continue
  }

  const { manifest, levels, issues, declared } = result
  levelsChecked += levels.length
  console.log(`\n${rel}`)

  /* Посадка машины по кузову подробного уровня (`app/utils/carSeating.ts`):
     без неё лёгкие уровни встают по постоянной прежней машины и садятся на
     колёса, пока не доедет подробный. Пишет `scripts/car-seat-bounds.mjs`. */
  if (!manifest.seatBody || typeof manifest.seatClearance !== 'number') {
    console.log('  ✗ нет посадки (seatBody/seatClearance) — прогоните node scripts/car-seat-bounds.mjs')
    failed++
  }

  for (const level of levels) {
    const roles = Object.entries(level.roles).map(([role, names]) => `${role}: ${names.length}`).join(', ')
    console.log(`  LOD${level.id} ${level.file}: ${level.triangles} трисов, колёс ${level.wheels}, UV ${level.uvSets.join('+') || '—'}`)
    console.log(`    ${roles}`)
    for (const issue of issues.filter(item => item.level === level.id)) {
      const undeclared = issue.kind === 'nodes' || issue.kind === 'meta' || !declared[level.id]
      if (undeclared) {
        console.log(`    ✗ [${issue.kind}] ${issue.detail} — расхождение не объявлено`)
        failed++
      }
      else {
        console.log(`    · [${issue.kind}] ${issue.detail}`)
      }
    }
    if (declared[level.id] && issues.some(item => item.level === level.id)) {
      console.log(`    объявлено в parity: ${declared[level.id]}`)
    }
  }

  /* Лишняя запись в `parity` — тоже расхождение: уровень давно выровнялся,
     а манифест всё ещё оправдывает его. */
  const diverging = new Set(issues.map(issue => issue.level))
  for (const level of Object.keys(declared)) {
    if (!diverging.has(level)) {
      console.log(`  ✗ LOD${level} записан в parity, но различий у него нет — запись лишняя`)
      failed++
    }
  }
}

if (failed > 0) {
  console.error(`\n[check:lods] расхождений без объяснения: ${failed}`)
  process.exit(1)
}
console.log(`\n[check:lods] ${paths.length} машин, ${levelsChecked} уровней — паритет соблюдён (объявленные упрощения в отчёте выше)`)
